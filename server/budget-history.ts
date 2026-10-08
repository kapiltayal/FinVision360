import type { PoolClient } from "pg";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, normalizeBudgetPlanKey } from "../shared/budget-period";
import { monthlySavingsRequired } from "../shared/goal-monthly-savings";

export type BudgetPlanLine = {
  planKey: string;
  plannedAmount: number;
  entityMetadata?: { name: string; category: string } | null;
};
export type DebtSnapshot = {
  id: number; name: string; category: string; balance: number | null;
  minimumPayment: number | null; detailsUnavailable?: boolean;
};
export type GoalSnapshot = {
  id: number; title: string; category: string; targetAmount: number | null;
  currentAmount: number | null; targetDate: string | null;
  monthlySavingsNeeded: number | null; detailsUnavailable?: boolean;
};
export type BudgetSnapshot = {
  plans: BudgetPlanLine[]; liabilities: DebtSnapshot[]; goals: GoalSnapshot[];
  source?: "legacy_reconstructed";
};

export function preserveSavedEntityRows(snapshot: BudgetSnapshot): BudgetSnapshot {
  const liabilities = [...snapshot.liabilities];
  const goals = [...snapshot.goals];
  for (const plan of snapshot.plans) {
    const match = /^(debt|goal):(\d+)$/.exec(plan.planKey);
    if (!match) continue;
    const id = Number(match[2]);
    const metadata = plan.entityMetadata;
    if (match[1] === "debt" && !liabilities.some((row) => row.id === id)) {
      liabilities.push({
        id, name: metadata?.name ?? `Archived debt #${id}`,
        category: metadata?.category ?? "Historical details unavailable",
        balance: null, minimumPayment: null, detailsUnavailable: true,
      });
    }
    if (match[1] === "goal" && !goals.some((row) => row.id === id)) {
      goals.push({
        id, title: metadata?.name ?? `Archived goal #${id}`,
        category: metadata?.category ?? "Historical details unavailable",
        targetAmount: null, currentAmount: null, targetDate: null,
        monthlySavingsNeeded: null, detailsUnavailable: true,
      });
    }
  }
  return {
    plans: snapshot.plans, liabilities, goals,
    ...(snapshot.source ? { source: snapshot.source } : {}),
  };
}

export async function budgetEntityMetadata(client: Pick<PoolClient, "query">, userId: string, key: string) {
  const match = /^(debt|goal):(\d+)$/.exec(key);
  if (!match) return null;
  const { rows } = await client.query(
    match[1] === "debt"
      ? "SELECT name, category FROM liabilities WHERE user_id=$1 AND id=$2"
      : "SELECT title AS name, category FROM user_goals WHERE user_id=$1 AND id=$2",
    [userId, Number(match[2])],
  );
  return rows[0] ? { name: rows[0].name, category: rows[0].category } : null;
}

async function transactionPlanDefaults(client: Pick<PoolClient, "query">, userId: string, period: string) {
  const start = `${period}-01`;
  const [year, month] = period.split("-").map(Number);
  const earliest = new Date(Date.UTC(year, month - 13, 1)).toISOString().slice(0, 10);
  const { rows: boundary } = await client.query(
    "SELECT MIN(date)::text AS first FROM transactions WHERE user_id=$1 AND date < $2::date",
    [userId, start],
  );
  const first = boundary[0]?.first?.slice(0, 7);
  const count = first ? Math.min(12, (year - Number(first.slice(0, 4))) * 12 + month - Number(first.slice(5, 7))) : 0;
  const { rows: averages } = await client.query(
    `SELECT type, LOWER(COALESCE(NULLIF(subcategory,''),'unassigned')) AS category, SUM(amount) AS total
     FROM transactions WHERE user_id=$1 AND date >= $2::date AND date < $3::date GROUP BY type, LOWER(COALESCE(NULLIF(subcategory,''),'unassigned'))`,
    [userId, earliest, start],
  );
  const planRows = new Map<string, BudgetPlanLine>();
  const add = (planKey: string, amount: number) =>
    planRows.set(planKey, { planKey, plannedAmount: Math.round(amount * 100) / 100 });
  for (const category of INCOME_CATEGORIES) add(`income:${category}`, 0);
  for (const category of EXPENSE_CATEGORIES) add(`expense:${category}`, 0);
  const totalsByPlan = new Map<string, number>();
  for (const row of averages) {
    const category = normalizeBudgetPlanKey(`${row.type}:${row.category}`).slice(`${row.type}:`.length);
    if (row.type === "expense" && ["debt_payment", "savings_transfer"].includes(category)) continue;
    const key = normalizeBudgetPlanKey(`${row.type}:${category}`);
    totalsByPlan.set(key, (totalsByPlan.get(key) ?? 0) + Number(row.total));
  }
  totalsByPlan.forEach((total, key) => add(key, count ? total / count : 0));
  const { rows: periodCategories } = await client.query(
    `SELECT DISTINCT type, LOWER(COALESCE(NULLIF(subcategory,''),'unassigned')) AS category FROM transactions
     WHERE user_id=$1 AND date >= $2::date AND date < $2::date + INTERVAL '1 month'`, [userId, start],
  );
  for (const row of periodCategories) {
    const category = normalizeBudgetPlanKey(`${row.type}:${row.category}`).slice(`${row.type}:`.length);
    if (row.type === "expense" && ["debt_payment", "savings_transfer"].includes(category)) continue;
    const key = normalizeBudgetPlanKey(`${row.type}:${category}`);
    if (!planRows.has(key)) add(key, 0);
  }
  return planRows;
}

