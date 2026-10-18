import type { Pool, PoolClient } from "pg";

export class AllocationError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

export const CASH_CATEGORIES = ["bank_account", "savings_account", "cash", "Checking Account", "Savings Account", "Cash & Digital Wallets"];

/** Keep the original current_amount as legacy funding; migration never guesses a source. */
export async function ensureGoalAllocationSchema(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(57093)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS goal_allocations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        goal_id INTEGER NOT NULL REFERENCES user_goals(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL CONSTRAINT goal_allocations_amount_check CHECK (amount > 0),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT goal_allocations_user_pair_unique UNIQUE(user_id, asset_id, goal_id)
      );
      CREATE OR REPLACE VIEW goal_funding AS
      SELECT g.id,g.user_id,g.title,g.category,g.target_amount,
        (g.current_amount + COALESCE(a.amount,0))::numeric(12,2) AS current_amount,
        g.current_amount AS legacy_amount, COALESCE(a.amount,0)::numeric(12,2) AS allocated_amount,
        g.target_date,g.notes,g.created_at,g.updated_at
      FROM user_goals g LEFT JOIN (
        SELECT user_id,goal_id,SUM(amount) AS amount FROM goal_allocations GROUP BY user_id,goal_id
      ) a ON a.goal_id=g.id AND a.user_id=g.user_id;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function withFundingLock<T>(pool: Pool, userId: string, action: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize across all account/goal pairs, including concurrent mappings and deletes.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 93))", [userId]);
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export function moneyCents(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") ||
      String(value).trim() === "" || !/^\d+(\.\d{1,2})?$/.test(String(value))) {
    throw new AllocationError("Enter a valid non-negative amount with at most two decimal places.");
  }
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents > 999_999_999_999) throw new AllocationError("Amount is too large.");
  return cents;
}

export async function saveAllocation(pool: Pool, userId: string, input: any) {
  const assetId = Number(input?.assetId), goalId = Number(input?.goalId);
  if (!Number.isSafeInteger(assetId) || assetId <= 0 || !Number.isSafeInteger(goalId) || goalId <= 0) {
    throw new AllocationError("Choose an account and goal.");
  }
  const amount = moneyCents(input.amount), mapping = moneyCents(input.legacyAmount ?? 0);
  if (amount === 0) throw new AllocationError("Amount must be greater than zero. Use Remove to release a connection.");
  return withFundingLock(pool, userId, async (client) => {
    const { rows: [asset] } = await client.query("SELECT * FROM assets WHERE id=$1 AND user_id=$2 FOR UPDATE", [assetId, userId]);
    const { rows: [goal] } = await client.query("SELECT * FROM user_goals WHERE id=$1 AND user_id=$2 FOR UPDATE", [goalId, userId]);
    if (!asset || !goal) throw new AllocationError("Account or goal not found.", 404);
    const { rows: [totals] } = await client.query(`
      SELECT COALESCE(SUM(amount) FILTER (WHERE asset_id=$2),0) AS account_total,
        COALESCE(SUM(amount) FILTER (WHERE goal_id=$3),0) AS goal_total,
        COALESCE(SUM(amount) FILTER (WHERE asset_id=$2 AND goal_id=$3),0) AS previous
      FROM goal_allocations WHERE user_id=$1`, [userId, assetId, goalId]);
    const previous = moneyCents(totals.previous), increase = amount - previous;
    if (!CASH_CATEGORIES.includes(asset.category) && increase > 0) throw new AllocationError("Only checking, savings, and cash accounts can fund goals.");
    const legacy = moneyCents(goal.current_amount);
    if (mapping > legacy || mapping > Math.max(0, increase)) throw new AllocationError("Mapping must use available legacy funding and increase the linked amount by at least that much.");
    if (increase > 0 && moneyCents(totals.account_total) + increase > Math.round(Number(asset.value) * 100)) {
      throw new AllocationError("This account does not have enough unallocated cash. Reduce existing allocations to resolve any deficit.");
    }
    const funded = legacy + moneyCents(totals.goal_total);
    if (increase - mapping > 0 && funded + increase - mapping > moneyCents(goal.target_amount)) {
      throw new AllocationError("This allocation exceeds the goal's remaining target.");
    }
    if (mapping > 0) await client.query("UPDATE user_goals SET current_amount=current_amount-$3,updated_at=NOW() WHERE id=$1 AND user_id=$2", [goalId, userId, (mapping / 100).toFixed(2)]);
    const { rows: [saved] } = await client.query(`
      INSERT INTO goal_allocations(user_id,asset_id,goal_id,amount) VALUES($1,$2,$3,$4)
      ON CONFLICT(user_id,asset_id,goal_id) DO UPDATE SET amount=EXCLUDED.amount,updated_at=NOW()
      RETURNING id,asset_id AS "assetId",goal_id AS "goalId",amount`, [userId, assetId, goalId, (amount / 100).toFixed(2)]);
    return saved;
  });
}

export async function allocationAccounts(pool: Pool, userId: string) {
  const { rows } = await pool.query(`
    SELECT a.id,a.name,a.category,a.institution,a.value,
      COALESCE(SUM(g.amount),0)::numeric(15,2) AS "allocatedAmount",
      GREATEST(0,a.value-COALESCE(SUM(g.amount),0))::numeric(15,2) AS "unallocatedAmount",
      GREATEST(0,COALESCE(SUM(g.amount),0)-a.value)::numeric(15,2) AS "deficitAmount"
    FROM assets a LEFT JOIN goal_allocations g ON g.asset_id=a.id AND g.user_id=a.user_id
    WHERE a.user_id=$1 AND (a.category=ANY($2::text[]) OR EXISTS
      (SELECT 1 FROM goal_allocations x WHERE x.asset_id=a.id AND x.user_id=a.user_id))
    GROUP BY a.id ORDER BY a.name`, [userId, CASH_CATEGORIES]);
  return rows;
}
