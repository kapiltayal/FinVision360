import assert from "node:assert/strict";
import test from "node:test";
import { includedRetirementAccounts, retirementAccountInclusionSchema, type RetirementAccountPreference } from "../shared/retirement-account-inclusion";

test("new accounts are included by default and preference filtering never mutates source accounts", () => {
  const accounts = [{ id: 1, balance: 100 }, { id: 2, balance: 200 }];
  assert.deepEqual(includedRetirementAccounts(accounts, [], "asset", "net-worth"), accounts);
  const saved: RetirementAccountPreference[] = [
    { assetId: 1, liabilityId: null, netWorthIncluded: false, incomeExpenseIncluded: true },
    { assetId: null, liabilityId: 2, netWorthIncluded: false, incomeExpenseIncluded: false },
  ];
  assert.deepEqual(includedRetirementAccounts(accounts, saved, "asset", "net-worth"), [accounts[1]]);
  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].balance, 100);
});

test("Net Worth and Income/Expense selections are independent and asset/debt IDs cannot collide", () => {
  const preferences: RetirementAccountPreference[] = [
    { assetId: 1, liabilityId: null, netWorthIncluded: false, incomeExpenseIncluded: true },
    { assetId: null, liabilityId: 1, netWorthIncluded: true, incomeExpenseIncluded: false },
  ];
  const rows = [{ id: 1 }];
  assert.equal(includedRetirementAccounts(rows, preferences, "asset", "net-worth").length, 0);
  assert.equal(includedRetirementAccounts(rows, preferences, "asset", "income-expense").length, 1);
  assert.equal(includedRetirementAccounts(rows, preferences, "liability", "net-worth").length, 1);
  assert.equal(includedRetirementAccounts(rows, preferences, "liability", "income-expense").length, 0);
  assert.equal(includedRetirementAccounts([{ id: 3 }], preferences, "asset", "net-worth").length, 1);
});

test("inclusion requests require explicit boolean, positive integer account ID, and known projection", () => {
  const valid = { kind: "asset", accountId: 12, projection: "net-worth", included: false };
  assert.ok(retirementAccountInclusionSchema.safeParse(valid).success);
  for (const invalid of [
    { included: "false" }, { included: null }, { accountId: "12" }, { accountId: -1 },
    { accountId: 1.1 }, { projection: "all" }, { kind: "pension" }, { userId: "someone-else" },
  ]) {
    assert.equal(retirementAccountInclusionSchema.safeParse({ ...valid, ...invalid }).success, false);
  }
});
