import type { PoolClient } from "pg";
import { budgetCategoryPlanKey, parseBudgetCategoryPlanKey, type BudgetCategory } from "../shared/budget-categories";
import type { BudgetPlanLine } from "./budget-history";

export async function loadBudgetCategories(client: Pick<PoolClient, "query">): Promise<BudgetCategory[]> {
  const { rows } = await client.query(
    `SELECT id, lower(type) AS type, category AS name, parent_category
     FROM transaction_type_list WHERE lower(type) IN ('income','expense')
     ORDER BY lower(type), parent_category, category, id`,
  );
  return rows.map((row) => ({
    id: Number(row.id), type: row.type, name: row.name, parentCategory: row.parent_category,
  }));
}

export function categoryPlansById(rows: any[]): BudgetPlanLine[] {
  const plans = new Map<string, BudgetPlanLine>();
  // Sum legacy aliases without losing saved money. A new explicit ID-based
  // override supersedes legacy rows, including an intentionally saved zero.
  for (const row of rows) {
    const type = row.plan_key.split(":")[0];
    const key = row.transaction_type_id == null ? row.plan_key : budgetCategoryPlanKey(type, Number(row.transaction_type_id));
    if (parseBudgetCategoryPlanKey(row.plan_key)) continue;
    const previous = plans.get(key);
    plans.set(key, {
      planKey: key, plannedAmount: (previous?.plannedAmount ?? 0) + Number(row.planned_amount),
      entityMetadata: row.entity_metadata,
    });
  }
  for (const row of rows) {
    if (!parseBudgetCategoryPlanKey(row.plan_key)) continue;
    plans.set(row.plan_key, {
      planKey: row.plan_key, plannedAmount: Number(row.planned_amount), entityMetadata: row.entity_metadata,
    });
  }
  return Array.from(plans.values());
}

export async function validBudgetCategoryKey(client: Pick<PoolClient, "query">, key: string) {
  if (!/^(income|expense):/.test(key)) return true; // debt/goal behavior is unchanged
  if (/^(income|expense):unassigned$/.test(key)) return true;
  const parsed = parseBudgetCategoryPlanKey(key);
  if (!parsed) return false;
  const { rows } = await client.query(
    "SELECT id FROM transaction_type_list WHERE id=$1 AND lower(type)=$2", [parsed.id, parsed.type],
  );
  return rows.length === 1;
}

export function budgetActualsById(rows: any[]) {
  const actuals = new Map<string, { type: string; category: string; categoryId: number | null; categoryName: string; amount: number }>();
  for (const row of rows) {
    const id = row.transaction_type_id == null ? null : Number(row.transaction_type_id);
    const key = budgetCategoryPlanKey(row.type, id);
    const previous = actuals.get(key);
    actuals.set(key, {
      type: row.type, category: id == null ? "unassigned" : `category:${id}`, categoryId: id,
      categoryName: row.category_name ?? "Unassigned",
      amount: (previous?.amount ?? 0) + Number(row.actual_amount),
    });
  }
  return Array.from(actuals.values());
}
