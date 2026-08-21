import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Info,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

type CashFlowCategory = {
  type: "income" | "expense";
  subcategory: string;
  total: number;
  average: number;
  transactionCount: number;
};

type CashFlowSummary = {
  period: {
    startMonth: string | null;
    endMonth: string | null;
    months: number;
  };
  averages: {
    income: number;
    expenses: number;
    net: number;
    savingsRate: number;
  };
  categories: CashFlowCategory[];
};

const CHART_COLORS = [
  "#2563eb",
  "#0d9488",
  "#8b5cf6",
  "#ea580c",
  "#16a34a",
  "#db2777",
  "#ca8a04",
  "#0891b2",
  "#4f46e5",
  "#65a30d",
  "#be123c",
  "#64748b",
];

function categoryLabel(value: string): string {
  if (value === "unassigned") return "Unassigned";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatMonth(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
  testId,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof TrendingUp;
  tone?: "default" | "income" | "expense" | "positive" | "negative";
  testId: string;
}) {
  const toneClasses = {
    default: "bg-primary/10 text-primary",
    income: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    expense: "bg-red-500/10 text-red-600 dark:text-red-400",
    positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    negative: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  const valueClasses = {
    default: "",
    income: "text-emerald-700 dark:text-emerald-300",
    expense: "text-red-700 dark:text-red-300",
    positive: "text-emerald-700 dark:text-emerald-300",
    negative: "text-red-700 dark:text-red-300",
  };

  return (
    <Card data-testid={testId} className="stat-card-3d">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold tracking-tight ${valueClasses[tone]}`}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${toneClasses[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryAverageList({
  title,
  categories,
  type,
}: {
  title: string;
  categories: CashFlowCategory[];
  type: "income" | "expense";
}) {
  const colorClass = type === "income"
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
  const Icon = type === "income" ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className={`h-4 w-4 ${colorClass}`} />
            {title}
          </CardTitle>
          <Badge variant="secondary">{categories.length} categor{categories.length === 1 ? "y" : "ies"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No {type} transactions in this completed-month period.
          </p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={`${category.type}-${category.subcategory}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{categoryLabel(category.subcategory)}</p>
                  <p className="text-xs text-muted-foreground">
                    {category.transactionCount} transaction{category.transactionCount === 1 ? "" : "s"} in period
                  </p>
                </div>
                <p className={`shrink-0 text-sm font-semibold ${colorClass}`}>
                  {formatCurrency(category.average)}/mo
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function IncomeExpensesPage() {
  const [chartMode, setChartMode] = useState<"totals" | "categories">("totals");
  const { data: summary, isLoading } = useQuery<CashFlowSummary>({
    queryKey: ["/api/transactions/monthly-averages"],
  });

  const averages = summary?.averages ?? { income: 0, expenses: 0, net: 0, savingsRate: 0 };
  const periodMonths = summary?.period.months ?? 0;
  const categories = summary?.categories ?? [];
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === "income"),
    [categories],
  );
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );

  const categorySeries = useMemo(
    () => categories.map((category, index) => ({
      key: `${category.type}-${category.subcategory}`,
      label: `${categoryLabel(category.subcategory)} (${category.type === "income" ? "Income" : "Expense"})`,
      value: category.average,
      color: CHART_COLORS[index % CHART_COLORS.length],
      type: category.type,
    })),
    [categories],
  );
  const categoryChartData = useMemo(() => {
    const income: Record<string, string | number> = { name: "Income" };
    const expenses: Record<string, string | number> = { name: "Expenses" };
    categorySeries.forEach((series) => {
      if (series.type === "income") income[series.key] = series.value;
      else expenses[series.key] = series.value;
    });
    return [income, expenses];
  }, [categorySeries]);

  const periodDescription = !summary || periodMonths === 0
    ? "No completed calendar months of transaction data yet"
    : periodMonths === 1
      ? `Based on 1 complete month: ${formatMonth(summary.period.endMonth!)}`
      : `Based on ${periodMonths} complete months: ${formatMonth(summary.period.startMonth!)} – ${formatMonth(summary.period.endMonth!)}`;

  const totalsChartData = [
    { name: "Income", amount: averages.income, color: "#2563eb" },
    { name: "Expenses", amount: averages.expenses, color: "#dc2626" },
    { name: averages.net >= 0 ? "Net Savings" : "Overspending", amount: Math.abs(averages.net), color: averages.net >= 0 ? "#16a34a" : "#ea580c" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="page-header-gradient">
        <h1 className="text-2xl font-bold" data-testid="text-income-expenses-title">Income &amp; Expenses</h1>
        <p className="text-muted-foreground">Track your average monthly cash flow and savings</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground" data-testid="text-income-expenses-period">
          <CalendarDays className="h-3 w-3" />
          {periodDescription}
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/[0.04]">
        <CardContent className="flex gap-3 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            This page is calculated from your Financial Tracker transactions. To add, edit, or categorize transactions, use the{" "}
            <a href="/finance-tracker" className="font-medium text-primary underline-offset-4 hover:underline">
              Financial Tracker page
            </a>.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : periodMonths === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <CircleDollarSign className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <h2 className="text-base font-semibold">No completed months available yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Add transactions in the Financial Tracker. Your average monthly cash flow will appear after the current calendar month is complete.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              title="Average Monthly Income"
              value={formatCurrency(averages.income)}
              subtitle={`Across ${periodMonths} complete month${periodMonths === 1 ? "" : "s"}`}
              icon={TrendingUp}
              tone="income"
              testId="card-total-income"
            />
            <StatCard
              title="Average Monthly Expenses"
              value={formatCurrency(averages.expenses)}
              subtitle={`Across ${periodMonths} complete month${periodMonths === 1 ? "" : "s"}`}
              icon={TrendingDown}
              tone="expense"
              testId="card-total-expenses"
            />
            <StatCard
              title={averages.net >= 0 ? "Average Net Savings" : "Average Overspending"}
              value={formatCurrency(Math.abs(averages.net))}
              subtitle={`${averages.savingsRate.toFixed(1)}% savings rate`}
              icon={averages.net >= 0 ? ArrowUpRight : ArrowDownRight}
              tone={averages.net >= 0 ? "positive" : "negative"}
              testId="card-net-savings"
            />
          </div>

          <Card>
            <CardHeader className="gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Average Monthly Overview</CardTitle>
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                  Average transaction totals across the completed-month period
                </p>
              </div>
              <div className="flex rounded-md border bg-muted/30 p-1" aria-label="Chart display options">
                <Button
                  size="sm"
                  variant={chartMode === "totals" ? "secondary" : "ghost"}
                  onClick={() => setChartMode("totals")}
                  data-testid="button-chart-totals"
                >
                  Totals
                </Button>
                <Button
                  size="sm"
                  variant={chartMode === "categories" ? "secondary" : "ghost"}
                  onClick={() => setChartMode("categories")}
                  data-testid="button-chart-categories"
                >
                  By category
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === "totals" ? (
                    <BarChart data={totalsChartData} margin={{ top: 16, right: 24, left: 48, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                      <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tick={{ fontSize: 11 }} width={48} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: number) => [`${formatCurrency(Number(value))}/mo`, "Average"]}
                        contentStyle={{ borderRadius: "0.5rem" }}
                      />
                      <Bar dataKey="amount" radius={[5, 5, 0, 0]}>
                        {totalsChartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={categoryChartData} margin={{ top: 16, right: 24, left: 48, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                      <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tick={{ fontSize: 11 }} width={48} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: number, name: string) => [`${formatCurrency(Number(value))}/mo`, name]}
                        contentStyle={{ borderRadius: "0.5rem" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      {categorySeries.map((series) => (
                        <Bar key={series.key} dataKey={series.key} name={series.label} stackId="categories" fill={series.color} />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CategoryAverageList
              title="Average Monthly Income by Category"
              categories={incomeCategories}
              type="income"
            />
            <CategoryAverageList
              title="Average Monthly Expenses by Category"
              categories={expenseCategories}
              type="expense"
            />
          </div>
        </>
      )}
    </div>
  );
}