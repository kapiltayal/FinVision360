import assert from "node:assert/strict";
import test from "node:test";
import { budgetPlanSubtotal, budgetPlanVariance, effectiveBudgetPlanAmount } from "./budget-plan-amounts";

test("uses the populated monthly average when there is no saved plan", () => {
  assert.equal(effectiveBudgetPlanAmount({ average: 4667 }), 4667);
  assert.equal(effectiveBudgetPlanAmount({ average: 251.35 }), 251.35);
  assert.equal(effectiveBudgetPlanAmount({ average: 0 }), 0);
});

test("a saved amount, including explicit zero, overrides the average", () => {
  assert.equal(effectiveBudgetPlanAmount({ planned: 0, average: 4667 }), 0);
  assert.equal(effectiveBudgetPlanAmount({ planned: 5100, average: 4667 }), 5100);
});

test("income and living-expense subtotals count all displayed plan amounts", () => {
  const income = [{ average: 4667 }, { average: 200, planned: 0 }, { average: 100, planned: 300 }];
  const expenses = [{ average: 0 }, { average: 251 }, { average: 127 }, { average: 20 }];
  assert.equal(budgetPlanSubtotal(income), 4967);
  assert.equal(budgetPlanSubtotal(expenses), 398);
  assert.equal(budgetPlanSubtotal([]), 0);
  assert.equal(income[0].average, 4667);
  assert.equal("planned" in income[0], false);
});

test("variance uses the same effective plan as the input and subtotal", () => {
  const row = { average: 251, actual: 200 };
  assert.equal(budgetPlanVariance(row, "expense"), 51);
  assert.equal(budgetPlanVariance(row, "income"), -51);
  assert.equal(budgetPlanVariance({ ...row, planned: 0 }, "expense"), -200);
  assert.equal(budgetPlanVariance({ ...row, planned: 300 }, "income"), -100);
});

test("summary outflows and net include suggested income and expenses alongside debt and goals", () => {
  const income = budgetPlanSubtotal([{ average: 4667 }]);
  const livingExpenses = budgetPlanSubtotal([{ average: 251 }, { average: 127 }, { average: 20 }]);
  const debtPayments = 200;
  const goalContributions = 100;
  const outflows = livingExpenses + debtPayments + goalContributions;
  assert.equal(outflows, 698);
  assert.equal(income - outflows, 3969);
});
