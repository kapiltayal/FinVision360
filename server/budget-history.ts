import type { PoolClient } from "pg";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "../shared/budget-period";
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
  return { plans: snapshot.plans, liabilities, goals };
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

// A read never writes defaults. Only the designated close captures them.
export async function buildBudgetClose(client: PoolClient, userId: string, period: string, capturedAt: Date): Promise<BudgetSnapshot> {
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
    `SELECT type, COALESCE(NULLIF(subcategory,''),'unassigned') AS category, SUM(amount) AS total
     FROM transactions WHERE user_id=$1 AND date >= $2::date AND date < $3::date GROUP BY type, category`,
    [userId, earliest, start],
  );
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
  const plans = new Map<string, BudgetPlanLine>();
  const add = (planKey: string, amount: number, entityMetadata: BudgetPlanLine["entityMetadata"] = null) =>
    plans.set(planKey, { planKey, plannedAmount: Math.round(amount * 100) / 100, entityMetadata });
  for (const category of INCOME_CATEGORIES) add(`income:${category}`, 0);
  for (const category of EXPENSE_CATEGORIES) add(`expense:${category}`, 0);
  for (const row of averages) {
    if (row.type === "expense" && ["debt_payment", "savings_transfer"].includes(row.category)) continue;
    add(`${row.type}:${row.category}`, count ? Number(row.total) / count : 0);
  }
  const { rows: periodCategories } = await client.query(
    `SELECT DISTINCT type, COALESCE(NULLIF(subcategory,''),'unassigned') AS category FROM transactions
     WHERE user_id=$1 AND date >= $2::date AND date < $2::date + INTERVAL '1 month'`, [userId, start],
  );
  for (const row of periodCategories) {
    if (row.type === "expense" && ["debt_payment", "savings_transfer"].includes(row.category)) continue;
    const key = `${row.type}:${row.category}`;
    if (!plans.has(key)) add(key, 0);
  }
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