/**
 * Use only a unique, matching pair of legacy debt and goal backups made on
 * the first of the month following the requested budget period. Transaction
 * plan suggestions are rebuilt from that period's own preceding 12 complete
 * months, and explicit saved rows still override them.
 */
export async function legacyBudgetClose(
  client: Pick<PoolClient, "query">,
  userId: string,
  period: string,
): Promise<{ payload: BudgetSnapshot; capturedAt: Date } | null> {
  const [year, month] = period.split("-").map(Number);
  const followingMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const { rows: candidates } = await client.query(
    `SELECT l.snapshot_at, count(*)::int AS liability_count,
       (SELECT count(*)::int FROM user_goals_history g
        WHERE g.user_id=$1 AND g.snapshot_at=l.snapshot_at) AS goal_count,
       to_char(l.snapshot_at, 'YYYY-MM-DD HH24:MI:SS.US') AS snapshot_key
     FROM liability_history l
     WHERE l.user_id=$1 AND l.snapshot_at >= $2::date
       AND l.snapshot_at < $2::date + INTERVAL '1 day'
     GROUP BY l.snapshot_at
     HAVING count(*) > 0 AND (SELECT count(*) FROM user_goals_history g
       WHERE g.user_id=$1 AND g.snapshot_at=l.snapshot_at) > 0
     ORDER BY l.snapshot_at`,
    [userId, followingMonth],
  );
  // If there are multiple runs that day, timestamps alone cannot identify
  // which one closed the period; leave the archive explicitly unavailable.
  if (candidates.length !== 1) return null;
  const candidate = candidates[0];
  const [{ rows: debtRows }, { rows: goalRows }, planRows] = await Promise.all([
    client.query(
      `SELECT liability_id AS id,name,category,balance,minimum_payment
       FROM liability_history WHERE user_id=$1 AND snapshot_at=$2::timestamp ORDER BY liability_id`,
      [userId, candidate.snapshot_key],
    ),
    client.query(
      `SELECT goal_id AS id,title,category,target_amount,current_amount,target_date::text,
              monthly_savings_needed
       FROM user_goals_history WHERE user_id=$1 AND snapshot_at=$2::timestamp ORDER BY goal_id`,
      [userId, candidate.snapshot_key],
    ),
    transactionPlanDefaults(client, userId, period),
  ]);
  const { rows: savedPlans } = await client.query(
    `SELECT plan_key,planned_amount,entity_metadata FROM budget_plans
     WHERE user_id=$1 AND month=$2::date`, [userId, `${period}-01`],
  );
  for (const row of debtRows) {
    const key = `debt:${row.id}`;
    planRows.set(key, {
      planKey: key, plannedAmount: Math.round(Number(row.minimum_payment ?? 0) * 100) / 100,
      entityMetadata: { name: row.name, category: row.category },
    });
  }
  for (const row of goalRows) {
    const key = `goal:${row.id}`;
    const activeInPeriod = row.target_date && row.target_date.slice(0, 7) >= period;
    planRows.set(key, {
      planKey: key,
      plannedAmount: activeInPeriod ? Math.round(Number(row.monthly_savings_needed ?? 0) * 100) / 100 : 0,
      entityMetadata: { name: row.title, category: row.category },
    });
  }
  const savedByKey = new Map<string, { amount: number; entityMetadata: BudgetPlanLine["entityMetadata"] }>();
  for (const row of savedPlans) {
    const key = normalizeBudgetPlanKey(row.plan_key);
    const previous = savedByKey.get(key);
    savedByKey.set(key, {
      amount: (previous?.amount ?? 0) + Number(row.planned_amount),
      entityMetadata: row.entity_metadata ?? previous?.entityMetadata ?? planRows.get(key)?.entityMetadata,
    });
  }
  savedByKey.forEach((row, key) =>
    planRows.set(key, { planKey: key, plannedAmount: row.amount, entityMetadata: row.entityMetadata }),
  );
  const snapshotAt = candidate.snapshot_at instanceof Date
    ? candidate.snapshot_at
    : new Date(candidate.snapshot_at);
  return {
    payload: preserveSavedEntityRows({
      source: "legacy_reconstructed",
      plans: Array.from(planRows.values()), liabilities: debtRows.map((row) => ({
        id: row.id, name: row.name, category: row.category, balance: Number(row.balance),
        minimumPayment: Number(row.minimum_payment ?? 0),
      })), goals: goalRows.map((row) => ({
        id: row.id, title: row.title, category: row.category, targetAmount: Number(row.target_amount),
        currentAmount: Number(row.current_amount), targetDate: row.target_date,
        monthlySavingsNeeded: row.monthly_savings_needed === null ? null : Number(row.monthly_savings_needed),
      })),
    }),
    capturedAt: snapshotAt,
  };
}

