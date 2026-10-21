import assert from "node:assert/strict";
import test from "node:test";
import { transactionEntryFromSource } from "./transaction-import";
import {
  identifyRecurringTransactions,
  type RecurringTransaction,
  type RecurringMerchant,
} from "./recurring-transactions";

const catalog: RecurringMerchant[] = [
  { id: 1, name: "Netflix", is_known_subscription: true },
  { id: 2, name: "Spotify", is_known_subscription: true },
  { id: 3, name: "Power Company", is_known_subscription: false },
  { id: 4, name: "Netflix Store", is_known_subscription: false },
];
const charge = (id: number, date: string, overrides: Partial<RecurringTransaction> = {}): RecurringTransaction => ({
  id, date, description: "Netflix", amount: "15", type: "expense", ...overrides,
});
const identify = (rows: RecurringTransaction[], merchants = catalog) =>
  identifyRecurringTransactions(rows, merchants).sort((a, b) => a.id - b.id);

test("a known subscription merchant classifies monthly variable charges as subscriptions", () => {
  const rows = [charge(1, "2026-01-03"), charge(2, "2026-02-03", { amount: "17" })];
  assert.deepEqual(identify(rows), [
    { id: 1, recurringType: "subscription" }, { id: 2, recurringType: "subscription" },
  ]);
  assert.deepEqual(identify(rows, []), [
    { id: 1, recurringType: "recurring_bill" }, { id: 2, recurringType: "recurring_bill" },
  ], "the catalog flag, not merely the merchant's name, supplies the subscription signal");
});

test("single purchases from known subscription and ordinary merchants are never recurring", () => {
  for (const description of ["Netflix", "Spotify", "Corner Shop"]) {
    assert.deepEqual(identify([charge(1, "2026-01-03", { description })]), []);
  }
});

test("known merchants still need monthly cadence, not just repeated purchases", () => {
  for (const date of ["2026-01-04", "2026-01-22", "2026-02-18", "2026-06-03"]) {
    assert.deepEqual(identify([charge(1, "2026-01-03"), charge(2, date)]), []);
  }
});

test("repeated transaction dates infer all supported recurrence frequencies", () => {
  const cases: Array<[string, string[]]> = [
    ["Weekly", ["2026-01-01", "2026-01-08", "2026-01-15"]],
    ["Bi-Weekly", ["2026-01-01", "2026-01-15", "2026-01-29", "2026-02-12"]],
    ["Bi-Weekly", ["2026-02-01", "2026-02-15", "2026-03-01", "2026-03-15"]],
    ["Semi-monthly", ["2026-01-01", "2026-01-15", "2026-02-01", "2026-02-15"]],
    ["Monthly", ["2026-01-03", "2026-02-03", "2026-03-03"]],
    ["Quarterly", ["2026-01-01", "2026-04-01", "2026-07-01"]],
    ["Semi-Annually", ["2025-01-01", "2025-07-01", "2026-01-01"]],
    ["Annually", ["2024-01-01", "2025-01-01", "2026-01-01"]],
  ];
  for (const [frequency, dates] of cases) {
    const updates = identify(dates.map((date, index) => charge(index + 1, date)));
    assert.equal(updates.length, dates.length, `${frequency} cadence should be detected`);
    assert.ok(updates.every(update => update.recurringFreq === frequency), `${frequency} should be stored`);
  }
});

test("canonical matching handles changing bank descriptors, case, and punctuation", () => {
  assert.deepEqual(identify([
    charge(1, "2026-01-03", { description: "PAYPAL * NETFLIX.COM 1234", amount: "12" }),
    charge(2, "2026-02-03", { description: "NETFLIX.COM 9876", amount: "14" }),
  ]), [{ id: 1, recurringType: "subscription" }, { id: 2, recurringType: "subscription" }]);
});

test("explicit canonical merchant takes priority over unrelated description text", () => {
  assert.deepEqual(identify([
    charge(1, "2026-01-03", { merchant: " SPOTIFY ", description: "BANK PURCHASE 01", amount: "10" }),
    charge(2, "2026-02-03", { merchant: "Spotify", description: "CARD PAYMENT 02", amount: "11" }),
  ]), [{ id: 1, recurringType: "subscription" }, { id: 2, recurringType: "subscription" }]);
});

test("Plaid's descriptor fallback merchant values still match subscription profiles", () => {
  const imported = [
    { merchant_name: null, name: "PAYPAL NETFLIX ID 001", date: "2026-01-03", amount: 10 },
    { merchant_name: null, name: "PAYPAL NETFLIX ID 002", date: "2026-02-03", amount: 12 },
  ].map((transaction, index) => {
    // These are the same merchant/description fallbacks used by the Plaid route.
    const description = (transaction.merchant_name || transaction.name || "Bank transaction").trim();
    const merchant = (transaction.merchant_name || transaction.name || description).trim();
    return charge(index + 1, transaction.date, { description, merchant, amount: transaction.amount });
  });
  assert.deepEqual(identify(imported), [
    { id: 1, recurringType: "subscription" }, { id: 2, recurringType: "subscription" },
  ]);
  assert.deepEqual(identify([imported[0]]), [], "a descriptor match alone is not recurrence");
  assert.deepEqual(identify(imported, []), [
    { id: 1, recurringType: "recurring_bill" }, { id: 2, recurringType: "recurring_bill" },
  ], "the old first-three-description-words grouping is preserved without a catalog match");
});

