const roundedDollarFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const budgetAmountDraftPattern = /^\d*(?:\.\d{0,2})?$/;

export function formatBudgetPlanInput(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value)
    ? roundedDollarFormatter.format(value)
    : "";
}

export function isValidBudgetPlanDraft(value: string): boolean {
  return budgetAmountDraftPattern.test(value);
}
