import assert from "node:assert/strict";
import test from "node:test";
import { getKnownLiabilityApr, summarizeLiabilityRates } from "./liability-rates";

test("distinguishes an unknown APR from an explicit zero APR", () => {
  assert.equal(getKnownLiabilityApr(null), null);
  assert.equal(getKnownLiabilityApr(""), null);
  assert.equal(getKnownLiabilityApr("0"), 0);
});

test("known-rate summaries include explicit zeros and exclude unknown rates", () => {
  assert.deepEqual(summarizeLiabilityRates([
    { balance: "1000", interestRate: "10" },
    { balance: "500", interestRate: "0" },
    { balance: "2000", interestRate: null },
  ]), {
    annualInterest: 100,
    weightedRate: 6.666666666666667,
    unknownRateCount: 1,
  });
});

test("all-unknown APRs do not produce a fake zero weighted rate", () => {
  assert.deepEqual(summarizeLiabilityRates([{ balance: "1000", interestRate: null }]), {
    annualInterest: 0,
    weightedRate: null,
    unknownRateCount: 1,
  });
});
