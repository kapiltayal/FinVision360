import assert from "node:assert/strict";
import test from "node:test";
import { buildRetirementNetWorthProjection } from "./retirement-projection";

function project(rate: string | null, override?: string) {
  return buildRetirementNetWorthProjection({
    retirementAge: 65, currentAge: 55,
    assets: [{
      id: 1, name: "Savings", category: "Savings Account", value: "100000",
      interestRate: rate, institution: null, notes: null,
    }],
    liabilities: [],
    assetTypes: [{ parentCategory: "Cash", subCategory: "Savings Account", rateOfReturn: "0.03" }],
    liabilityTypes: [],
    assetOverrides: override === undefined ? [] : [{ assetId: 1, rateOfReturn: override }],
    projectionEntries: [],
  });
}

test("saved zero return remains zero instead of compounding at the category default", () => {
  for (const zero of ["0", "0.00"]) {
    const result = project(zero);
    assert.equal(result.assets[0].returnRate, 0);
    assert.equal(result.assets[0].rateSource, "account");
    assert.equal(result.assets[0].projectedValue, 100000);
    assert.equal(result.projectedNetWorth, 100000);
    assert.deepEqual(result.assumptions, []);
  }
});

test("missing and invalid account returns still use the decimal category default", () => {
  for (const missing of [null, "", "   ", "invalid"]) {
    const result = project(missing);
    assert.equal(result.assets[0].returnRate, 3);
    assert.equal(result.assets[0].rateSource, "asset-type-default");
    assert.ok(Math.abs(result.assets[0].projectedValue - 100000 * 1.03 ** 10) < 0.01);
    assert.equal(result.assumptions.length, 1);
  }
});

test("projection overrides keep precedence over account rates, including explicit zeros", () => {
  for (const [account, override, expected] of [["0", "7", 7], ["5", "0", 0]] as const) {
    const result = project(account, override);
    assert.equal(result.assets[0].returnRate, expected);
    assert.equal(result.assets[0].rateSource, "override");
  }
  assert.equal(project("5").assets[0].returnRate, 5);
  assert.equal(project("5").assets[0].rateSource, "account");
});

test("missing debt APR stays null while explicit zero remains a usable rate", () => {
  for (const rate of [null, "", "   ", "invalid", "0", "6"]) {
    const result = buildRetirementNetWorthProjection({
      retirementAge: 56, currentAge: 55, assets: [], assetTypes: [], assetOverrides: [],
      liabilities: [{
        id: 1, name: "Loan", category: "Loan", balance: "10000",
        interestRate: rate, minimumPayment: "100", maturityDate: null, institution: null,
      }],
      liabilityTypes: [], projectionEntries: [],
    });
    const debt = result.liabilities[0];
    if (rate === "0" || rate === "6") {
      assert.equal(debt.interestRate, Number(rate));
      assert.equal(debt.status, "remaining");
      assert.ok(debt.projectedBalance < 10000);
      if (rate === "0") assert.equal(debt.projectedBalance, 8800);
    } else {
      assert.equal(debt.interestRate, null);
      assert.equal(debt.status, "unknown");
      assert.equal(debt.projectedBalance, 10000);
      assert.equal(result.projectedLiabilityTotal, 10000);
      assert.ok(result.assumptions.some(row => row.missingData.includes("Interest rate")));
    }
  }
});
