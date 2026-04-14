export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatCurrencyFull(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0%";
  return `${num.toFixed(2)}%`;
}

export function getCategoryLabel(categories: readonly { value: string; label: string }[], value: string): string {
  return categories.find((c) => c.value === value)?.label || value;
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    bank_account: "hsl(var(--chart-1))",
    savings_account: "hsl(var(--chart-2))",
    investment: "hsl(var(--chart-3))",
    property: "hsl(var(--chart-4))",
    cash: "hsl(var(--chart-5))",
    retirement_fund: "hsl(220 70% 55%)",
    other: "hsl(var(--muted-foreground))",
    credit_card: "hsl(0 84% 45%)",
    mortgage: "hsl(var(--chart-4))",
    personal_loan: "hsl(var(--chart-3))",
    student_loan: "hsl(var(--chart-2))",
    auto_loan: "hsl(var(--chart-1))",
  };
  return colors[category] || "hsl(var(--muted-foreground))";
}
