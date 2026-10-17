import assert from "node:assert/strict";
import test from "node:test";
import { parseOptionalInterestRate } from "./liability-apr";

test("blank or missing liability APR is preserved as unknown", () => {
  assert.deepEqual(parseOptionalInterestRate(undefined), { value: null });
  assert.deepEqual(parseOptionalInterestRate(null), { value: null });
  assert.deepEqual(parseOptionalInterestRate(""), { value: null });
  assert.deepEqual(parseOptionalInterestRate("   "), { value: null });
});

test("explicit 0% remains distinct from an unknown APR", () => {
  assert.deepEqual(parseOptionalInterestRate("0"), { value: "0.00" });
  assert.deepEqual(parseOptionalInterestRate(0), { value: "0.00" });
});

test("valid rates are normalized and invalid values are rejected", () => {
  assert.deepEqual(parseOptionalInterestRate("5.5"), { value: "5.50" });
  for (const value of ["-1", "1000", "bad", Number.NaN, Number.POSITIVE_INFINITY, {}]) {
    assert.ok(parseOptionalInterestRate(value).error);
  }
});
