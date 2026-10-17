import assert from "node:assert/strict";
import test from "node:test";
import { getKnownAssetRate, summarizeAssetRates } from "./asset-rates";

test("missing asset rates are unknown while explicit zero and negative rates are known", () => {
  for (const rate of [undefined, null, "", "   ", "invalid"]) {
    assert.equal(getKnownAssetRate(rate), null);
  }
  assert.equal(getKnownAssetRate("0.00"), 0);
  assert.equal(getKnownAssetRate("-5"), -5);
});

test("asset averages include explicit zero rates but exclude missing rates", () => {
  assert.deepEqual(summarizeAssetRates([
    { value: "1000", interestRate: "6" },
    { value: "2000", interestRate: "0" },
    { value: "7000", interestRate: null },
  ]), { annualReturn: 60, weightedRate: 2, unknownRateCount: 1 });
});

test("all missing asset rates do not produce a fake known zero return", () => {
  assert.deepEqual(summarizeAssetRates([{ value: "100", interestRate: null }]), {
    annualReturn: 0, weightedRate: null, unknownRateCount: 1,
  });
  assert.deepEqual(summarizeAssetRates([{ value: "100", interestRate: "0" }]), {
    annualReturn: 0, weightedRate: 0, unknownRateCount: 0,
  });
});

test("negative asset returns are preserved in the summary", () => {
  assert.deepEqual(summarizeAssetRates([{ value: "1000", interestRate: "-5" }]), {
    annualReturn: -50, weightedRate: -5, unknownRateCount: 0,
  });
});
