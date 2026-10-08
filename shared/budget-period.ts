export const INCOME_CATEGORIES = ["salary", "bonus", "freelance", "business", "dividend", "interest", "rental", "refund", "other_income"];
export const EXPENSE_CATEGORIES = ["housing", "utilities", "groceries", "transportation", "healthcare", "insurance", "education", "dining_out", "shopping", "subscriptions", "personal_care", "entertainment", "travel", "taxes", "investment", "other_expense", "unassigned"];

export function budgetCurrentMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

export function previousBudgetMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}

export function isHistoricalBudgetMonth(month: string, now = new Date()) {
  return month < budgetCurrentMonth(now);
}
