import assert from "node:assert/strict";
import test from "node:test";
import { identifyRecurringTransactions, inferRecurrence, type RecurringTransaction } from "./recurring-transactions";
import { plaidRecurrenceSignal, plaidStreamSignals } from "./plaid-recurrence";

const charge = (id: number, date: string, extra: Partial<RecurringTransaction> = {}): RecurringTransaction =>
  ({ id, date, amount: 100, type: "expense", description: "Acme", merchant: "Acme", ...extra });
const monthly = (amounts = [100, 100, 100]) =>
  ["2026-01-01", "2026-02-01", "2026-03-01"].map((date, i) => charge(i + 1, date, { amount: amounts[i] }));
const known = [{ id: 1, name: "Acme", is_known_subscription: true }];
const datesAt = (intervals: number[]) => {
  let day = Date.UTC(2024, 0, 1);
  return [charge(1, new Date(day).toISOString()), ...intervals.map((gap, i) => {
    day += gap * 86_400_000;
    return charge(i + 2, new Date(day).toISOString());
  })];
};

test("heuristics require three observations, including historical rows", () => {
  assert.equal(inferRecurrence(monthly().slice(0, 2)), undefined);
  assert.equal(inferRecurrence(monthly())?.recurringFreq, "Monthly");
});

test("all seven cycle windows include their exact boundaries", () => {
  for (const [name, minimum, maximum] of [
    ["Weekly", 6, 8], ["Bi-Weekly", 13, 15], ["Semi-monthly", 14, 16],
    ["Monthly", 27, 33], ["Quarterly", 85, 95], ["Semi-Annually", 175, 195], ["Annually", 360, 370],
  ] as const) {
    assert.equal(inferRecurrence(datesAt([minimum, maximum]))?.recurringFreq, name);
  }
  for (const gap of [5, 9, 12, 17, 26, 34, 84, 96, 174, 196, 359, 371]) {
    assert.equal(inferRecurrence(datesAt([gap, gap])), undefined, `reject gap ${gap}`);
  }
});

test("three and four observations use median intervals, not an all-interval rule", () => {
  assert.equal(inferRecurrence(datesAt([7, 53]))?.recurringFreq, "Monthly");
  assert.equal(inferRecurrence(datesAt([30, 30, 80]))?.recurringFreq, "Monthly");
});

test("five or more observations require at least 80 percent of intervals", () => {
  assert.equal(inferRecurrence(datesAt([30, 30, 30, 60])), undefined, "75 percent is insufficient");
  assert.equal(inferRecurrence(datesAt([30, 30, 30, 30, 60]))?.recurringFreq, "Monthly", "exactly 80 percent qualifies");
  assert.equal(inferRecurrence(datesAt([30, 30, 30, 60, 60])), undefined);
});

test("alternating 14/16-day gaps are semi-monthly; constant 14-day gaps are biweekly", () => {
  for (const intervals of [[14, 16], [16, 14, 16], [14, 16, 14, 16, 14]]) {
    assert.equal(inferRecurrence(datesAt(intervals))?.recurringFreq, "Semi-monthly");
  }
  assert.equal(inferRecurrence(datesAt([14, 14, 14, 14]))?.recurringFreq, "Bi-Weekly");
});

test("every amount must be within inclusive five percent of the median", () => {
  assert.equal(inferRecurrence(monthly([95, 100, 105]))?.recurringType, "subscription");
  assert.equal(inferRecurrence(monthly([95, 100, 105.01]))?.recurringType, "recurring_bill");
  assert.equal(inferRecurrence(monthly([94.99, 100, 105]))?.recurringType, "recurring_bill");
});

test("explicit historical tags beat provider flags, catalog and heuristic signals", () => {
  const rows = monthly();
  Object.assign(rows[0], { recurrence_override: true, is_user_modified: true, is_recurring: true,
    recurring_type: "recurring_bill", recurring_freq: "Quarterly" });
  rows[2].providerSignal = { isRecurring: true, recurringType: "subscription", recurringFreq: "Weekly" };
  const updates = identifyRecurringTransactions(rows, known);
  assert.equal(updates.length, 2);
  assert.ok(updates.every(row => row.recurringType === "recurring_bill" && row.recurringFreq === "Quarterly"));
});

