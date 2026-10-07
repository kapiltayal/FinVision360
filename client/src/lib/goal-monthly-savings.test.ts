import assert from "node:assert/strict";
import test from "node:test";
import { budgetMonthlyGoalRequirement, monthlySavingsRequired } from "./goal-monthly-savings";

const today = new Date(2026, 9, 7);
const goal = { targetAmount: 500000, currentAmount: 100000, targetDate: "2027-11-30" };

test("future months use the same monthly contribution as the Goals page", () => {
  const goalsPageAmount = monthlySavingsRequired(goal.targetAmount, goal.currentAmount, goal.targetDate, today);
  assert.equal(goalsPageAmount, 400000 / 14);
  for (let offset = 0; offset < 14; offset++) {
    const date = new Date(2026, 9 + offset, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    assert.equal(budgetMonthlyGoalRequirement(goal, month, today), goalsPageAmount, month);
  }
});

test("the deadline month is included, but following months have no suggested contribution", () => {
  const midMonthGoal = { ...goal, targetDate: "2027-07-15" };
  assert.equal(
    budgetMonthlyGoalRequirement(midMonthGoal, "2027-07", today),
    monthlySavingsRequired(midMonthGoal.targetAmount, midMonthGoal.currentAmount, midMonthGoal.targetDate, today),
  );
  assert.equal(budgetMonthlyGoalRequirement(midMonthGoal, "2027-08", today), 0);
  assert.equal(budgetMonthlyGoalRequirement(goal, "2027-12", today), 0);
});

test("goals with different deadlines each keep their own consistent monthly amount", () => {
  const secondGoal = { targetAmount: 100000, currentAmount: 50000, targetDate: "2027-12-31" };
  const secondAmount = monthlySavingsRequired(100000, 50000, secondGoal.targetDate, today);
  assert.equal(secondAmount, 50000 / 15);
  const total = 400000 / 14 + 50000 / 15;
  for (const month of ["2026-10", "2026-12", "2027-05", "2027-11"]) {
    assert.equal(
      budgetMonthlyGoalRequirement(goal, month, today) + budgetMonthlyGoalRequirement(secondGoal, month, today),
      total,
    );
  }
});

test("completed and overfunded goals require no further contributions", () => {
  for (const currentAmount of [500000, 600000]) {
    const completedGoal = { ...goal, currentAmount };
    assert.equal(monthlySavingsRequired(500000, currentAmount, goal.targetDate, today), 0);
    assert.equal(budgetMonthlyGoalRequirement(completedGoal, "2027-01", today), 0);
  }
});

test("missing deadlines retain the Goals-page no-deadline state and zero budget default", () => {
  assert.equal(monthlySavingsRequired(500000, 100000, null, today), null);
  assert.equal(budgetMonthlyGoalRequirement({ ...goal, targetDate: null }, "2027-01", today), 0);
});

test("historical budgets retain their original month-based calculation", () => {
  assert.equal(budgetMonthlyGoalRequirement(goal, "2026-09", today), 400000 / 15);
});

test("overdue goals retain the Goals-page catch-up amount but do not auto-populate future months", () => {
  const overdueGoal = { ...goal, targetDate: "2026-09-30" };
  assert.equal(monthlySavingsRequired(500000, 100000, overdueGoal.targetDate, today), 400000);
  assert.equal(budgetMonthlyGoalRequirement(overdueGoal, "2026-11", today), 0);
});