test("real file import normalization can copy the description into merchant without losing canonical matching", () => {
  const imported = [
    { Date: "2026-01-03", Description: "PAYPAL NETFLIX ID 001", Amount: "10", Type: "expense" },
    { Date: "2026-02-03", Description: "PAYPAL NETFLIX ID 002", Amount: "12", Type: "expense" },
  ].map((source, index) => transactionEntryFromSource(source, index + 1));
  assert.equal(imported[0].merchant, imported[0].description);
  assert.deepEqual(identify(imported), [
    { id: 1, recurringType: "subscription" }, { id: 2, recurringType: "subscription" },
  ]);
  assert.deepEqual(identify([imported[0]]), []);
});

test("an exact canonical merchant wins even when its description names a subscription brand", () => {
  assert.deepEqual(identify([
    charge(1, "2026-01-03", { merchant: "Power Company", description: "Netflix", amount: "10" }),
    charge(2, "2026-02-03", { merchant: "Power Company", description: "Netflix", amount: "20" }),
  ]), [{ id: 1, recurringType: "recurring_bill" }, { id: 2, recurringType: "recurring_bill" }]);
});

test("unmatched copied merchant descriptors retain legacy grouping and ignore trailing reference numbers", () => {
  const rows = [
    charge(1, "2026-01-03", { merchant: "BANK RETAIL STORE 001", description: "BANK RETAIL STORE 001", amount: "10" }),
    charge(2, "2026-02-03", { merchant: "BANK RETAIL STORE 002", description: "BANK RETAIL STORE 002", amount: "20" }),
  ];
  assert.deepEqual(identify(rows), [
    { id: 1, recurringType: "recurring_bill" }, { id: 2, recurringType: "recurring_bill" },
  ]);
});

test("a longer non-subscription merchant name is not mistaken for its subscription prefix", () => {
  for (const merchant of [undefined, "Netflix Store"]) {
    assert.deepEqual(identify([
      charge(1, "2026-01-03", { merchant, description: "Netflix Store 001", amount: "10" }),
      charge(2, "2026-02-03", { merchant, description: "Netflix Store 002", amount: "20" }),
    ]), [{ id: 1, recurringType: "recurring_bill" }, { id: 2, recurringType: "recurring_bill" }]);
  }
});

test("explicit unknown merchant is not matched through incidental description text", () => {
  assert.deepEqual(identify([
    charge(1, "2026-01-03", { merchant: "Corner Shop", description: "Netflix Gift", amount: "10" }),
    charge(2, "2026-02-03", { merchant: "Corner Shop", description: "Netflix Gift", amount: "20" }),
  ]), [{ id: 1, recurringType: "recurring_bill" }, { id: 2, recurringType: "recurring_bill" }]);
});

test("substring names and ambiguous normalized catalog identities do not supply subscription signals", () => {
  const rows = [charge(1, "2026-01-03"), charge(2, "2026-02-03", { amount: "20" })];
  for (const merchants of [
    [{ id: 1, name: "Net", is_known_subscription: true }],
    [
      { id: 1, name: "Netflix", is_known_subscription: true },
      { id: 2, name: "NETFLIX!", is_known_subscription: false },
    ],
  ]) {
    assert.equal(identify(rows, merchants)[0].recurringType, "recurring_bill");
  }
});

test("ordinary variable monthly bills and unknown fixed-price recurring charges retain their classifications", () => {
  assert.deepEqual(identify([
    charge(1, "2026-01-03", { description: "Power Company", amount: "45" }),
    charge(2, "2026-02-03", { description: "Power Company", amount: "65" }),
    charge(3, "2026-01-03", { description: "Unknown Monthly Service" }),
    charge(4, "2026-02-03", { description: "Unknown Monthly Service" }),
  ]), [
    { id: 1, recurringType: "recurring_bill" }, { id: 2, recurringType: "recurring_bill" },
    { id: 3, recurringType: "subscription" }, { id: 4, recurringType: "subscription" },
  ]);
});

test("only charges participating in cadence are marked, not remote one-off purchases", () => {
  assert.deepEqual(identify([
    charge(4, "2026-08-03"),
    charge(2, "2026-03-03", { amount: "20" }),
    charge(1, "2026-01-03"),
    charge(3, "2026-04-03", { amount: "21" }),
  ]), [{ id: 2, recurringType: "subscription" }, { id: 3, recurringType: "subscription" }]);
});

test("manual corrections, income, transfers, invalid values, and blank descriptions do not create cadence", () => {
  for (const overrides of [
    { is_user_modified: true }, { type: "income" }, { type: "Transfer" },
    { amount: "invalid" }, { amount: "0" }, { date: "invalid" }, { description: "" },
  ]) {
    assert.deepEqual(identify([charge(1, "2026-01-03"), charge(2, "2026-02-03", overrides)]), []);
  }
});

test("monthly window boundaries and Date objects are supported", () => {
  for (const days of [20, 45]) {
    const date = new Date(Date.UTC(2026, 0, 3 + days));
    assert.equal(identify([charge(1, "2026-01-03"), charge(2, "2026-02-03", { date })]).length, 2);
  }
});
