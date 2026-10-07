import { sql } from "drizzle-orm";
import type { db } from "./db";
import { userGoals, userGoalsHistory, type UserGoal } from "@shared/schema";
import { monthlySavingsRequired } from "@shared/goal-monthly-savings";

export function buildGoalHistoryRows(goals: UserGoal[], today = new Date()) {
  return goals.map((goal) => {
    const monthlySavings = monthlySavingsRequired(
      Number(goal.targetAmount),
      Number(goal.currentAmount),
      goal.targetDate,
      today,
    );
    return {
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
      monthlySavingsNeeded: monthlySavings === null ? null : monthlySavings.toFixed(2),
    };
  });
}

export async function snapshotUserGoals(
  database: Pick<typeof db, "select" | "insert" | "delete">,
  today = new Date(),
) {
  const goals = await database.select().from(userGoals);
  if (goals.length > 0) {
    await database.insert(userGoalsHistory).values(buildGoalHistoryRows(goals, today));
  }
  // Use calendar months; SQL also handles leap days and month-end boundaries.
  const deleted = await database.delete(userGoalsHistory).where(
    sql`${userGoalsHistory.snapshotAt} < CURRENT_TIMESTAMP - INTERVAL '24 months'`,
  );
  return {
    goalsSnapshotted: goals.length,
    goalsDeleted: deleted.rowCount ?? 0,
  };
}
