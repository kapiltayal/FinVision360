import { budgetCategoryPlanKey, type BudgetCategory } from "@shared/budget-categories";

type Plan = {
  planKey: string; plannedAmount: number;
  entityMetadata?: { name: string; category: string } | null;
};
type Actual = { type: string; category: string; categoryName?: string; amount: number };
type HistoryPoint = { month: string; amount: number };
type HistoryCategory = { type: string; categoryId?: number | null; average: number; history: HistoryPoint[] };

export function buildBudgetCategoryRows(input: {
  type: "income" | "expense"; categories: BudgetCategory[];
  plans: Plan[]; actuals: Actual[]; historyCategories: HistoryCategory[];
  historyMonths: string[]; readOnly: boolean; closeComplete: boolean;
}) {
  const { type, plans, actuals, readOnly, closeComplete } = input;
  const catalog = new Map(input.categories.filter((c) => c.type === type).map((c) => [budgetCategoryPlanKey(type, c.id), c]));
  // Debt payments belong to the separate debt section, not living expenses.
  const excluded = (label: string) => type === "expense" && ["debt_payment", "savings_transfer"]
    .includes(label.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  const planMap = new Map(plans.map((p) => [p.planKey, p]));
  const actualMap = new Map(actuals.filter((a) => a.type === type).map((a) => [`${type}:${a.category}`, a]));
  const historyMap = new Map(input.historyCategories.filter((h) => h.type === type)
    .map((h) => [budgetCategoryPlanKey(type, h.categoryId), h]));
  const keys = new Set<string>(readOnly ? [] : Array.from(catalog.keys()));
  Array.from(actualMap.keys()).forEach((key) => keys.add(key));
  for (const plan of plans) if (plan.planKey.startsWith(`${type}:`)) keys.add(plan.planKey);
  if (!readOnly && historyMap.has(`${type}:unassigned`)) keys.add(`${type}:unassigned`);

  return Array.from(keys).flatMap((key) => {
    const category = catalog.get(key);
    const plan = planMap.get(key);
    const actual = actualMap.get(key);
    const raw = key.slice(type.length + 1);
    const fallback = /^category:\d+$/.test(raw) ? `Archived category #${raw.split(":")[1]}`
      : raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const label = readOnly
      ? plan?.entityMetadata?.name ?? actual?.categoryName ?? category?.name ?? fallback
      : category?.name ?? plan?.entityMetadata?.name ?? actual?.categoryName ?? fallback;
    if (excluded(category?.name ?? raw)) return [];
    const history = historyMap.get(key);
    return [{
      key, label,
      planned: plan?.plannedAmount ?? (readOnly && closeComplete ? 0 : undefined),
      actual: actual?.amount ?? 0,
      average: readOnly ? 0 : history?.average ?? 0,
      history: readOnly ? [] : history?.history ?? input.historyMonths.map((month) => ({ month, amount: 0 })),
      removable: !category && !actual,
    }];
  });
}
