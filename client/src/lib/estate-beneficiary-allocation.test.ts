import assert from "node:assert/strict";
import test from "node:test";
import { summarizeBeneficiaryAllocations } from "./estate-beneficiary-allocation";

const asset = (id: number, value: string) => ({
  id, value, name: `Account ${id}`, institution: null,
});
const designation = (assetId: number, shares: Array<[string, string]>, hasBeneficiary = true) => ({
  assetId,
  hasBeneficiary,
  beneficiaryName: null,
  beneficiaries: shares.map(([beneficiaryName, allocationPercentage], index) => ({
    id: index + 1, designationId: assetId, userId: "test", assetId,
    beneficiaryName, allocationPercentage, notes: null,
  })),
});

test("splits account values by allocation and groups exact normalized names across accounts", () => {
  const result = summarizeBeneficiaryAllocations(
    [asset(1, "1000"), asset(2, "2000"), asset(3, "400")],
    [designation(1, [["Alex", "60"], ["Sam", "40"]]), designation(2, [[" ALEX ", "100"]])],
  );
  assert.equal(result.totalAssetValue, 3400);
  assert.equal(result.totalAssignedValue, 3000);
  assert.equal(result.totalUnassignedValue, 400);
  assert.equal(result.beneficiaries.length, 2);
  assert.equal(result.beneficiaries[0].name, "Alex");
  assert.equal(result.beneficiaries[0].totalAmount, 2600);
  assert.equal(result.beneficiaries[0].accounts.length, 2);
  assert.equal(result.beneficiaries[1].totalAmount, 400);
  assert.equal(result.unassignedAccounts[0].assetId, 3);
});

test("partial and missing beneficiary details remain unassigned", () => {
  const result = summarizeBeneficiaryAllocations(
    [asset(1, "1000"), asset(2, "2000"), asset(3, "3000")],
    [designation(1, [["Alex", "25"]]), designation(2, []), designation(3, [["Sam", "100"]], false)],
  );
  assert.equal(result.totalAssignedValue, 250);
  assert.equal(result.totalUnassignedValue, 5750);
  assert.deepEqual(new Set(result.unassignedAccounts.map(account => account.reason)), new Set([
    "Partially allocated", "Beneficiary details needed", "No beneficiary assigned",
  ]));
});

test("supports legacy single beneficiaries without multiplying allocation across entries", () => {
  const legacy = { ...designation(1, []), beneficiaryName: "Alex" };
  const result = summarizeBeneficiaryAllocations([asset(1, "1000")], [legacy]);
  assert.equal(result.beneficiaries[0].totalAmount, 1000);
  assert.equal(result.totalUnassignedValue, 0);
});

test("ignores stale designations and does not fuzzy-merge different personal names", () => {
  const result = summarizeBeneficiaryAllocations(
    [asset(1, "100"), asset(2, "100")],
    [designation(1, [["Alex", "100"]]), designation(2, [["Alexa", "100"]]), designation(99, [["Other", "100"]])],
  );
  assert.equal(result.beneficiaries.length, 2);
  assert.equal(result.totalAssignedValue, 200);
});

test("reports excessive saved allocations without silently redistributing them", () => {
  const result = summarizeBeneficiaryAllocations(
    [asset(1, "100")], [designation(1, [["Alex", "80"], ["Sam", "80"]])],
  );
  assert.equal(result.totalAssignedValue, 160);
  assert.equal(result.totalUnassignedValue, 0);
  assert.deepEqual(result.overallocatedAccounts, ["Account 1"]);
});

test("empty assets, zero balances and invalid beneficiary details have safe totals", () => {
  assert.equal(summarizeBeneficiaryAllocations([], []).totalAssetValue, 0);
  const result = summarizeBeneficiaryAllocations(
    [asset(1, "0"), asset(2, "100"), asset(3, "invalid")],
    [designation(1, [["Alex", "100"]]), designation(2, [["", "100"], ["Sam", "invalid"]])],
  );
  assert.equal(result.totalAssetValue, 100);
  assert.equal(result.totalAssignedValue, 0);
  assert.equal(result.totalUnassignedValue, 100);
});
