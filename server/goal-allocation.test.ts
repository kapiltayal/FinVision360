import assert from "node:assert/strict";
import test from "node:test";
import { moneyCents } from "./goal-allocation";

test("funding amounts validate exact cents instead of accepting empty, negative or non-finite values", () => {
  for (const value of [null, "", " ", -1, NaN, Infinity, "1.001", {}, "1e3", "10000000000"]) {
    assert.throws(() => moneyCents(value));
  }
  assert.equal(moneyCents("0.00"), 0);
  assert.equal(moneyCents("15.29"), 1529);
});
