import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq, sql } from "drizzle-orm";
import { userGoals, userGoalsHistory, users } from "@shared/schema";
import { snapshotUserGoals } from "./goal-history";

test("goal backup persists snapshots, prunes only history older than 24 months, and survives source deletion", {
  skip: process.env.RUN_DB_TESTS !== "1",
}, async () => {
  const { db, pool } = await import("./db");
  const rollback = new Error("Rollback verification fixtures");
  try {
    await assert.rejects(db.transaction(async (tx) => {
      const userId = randomUUID();
      await tx.insert(users).values({ id: userId });
      const [goal] = await tx.insert(userGoals).values({
        userId,
        title: "Goal history verification",
        category: "savings",
        targetAmount: "500000.00",
        currentAmount: "100000.00",
        targetDate: "2027-11-30",
        notes: "Snapshot test",
      }).returning();

      const fixture = {
        userId,
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
      };
      await tx.insert(userGoalsHistory).values([
        { ...fixture, snapshotAt: sql`CURRENT_TIMESTAMP - INTERVAL '24 months' - INTERVAL '1 second'` },
        { ...fixture, snapshotAt: sql`CURRENT_TIMESTAMP - INTERVAL '24 months'` },
        { ...fixture, snapshotAt: sql`CURRENT_TIMESTAMP - INTERVAL '23 months'` },
      ]);

      const [{ count: sourceCount }] = await tx.select({ count: sql<number>`COUNT(*)::int` }).from(userGoals);
      const stats = await snapshotUserGoals(tx, new Date(2026, 9, 7));
      assert.equal(stats.goalsSnapshotted, sourceCount);
      assert.ok(stats.goalsDeleted >= 1);

      const snapshots = await tx.select().from(userGoalsHistory).where(eq(userGoalsHistory.userId, userId));
      assert.equal(snapshots.length, 3, "keep the boundary row, recent history and the new snapshot");
      const current = snapshots.find((row) => row.snapshotAt.getTime() > Date.now() - 60000);
      assert.ok(current, "database default supplies snapshot_at");
      assert.equal(current.goalId, goal.id);
      assert.equal(current.monthlySavingsNeeded, "28571.43");
      assert.equal(current.title, goal.title);
      assert.equal(current.targetDate, goal.targetDate);
      assert.equal(current.createdAt.getTime(), goal.createdAt.getTime());
      assert.equal(current.updatedAt.getTime(), goal.updatedAt.getTime());

      await tx.update(userGoals).set({ targetAmount: "900000.00" }).where(eq(userGoals.id, goal.id));
      await tx.delete(userGoals).where(eq(userGoals.id, goal.id));
      const retained = await tx.select().from(userGoalsHistory).where(eq(userGoalsHistory.userId, userId));
      assert.equal(retained.length, 3);
      assert.ok(retained.every((row) => row.targetAmount === "500000.00" && row.monthlySavingsNeeded === "28571.43"));
      // Undo all fixture inserts, snapshots and pruning, including other users' rows.
      throw rollback;
    }), (error: unknown) => error === rollback);
  } finally {
    await pool.end();
  }
});
