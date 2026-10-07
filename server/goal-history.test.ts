import assert from "node:assert/strict";
import test from "node:test";
import { buildGoalHistoryRows } from "./goal-history";
import type { UserGoal } from "@shared/schema";

const today = new Date(2026, 9, 7);
const goal: UserGoal = {
  id: 42,
  userId: "test-user",
  title: "Investment property",
  category: "investment",
  targetAmount: "500000.00",
  currentAmount: "100000.00",
  targetDate: "2027-11-30",
  notes: "Deposit",
  createdAt: new Date(2026, 0, 1),
  updatedAt: new Date(2026, 9, 1),
};

test("goal snapshots copy every source field and store the Goals-page amount rounded to cents", () => {
  assert.deepEqual(buildGoalHistoryRows([goal], today), [{
    userId: goal.userId,
    goalId: goal.id,
    title: goal.title,
    category: goal.category,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: goal.targetDate,
    notes: goal.notes,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    monthlySavingsNeeded: "28571.43",
  }]);
});

test("completed and overfunded goals store zero", () => {
  for (const currentAmount of ["500000.00", "600000.00"]) {
    assert.equal(buildGoalHistoryRows([{ ...goal, currentAmount }], today)[0].monthlySavingsNeeded, "0.00");
  }
});

test("unfinished goals without a deadline store null, not a fabricated amount", () => {
  const snapshot = buildGoalHistoryRows([{ ...goal, targetDate: null, notes: null }], today)[0];
  assert.equal(snapshot.monthlySavingsNeeded, null);
  assert.equal(snapshot.targetDate, null);
  assert.equal(snapshot.notes, null);
});

test("overdue goals retain the Goals-page requirement", () => {
  assert.equal(buildGoalHistoryRows([{ ...goal, targetDate: "2026-09-01" }], today)[0].monthlySavingsNeeded, "400000.00");
});

test("empty source table produces no insert rows", () => {
  assert.deepEqual(buildGoalHistoryRows([], today), []);
});
