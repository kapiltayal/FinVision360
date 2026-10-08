import type { Pool, PoolClient } from "pg";
import { previousBudgetMonth } from "../shared/budget-period";
import { monthlySavingsRequired } from "../shared/goal-monthly-savings";
import { buildBudgetClose } from "./budget-history";

export class CloseWindowError extends Error {}

// Called within one transaction: every history table and the success marker
// commit together, or none do. The lock serializes concurrent cron retries.
export async function monthlyBackupTransaction(client: PoolClient, now = new Date()) {
  const period = previousBudgetMonth(now);
  const periodDate = `${period}-01`;
  await client.query("SELECT pg_advisory_xact_lock(57001)");
  const { rows: existing } = await client.query(
    "SELECT result FROM budget_close_runs WHERE period_month=$1::date", [periodDate],
  );
  if (existing[0]) return { ...existing[0].result, alreadyCompleted: true };
  // Do not fabricate an old close from live records days/weeks later.
  if (now.getUTCDate() !== 1) {
    throw new CloseWindowError("The monthly close must be captured on the first UTC day of the following month. No historical snapshot was created from current data.");
  }
  const { rowCount: assetsSnapshotted } = await client.query(
    `INSERT INTO asset_history (user_id,asset_id,name,category,value,interest_rate,institution,notes,snapshot_at)
     SELECT user_id,id,name,category,value,interest_rate,institution,notes,$1 FROM assets`, [now],
  );
  const { rowCount: liabilitiesSnapshotted } = await client.query(
    `INSERT INTO liability_history (user_id,liability_id,name,category,balance,interest_rate,minimum_payment,maturity_date,institution,notes,snapshot_at)
     SELECT user_id,id,name,category,balance,interest_rate,minimum_payment,maturity_date,institution,notes,$1 FROM liabilities`, [now],
  );
  const { rows: goals } = await client.query("SELECT *, target_date::text AS target_date FROM user_goals");
  for (const goal of goals) {
    const required = monthlySavingsRequired(Number(goal.target_amount), Number(goal.current_amount), goal.target_date, now);
    await client.query(
      `INSERT INTO user_goals_history (user_id,goal_id,title,category,target_amount,current_amount,target_date,notes,created_at,updated_at,monthly_savings_needed,snapshot_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [goal.user_id, goal.id, goal.title, goal.category, goal.target_amount, goal.current_amount, goal.target_date,
        goal.notes, goal.created_at, goal.updated_at, required === null ? null : required.toFixed(2), now],
    );
  }
  const { rows: users } = await client.query("SELECT id FROM users");
  for (const user of users) {
    const payload = await buildBudgetClose(client, user.id, period, now);
    await client.query(
      "INSERT INTO budget_month_closes (user_id,period_month,snapshot_at,payload) VALUES ($1,$2::date,$3,$4::jsonb)",
      [user.id, periodDate, now, JSON.stringify(payload)],
    );
  }
  const counts: Record<string, number> = {};
  for (const [table, label] of [
    ["asset_history", "assetsDeleted"], ["liability_history", "liabilitiesDeleted"],
    ["user_goals_history", "goalsDeleted"], ["budget_month_closes", "budgetClosesDeleted"],
    ["budget_close_runs", "closeRunsDeleted"],
  ]) {
    // All identifiers are constants, not user input.
    const { rowCount } = await client.query(`DELETE FROM ${table} WHERE snapshot_at < $1::timestamptz - INTERVAL '24 months'`, [now]);
    counts[label] = rowCount ?? 0;
  }
  const result = {
    message: "Monthly backup completed", periodMonth: period, snapshotAt: now.toISOString(),
    assetsSnapshotted: assetsSnapshotted ?? 0, liabilitiesSnapshotted: liabilitiesSnapshotted ?? 0,
    goalsSnapshotted: goals.length, budgetPlansSnapshotted: users.length, ...counts,
  };
  await client.query(
    "INSERT INTO budget_close_runs (period_month,snapshot_at,result) VALUES ($1::date,$2,$3::jsonb)",
    [periodDate, now, JSON.stringify(result)],
  );
  return { ...result, alreadyCompleted: false };
}

export async function runMonthlyBackup(pool: Pool, now = new Date()) {
  const client = await pool.connect();
  try {
    // Acquire before BEGIN so a waiter starts its repeatable-read snapshot
    // after the previous run has committed its success marker.
    await client.query("SELECT pg_advisory_lock(57001)");
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const result = await monthlyBackupTransaction(client, now);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock(57001)");
    client.release();
  }
}
