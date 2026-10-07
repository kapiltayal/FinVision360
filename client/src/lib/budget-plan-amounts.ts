type BudgetPlanAmount = { planned?: number; average: number };

// Suggestions form the starting plan until the user saves an explicit amount.
// A saved zero is intentional and must not fall back to the monthly average.
export function effectiveBudgetPlanAmount(row: BudgetPlanAmount): number {
  return row.planned ?? row.average;
}

export function budgetPlanSubtotal(rows: readonly BudgetPlanAmount[]): number {
  return rows.reduce((sum, row) => sum + effectiveBudgetPlanAmount(row), 0);
}

export function budgetPlanVariance(
  row: BudgetPlanAmount & { actual: number },
  type: "income" | "expense",
): number {
  const planned = effectiveBudgetPlanAmount(row);
  return type === "income" ? row.actual - planned : planned - row.actual;
}
