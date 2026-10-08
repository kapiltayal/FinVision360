import assert from "node:assert/strict";
import test from "node:test";
import { formatBudgetPlanInput, isValidBudgetPlanDraft } from "./budget-plan-input";

test("formats blurred amounts with thousands separators and rounded whole dollars", () => {
  assert.equal(formatBudgetPlanInput(1234.49), "1,234");
  assert.equal(formatBudgetPlanInput(1234.5), "1,235");
  assert.equal(formatBudgetPlanInput(1234567.89), "1,234,568");
  assert.equal(formatBudgetPlanInput(undefined), "");
});

test("accepts at most two decimal places, including values mid-entry", () => {
  for (const value of ["", ".", ".5", "1.", "1234", "1234.5", "1234.56"]) {
    assert.equal(isValidBudgetPlanDraft(value), true, value);
  }
  for (const value of ["-", "-1", "1.234", "1..2", "1,234.56"]) {
    assert.equal(isValidBudgetPlanDraft(value), false, value);
  }
});