test("the latest explicit negative override wins and corrected rows remain untouched", () => {
  const rows = monthly();
  Object.assign(rows[0], { source: "manual", is_recurring: true, recurring_type: "subscription",
    recurrence_override_at: "2026-04-01" });
  Object.assign(rows[1], { recurrence_override: true, is_user_modified: true, is_recurring: false,
    recurrence_override_at: "2026-05-01" });
  assert.deepEqual(identifyRecurringTransactions(rows, known), [
    { id: 3, isRecurring: false, recurringType: null, recurringFreq: null },
  ]);
});

test("provider tags beat merchant-only flags and heuristics", () => {
  const row = charge(1, "2026-01-01", {
    providerSignal: { isRecurring: true, recurringType: "recurring_bill", recurringFreq: "Monthly" },
  });
  assert.equal(identifyRecurringTransactions([row], known)[0].recurringType, "recurring_bill");
});

test("merchant-only subscription and recurring-bill profiles need no minimum history", () => {
  const row = charge(1, "2026-01-01");
  assert.equal(identifyRecurringTransactions([row], known)[0].recurringType, "subscription");
  assert.equal(identifyRecurringTransactions([row], [
    { ...known[0], is_known_subscription: false, is_known_recurring: true },
  ])[0].recurringType, "recurring_bill");
  assert.deepEqual(identifyRecurringTransactions([row], []), []);
});

test("category-only corrections do not establish a merchant recurrence override", () => {
  const rows = monthly();
  rows[0].is_user_modified = true;
  rows[0].is_recurring = false;
  assert.ok(identifyRecurringTransactions(rows, []).every(update => update.isRecurring));
  assert.equal(identifyRecurringTransactions(rows, []).length, 2);
});

test("invalid rows, income, transfers and zero amounts never provide heuristic evidence", () => {
  for (const extra of [{ type: "income" }, { type: "transfer" }, { date: "invalid" }, { date: "2026-02-30" }, { amount: 0 }, { amount: "bad" }]) {
    const rows = monthly();
    Object.assign(rows[2], extra);
    assert.deepEqual(identifyRecurringTransactions(rows, []), []);
  }
});

test("canonical identity matching remains guarded against incidental brands and ambiguity", () => {
  assert.equal(identifyRecurringTransactions([charge(1, "2026-01-01", {
    merchant: "PAYPAL ACME REF 001", description: "PAYPAL ACME REF 001",
  })], known)[0].recurringType, "subscription");
  assert.deepEqual(identifyRecurringTransactions([charge(1, "2026-01-01", {
    merchant: "Other Store", description: "Acme",
  })], known), []);
  assert.deepEqual(identifyRecurringTransactions([charge(1, "2026-01-01")],
    [...known, { ...known[0], id: 2, name: "ACME!" }]), []);
});

test("Plaid signals map only explicitly flagged rows and active streams from owned accounts", () => {
  assert.equal(plaidRecurrenceSignal({ name: "Acme" }), undefined);
  assert.equal(plaidRecurrenceSignal({ is_subscription: true, frequency: "MONTHLY" })?.recurringType, "subscription");
  const signals = plaidStreamSignals([
    { is_active: true, transaction_ids: ["yes"], frequency: "BIWEEKLY", account_id: "owned" },
    { is_active: false, transaction_ids: ["inactive"], frequency: "MONTHLY", account_id: "owned" },
    { is_active: true, transaction_ids: ["foreign"], frequency: "MONTHLY", account_id: "other" },
  ], new Set(["owned"]));
  assert.deepEqual(Array.from(signals.keys()), ["yes"]);
  assert.equal(signals.get("yes")?.recurringFreq, "Bi-Weekly");
});
