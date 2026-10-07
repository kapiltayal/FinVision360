function parseGoalDate(value: string | null): Date | null {
  if (!value) return null;
  const parts = value.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function monthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthlySavingsRequired(
  targetAmount: number,
  currentAmount: number,
  targetDate: string | null,
  today = new Date(),
): number | null {
  const remaining = Math.max(0, targetAmount - currentAmount);
  if (remaining === 0) return 0;
  const target = parseGoalDate(targetDate);
  if (!target) return null;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.ceil((target.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
  // Match the Goals page: include partial months and overdue goals.
  const months = Math.max(1, Math.ceil(days / 30.4375));
  return remaining / months;
}

export function budgetMonthlyGoalRequirement(
  goal: { targetAmount: number; currentAmount: number; targetDate: string | null },
  planMonth: string,
  today = new Date(),
): number {
  const target = parseGoalDate(goal.targetDate);
  if (!target || planMonth > monthValue(target)) return 0;
  if (planMonth >= monthValue(today)) {
    // Future budgets carry the current Goals-page amount, not a new rate
    // recalculated from each selected future month.
    return monthlySavingsRequired(goal.targetAmount, goal.currentAmount, goal.targetDate, today) ?? 0;
  }
  // Preserve the existing calculation for historical budget months.
  const [year, month] = planMonth.split("-").map(Number);
  const months = (target.getFullYear() - year) * 12 + target.getMonth() - (month - 1) + 1;
  return Math.max(0, goal.targetAmount - goal.currentAmount) / Math.max(1, months);
}