// A read never writes defaults. Only the designated close captures them.
export async function buildBudgetClose(client: PoolClient, userId: string, period: string, capturedAt: Date): Promise<BudgetSnapshot> {
  const start = `${period}-01`;
  const { rows: saved } = await client.query(
    "SELECT plan_key, planned_amount, entity_metadata FROM budget_plans WHERE user_id=$1 AND month=$2::date",
    [userId, start],
  );
  const { rows: debts } = await client.query(
    "SELECT id,name,category,balance,minimum_payment FROM liabilities WHERE user_id=$1 ORDER BY id", [userId],
  );
  const { rows: goals } = await client.query(
    "SELECT id,title,category,target_amount,current_amount,target_date::text FROM user_goals WHERE user_id=$1 ORDER BY id", [userId],
  );
  const plans = await transactionPlanDefaults(client, userId, period);
  const add = (planKey: string, amount: number, entityMetadata: BudgetPlanLine["entityMetadata"] = null) =>
    plans.set(planKey, { planKey, plannedAmount: Math.round(amount * 100) / 100, entityMetadata });
  const liabilityRows: DebtSnapshot[] = debts.map((row) => {
    add(`debt:${row.id}`, Number(row.minimum_payment ?? 0), { name: row.name, category: row.category });
    return { id: row.id, name: row.name, category: row.category, balance: Number(row.balance), minimumPayment: Number(row.minimum_payment ?? 0) };
  });
  const goalRows: GoalSnapshot[] = goals.map((row) => {
    const needed = monthlySavingsRequired(Number(row.target_amount), Number(row.current_amount), row.target_date, capturedAt);
    add(`goal:${row.id}`, row.target_date && row.target_date.slice(0, 7) >= period ? needed ?? 0 : 0, { name: row.title, category: row.category });
    return { id: row.id, title: row.title, category: row.category, targetAmount: Number(row.target_amount), currentAmount: Number(row.current_amount), targetDate: row.target_date, monthlySavingsNeeded: needed === null ? null : Math.round(needed * 100) / 100 };
  });
  for (const row of saved) {
    add(row.plan_key, Number(row.planned_amount), row.entity_metadata ?? plans.get(row.plan_key)?.entityMetadata);
  }
  return preserveSavedEntityRows({ plans: Array.from(plans.values()), liabilities: liabilityRows, goals: goalRows });
}
