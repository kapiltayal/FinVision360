import assert from "node:assert/strict";
import test from "node:test";
import type { Liability } from "@shared/schema";
import { buildExposure, getBarHeight, getTimelineTicks, sortExposure } from "./liability-map";

const now = new Date(2026, 9, 15);
const liability = (overrides: Partial<Liability> = {}): Liability => ({
  id: 1, userId: "fixture", name: "Loan", category: "Personal Loan",
  balance: "1000", interestRate: "12", minimumPayment: "100", maturityDate: null,
  institution: null, notes: null, createdAt: now, ...overrides,
});

test("duration uses a future maturity date, rounding partial months up", () => {
  const [item] = buildExposure([liability({ maturityDate: "2027-10-20" })], now);
  assert.equal(item.monthsRemaining, 13);
  assert.equal(item.durationSource, "maturity");
  assert.equal(buildExposure([liability({ maturityDate: "2026-10-20" })], now)[0].monthsRemaining, 1);
});

test("amortization accounts for interest and zero APR without dividing by zero", () => {
  const [interest, zero] = buildExposure([liability(), liability({ interestRate: "0" })], now);
  assert.equal(interest.monthsRemaining, 11);
  assert.equal(zero.monthsRemaining, 10);
  assert.equal(interest.durationSource, "payment");
});

test("missing, invalid and non-amortizing terms remain unknown, not paid off", () => {
  for (const patch of [
    { interestRate: null }, { interestRate: "" }, { interestRate: "-5" },
    { minimumPayment: "0" }, { minimumPayment: null }, { minimumPayment: "10" },
    { minimumPayment: "9" }, { maturityDate: "2020-01-01" },
    { maturityDate: "2026-02-30" }, { maturityDate: "bad-date" }, { balance: "NaN" },
  ]) {
    const [item] = buildExposure([liability(patch)], now);
    assert.equal(item.monthsRemaining, null);
    assert.ok(item.issue);
  }
});

test("an explicit scenario duration overrides stale/missing terms without mutating source", () => {
  const source = liability({ maturityDate: "2020-01-01" });
  const [item] = buildExposure([source], now, { 1: 24 });
  assert.equal(item.monthsRemaining, 24);
  assert.equal(item.durationSource, "override");
  assert.equal(source.maturityDate, "2020-01-01");
  for (const invalid of [0, -1, 1.5, Infinity, 12_001]) {
    assert.equal(buildExposure([source], now, { 1: invalid })[0].monthsRemaining, null);
  }
});

test("zero balances are paid off even when a scenario override is supplied", () => {
  const [item] = buildExposure([liability({ balance: "0" })], now, { 1: 24 });
  assert.equal(item.durationSource, "paid");
  assert.equal(item.monthsRemaining, 0);
});

test("sorting implements avalanche, snowball and duration without mutating source", () => {
  const items = buildExposure([
    liability({ id: 1, name: "Mortgage", balance: "200000", interestRate: "4" }),
    liability({ id: 2, name: "Card", balance: "500", interestRate: "25" }),
    liability({ id: 3, name: "Car", balance: "10000", interestRate: "8" }),
    liability({ id: 4, name: "Unknown", interestRate: null }),
  ], now, { 1: 240, 2: 6, 3: 48 });
  assert.deepEqual(sortExposure(items, "avalanche").map(i => i.id), [2, 3, 1, 4]);
  assert.deepEqual(sortExposure(items, "snowball").map(i => i.id), [2, 4, 3, 1]);
  assert.deepEqual(sortExposure(items, "duration").map(i => i.id), [1, 3, 2, 4]);
  assert.deepEqual(items.map(i => i.id), [1, 2, 3, 4]);
});

test("bar thickness scales proportionally to balance from 5px to 100px", () => {
  assert.equal(getBarHeight(1000, 1000), 100);
  assert.equal(getBarHeight(500, 1000), 50);
  assert.equal(getBarHeight(100, 1000), 10);
  assert.equal(getBarHeight(1, 1000), 5);
  assert.equal(getBarHeight(1000, 0), 5);
});

test("timeline includes current month and exact maximum endpoint across year boundaries", () => {
  assert.deepEqual(getTimelineTicks(3, now).map(t => t.label), ["Oct 2026", "Nov 2026", "Dec 2026", "Jan 2027"]);
  const ticks = getTimelineTicks(361, now);
  assert.equal(ticks[0].month, 0);
  assert.equal(ticks[ticks.length - 1].month, 361);
  assert.ok(ticks.length <= 8);
});
