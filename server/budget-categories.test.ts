import assert from "node:assert/strict";
import test from "node:test";
import { categoryPlansById, budgetActualsById } from "./budget-categories";
import { normalizeBudgetPlanKey } from "../shared/budget-period";

test("legacy saved aliases combine under one ID; explicit ID zero supersedes them", () => {
  const legacy = [
    { plan_key: "expense:groceries", transaction_type_id: 21, planned_amount: "15" },
    { plan_key: "expense:Groceries", transaction_type_id: 21, planned_amount: "25" },
    { plan_key: "goal:22", planned_amount: "50" },
  ];
  assert.equal(categoryPlansById(legacy)[0].plannedAmount, 40);
  const plans = categoryPlansById([...legacy, { plan_key: "expense:category:21", transaction_type_id: 21, planned_amount: "0" }]);
  assert.equal(plans.find((p) => p.planKey === "expense:category:21")?.plannedAmount, 0);
  assert.equal(plans.find((p) => p.planKey === "goal:22")?.plannedAmount, 50);
  assert.equal(normalizeBudgetPlanKey("expense:category:21"), "expense:category:21");
});

test("actuals aggregate by ID despite different category text", () => {
  const rows = budgetActualsById([
    { type: "expense", transaction_type_id: 21, category_name: "Groceries", actual_amount: 10 },
    { type: "expense", transaction_type_id: 21, category_name: "Groceries", actual_amount: 20 },
    { type: "expense", transaction_type_id: null, actual_amount: 5 },
  ]);
  assert.equal(rows[0].category, "category:21");
  assert.equal(rows[0].amount, 30);
  assert.equal(rows[1].categoryName, "Unassigned");
});
