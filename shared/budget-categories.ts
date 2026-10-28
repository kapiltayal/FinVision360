export type BudgetCategory = {
  id: number;
  type: "income" | "expense";
  name: string;
  parentCategory: string;
};

export function budgetCategoryPlanKey(type: string, id: number | null | undefined) {
  return id == null ? `${type}:unassigned` : `${type}:category:${id}`;
}

export function parseBudgetCategoryPlanKey(key: string) {
  const match = /^(income|expense):category:([1-9]\d*)$/.exec(key);
  if (!match || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) > 2147483647) return null;
  return { type: match[1], id: Number(match[2]) };
}
