import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Copy,
  Landmark,
  Loader2,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Line,
  LineChart,
  XAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const INCOME_CATEGORIES = [
  "salary",
  "bonus",
  "freelance",
  "business",
  "dividend",
  "interest",
  "rental",
  "refund",
  "other_income",
];

const EXPENSE_CATEGORIES = [
  "housing",
  "utilities",
  "groceries",
  "transportation",
  "healthcare",
  "insurance",
  "education",
  "dining_out",
  "shopping",
  "subscriptions",
  "personal_care",
  "entertainment",
  "travel",
  "taxes",
  "investment",
  "other_expense",
  "unassigned",
];

type PlanLine = {
  planKey: string;
  plannedAmount: number;
};

type ActualLine = {
  type: "income" | "expense";
  category: string;
  amount: number;
};

type LiabilityLine = {
  id: number;
  name: string;
  category: string;
  balance: number;
  minimumPayment: number;
};

type GoalLine = {
  id: number;
  title: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
};

type BudgetPlanData = {
  month: string;
  plans: PlanLine[];
  actuals: ActualLine[];
  liabilities: LiabilityLine[];
  goals: GoalLine[];
};

type CategoryHistoryPoint = {
  month: string;
  amount: number;
};

type CashFlowCategory = {
  type: "income" | "expense";
  subcategory: string;
  average: number;
  history: CategoryHistoryPoint[];
};

type CashFlowSummary = {
  period: {
    startMonth: string | null;
    endMonth: string | null;
    months: number;
  };
  categories: CashFlowCategory[];
};

type StatementRow = {
  key: string;
  label: string;
  planned?: number;
  actual: number;
  average: number;
  history: CategoryHistoryPoint[];
  removable?: boolean;
};

function currentMonthValue(): string {
  const today = new Date();
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(value: string, amount: number): string {
  const [year, month] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(value: string): string {
  return new Date(`${value}-01T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getMonthWindow(currentMonth: string): { first: string; last: string } {
  return {
    first: shiftMonth(currentMonth, -12),
    last: shiftMonth(currentMonth, 11),
  };
}

function TrendSparkline({
  data,
  tone,
}: {
  data: CategoryHistoryPoint[];
  tone: "income" | "expense";
}) {
  if (data.length === 0) {
    return <span className="text-xs text-muted-foreground">No history</span>;
  }

  const stroke = tone === "income" ? "#059669" : "#e11d48";
  return (
    <div className="h-12 w-28 pt-4" aria-label={`${data.length}-month trend`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
          <XAxis dataKey="month" hide />
          <RechartsTooltip
            position={{ y: -52 }}
            allowEscapeViewBox={{ y: true }}
            cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "2 2" }}
            formatter={(value: number) => [formatCurrency(Number(value)), "Amount"]}
            labelFormatter={(label) => formatMonth(String(label))}
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              fontSize: "12px",
              padding: "6px 8px",
            }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function categoryLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function monthlyGoalRequirement(goal: GoalLine, planMonth: string): number {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (!remaining || !goal.targetDate) return 0;
  const target = new Date(`${goal.targetDate}T12:00:00`);
  const [year, month] = planMonth.split("-").map(Number);
  const statementMonth = new Date(year, month - 1, 1);
  const months =
    (target.getFullYear() - statementMonth.getFullYear()) * 12 +
    target.getMonth() -
    statementMonth.getMonth() +
    1;
  return remaining / Math.max(1, months);
}

function PlanAmountInput({
  value,
  suggested,
  saving,
  onSave,
}: {
  value?: number;
  suggested?: number;
  saving: boolean;
  onSave: (amount: number) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));

  useEffect(() => {
    setDraft(value === undefined ? "" : String(value));
  }, [value]);

  function commit() {
    if (draft.trim() === "") {
      if (value !== undefined && value !== 0) onSave(0);
      return;
    }
    const amount = Number(draft);
    if (!Number.isFinite(amount) || amount < 0) {
      setDraft(value === undefined ? "" : String(value));
      return;
    }
    if (amount !== value) onSave(amount);
  }

  function changeBy(delta: number) {
    const current = Number(draft);
    const next = Math.max(0, (Number.isFinite(current) ? current : 0) + delta);
    setDraft(String(next));
    onSave(next);
  }

  return (
    <div className="relative ml-auto w-28">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        $
      </span>
      <Input
        type="number"
        min="0"
        step="1"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder={suggested ? `${Math.round(suggested).toLocaleString()}` : "0"}
        className="h-7 appearance-none rounded-md border-transparent bg-muted/60 pl-6 pr-8 text-right text-sm font-medium tabular-nums shadow-none transition-colors hover:bg-muted focus-visible:border-primary focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label="Planned monthly amount"
      />
      <span className="absolute right-1 top-1/2 flex h-5 -translate-y-1/2 flex-col justify-center">
        <button
          type="button"
          tabIndex={-1}
          className="flex h-2.5 w-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => changeBy(1)}
          aria-label="Increase planned amount by one dollar"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="flex h-2.5 w-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => changeBy(-1)}
          aria-label="Decrease planned amount by one dollar"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </span>
      {saving && (
        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-primary" />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  planned,
  actual,
  icon: Icon,
  tone,
}: {
  title: string;
  planned: number;
  actual: number;
  icon: typeof TrendingUp;
  tone: "income" | "expense" | "net";
}) {
  const positive = tone === "net" ? actual >= 0 : true;
  const iconClass =
    tone === "income"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "expense"
        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : positive
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400";

  return (
    <Card className="stat-card-3d">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {formatCurrency(actual)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Plan: {formatCurrency(planned)}
            </p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-md ${iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatementSection({
  title,
  subtitle,
  icon: Icon,
  rows,
  tone,
  savingKey,
  onSave,
  onRemove,
  onCopy,
  footer,
}: {
  title: string;
  subtitle: string;
  icon: typeof TrendingUp;
  rows: StatementRow[];
  tone: "income" | "expense";
  savingKey: string | null;
  onSave: (key: string, amount: number) => void;
  onRemove?: (key: string) => void;
  onCopy?: (key: string, amount: number) => void;
  footer?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const plannedTotal = rows.reduce((sum, row) => sum + (row.planned ?? 0), 0);
  const actualTotal = rows.reduce((sum, row) => sum + row.actual, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => setIsOpen((value) => !value)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
          </Button>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className={`h-4 w-4 ${tone === "income" ? "text-emerald-600" : "text-rose-600"}`} />
              {title}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex gap-4 text-sm sm:text-right">
            <div>
              <p className="font-medium text-muted-foreground">Plan</p>
              <p className="text-base font-semibold">{formatCurrency(plannedTotal)}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Actual</p>
              <p className="text-base font-semibold">{formatCurrency(actualTotal)}</p>
            </div>
          </div>
          </div>
        </div>
      </CardHeader>
      {isOpen && <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 bg-slate-100/90 hover:bg-slate-100/90 dark:bg-slate-900/90 dark:hover:bg-slate-900/90">
              <TableHead className="h-9 font-semibold text-foreground">Category</TableHead>
              <TableHead className="h-9 w-28 px-1 font-semibold text-foreground">12-month trend</TableHead>
              <TableHead className="h-9 w-28 px-1 text-right font-semibold text-foreground">Monthly average</TableHead>
              {onCopy && <TableHead className="h-9 w-16 border-l border-border/60 px-3 text-center font-semibold text-foreground">Copy</TableHead>}
              <TableHead className="h-9 text-right font-semibold text-foreground">Monthly plan</TableHead>
              <TableHead className="h-9 text-right font-semibold text-foreground">Actual</TableHead>
              <TableHead className="h-9 text-right font-semibold text-foreground">Variance</TableHead>
              {onRemove && <TableHead className="h-9 w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const variance =
                row.planned === undefined
                  ? null
                  : tone === "income"
                    ? row.actual - row.planned
                    : row.planned - row.actual;
              return (
                <TableRow key={row.key} className="h-11">
                  <TableCell className="py-1.5 font-medium">{row.label}</TableCell>
                  <TableCell className="px-1 py-1">
                    <TrendSparkline data={row.history} tone={tone} />
                  </TableCell>
                  <TableCell className="px-1 py-1.5 text-right text-sm font-medium tabular-nums">
                    {formatCurrency(row.average)}
                  </TableCell>
                  {onCopy && (
                    <TableCell className="border-l border-border/60 px-3 py-1 text-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => onCopy(row.key, row.average)}
                        title={`Copy ${formatCurrency(row.average)} to ${row.label} plan`}
                        aria-label={`Copy ${formatCurrency(row.average)} monthly average to ${row.label} plan`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                  <TableCell className="py-1.5 text-right">
                    <PlanAmountInput
                      value={row.planned}
                      saving={savingKey === row.key}
                      onSave={(amount) => onSave(row.key, amount)}
                    />
                  </TableCell>
                  <TableCell className="py-1.5 text-right text-sm tabular-nums">
                    {formatCurrency(row.actual)}
                  </TableCell>
                  <TableCell
                    className={`py-1.5 text-right text-sm font-medium tabular-nums ${
                      variance === null
                        ? "text-muted-foreground"
                        : variance >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {variance === null ? "—" : `${variance >= 0 ? "+" : ""}${formatCurrency(variance)}`}
                  </TableCell>
                  {onRemove && (
                    <TableCell>
                      {row.removable && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemove(row.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove {row.label}</span>
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {footer}
      </CardContent>}
    </Card>
  );
}

export default function BudgetingPlanPage() {
  const { toast } = useToast();
  const currentMonth = currentMonthValue();
  const monthWindow = getMonthWindow(currentMonth);
  const firstPlanMonth = monthWindow.first;
  const lastPlanMonth = monthWindow.last;
  const [month, setMonth] = useState(currentMonth);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [debtOpen, setDebtOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const queryKey = `/api/budget-plan?month=${month}`;

  const { data, isLoading } = useQuery<BudgetPlanData>({
    queryKey: [queryKey],
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { data: historySummary } = useQuery<CashFlowSummary>({
    queryKey: ["/api/transactions/monthly-averages"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const saveMutation = useMutation({
    mutationFn: ({ planKey, amount }: { planKey: string; amount: number }) =>
      apiRequest("PUT", "/api/budget-plan", {
        month,
        planKey,
        plannedAmount: amount,
      }),
    onMutate: ({ planKey }) => setSavingKey(planKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save plan",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setSavingKey(null),
  });

  const removeMutation = useMutation({
    mutationFn: (planKey: string) =>
      apiRequest(
        "DELETE",
        `/api/budget-plan?month=${month}&planKey=${encodeURIComponent(planKey)}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not remove category",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const planMap = useMemo(
    () => new Map((data?.plans ?? []).map((line) => [line.planKey, line.plannedAmount])),
    [data?.plans],
  );
  const actualMap = useMemo(
    () =>
      new Map(
        (data?.actuals ?? []).map((line) => [
          `${line.type}:${line.category}`,
          line.amount,
        ]),
      ),
    [data?.actuals],
  );
  const historyMap = useMemo(
    () =>
      new Map(
        (historySummary?.categories ?? []).map((category) => [
          `${category.type}:${category.subcategory}`,
          category,
        ]),
      ),
    [historySummary?.categories],
  );
  const historyMonths = useMemo(() => {
    const startMonth = historySummary?.period.startMonth?.slice(0, 7);
    const count = historySummary?.period.months ?? 0;
    if (!startMonth || count <= 0) return [];
    return Array.from({ length: count }, (_, index) => shiftMonth(startMonth, index));
  }, [historySummary?.period.months, historySummary?.period.startMonth]);
  const historyFor = (key: string): CategoryHistoryPoint[] =>
    historyMap.get(key)?.history ??
    historyMonths.map((historyMonth) => ({ month: historyMonth, amount: 0 }));

  const incomeRows = useMemo<StatementRow[]>(() => {
    const categories = new Set(INCOME_CATEGORIES);
    data?.actuals
      .filter((line) => line.type === "income")
      .forEach((line) => categories.add(line.category));
    data?.plans
      .filter((line) => line.planKey.startsWith("income:"))
      .forEach((line) => categories.add(line.planKey.slice("income:".length)));
    return Array.from(categories).map((category) => {
      const key = `income:${category}`;
      return {
        key,
        label: categoryLabel(category),
        planned: planMap.get(key),
        actual: actualMap.get(key) ?? 0,
        average: historyMap.get(key)?.average ?? 0,
        history: historyFor(key),
      };
    });
  }, [actualMap, data?.actuals, data?.plans, historyMap, historyMonths, planMap]);

  const expenseRows = useMemo<StatementRow[]>(() => {
    const categories = new Set(EXPENSE_CATEGORIES);
    data?.actuals
      .filter(
        (line) =>
          line.type === "expense" &&
          line.category !== "debt_payment" &&
          line.category !== "savings_transfer",
      )
      .forEach((line) => categories.add(line.category));
    data?.plans
      .filter((line) => line.planKey.startsWith("expense:"))
      .forEach((line) => categories.add(line.planKey.slice("expense:".length)));
    return Array.from(categories).map((category) => {
      const key = `expense:${category}`;
      const hasActual = actualMap.has(key);
      const isDefault = EXPENSE_CATEGORIES.includes(category);
      return {
        key,
        label: categoryLabel(category),
        planned: planMap.get(key),
        actual: actualMap.get(key) ?? 0,
        average: historyMap.get(key)?.average ?? 0,
        history: historyFor(key),
        removable: !isDefault && !hasActual,
      };
    });
  }, [actualMap, data?.actuals, data?.plans, historyMap, historyMonths, planMap]);

  const copyAllMutation = useMutation({
    mutationFn: async ({
      targetMonth,
      rows,
    }: {
      targetMonth: string;
      rows: StatementRow[];
    }) => {
      await apiRequest("PUT", "/api/budget-plan/bulk", {
        month: targetMonth,
        plans: rows.map((row) => ({
            planKey: row.key,
            plannedAmount: row.average,
        })),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/budget-plan?month=${variables.targetMonth}`],
      });
      toast({
        title: "Monthly averages copied",
        description: `Income and expense averages were copied to ${formatMonth(variables.targetMonth)}.`,
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({
        title: "Could not copy monthly averages",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const actualIncome = (data?.actuals ?? [])
    .filter((line) => line.type === "income")
    .reduce((sum, line) => sum + line.amount, 0);
  const actualExpenses = (data?.actuals ?? [])
    .filter((line) => line.type === "expense")
    .reduce((sum, line) => sum + line.amount, 0);
  const plannedIncome = incomeRows.reduce((sum, row) => sum + (row.planned ?? 0), 0);
  const plannedLivingExpenses = expenseRows.reduce(
    (sum, row) => sum + (row.planned ?? 0),
    0,
  );
  const plannedDebtPayments = (data?.liabilities ?? []).reduce(
    (sum, liability) =>
      sum + (planMap.get(`debt:${liability.id}`) ?? liability.minimumPayment),
    0,
  );
  const plannedGoals = (data?.goals ?? []).reduce(
    (sum, goal) =>
      sum + (planMap.get(`goal:${goal.id}`) ?? monthlyGoalRequirement(goal, month)),
    0,
  );
  const plannedOutflows = plannedLivingExpenses + plannedDebtPayments + plannedGoals;
  const plannedNet = plannedIncome - plannedOutflows;
  const actualNet = actualIncome - actualExpenses;

  function savePlanLine(planKey: string, amount: number) {
    saveMutation.mutate({ planKey, amount });
  }

  function addExpenseCategory() {
    const normalized = newCategory
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!normalized) return;
    const key = `expense:${normalized}`;
    if (expenseRows.some((row) => row.key === key)) {
      toast({ title: "That category is already in this plan" });
      return;
    }
    setNewCategory("");
    savePlanLine(key, 0);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="page-header-gradient">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">Budgeting Plan</h1>
              <Badge variant={month === currentMonth ? "default" : "secondary"}>
                {month === currentMonth
                  ? "Current month"
                  : month < currentMonth
                    ? "Historical month"
                    : "Future plan"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Build a monthly financial plan and compare it with categorized transactions.
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Debt minimums and goal requirements are pulled from your account data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              disabled={month <= firstPlanMonth}
              onClick={() =>
                setMonth((value) => {
                  const previous = shiftMonth(value, -1);
                  return previous < firstPlanMonth ? firstPlanMonth : previous;
                })
              }
              aria-label="Previous month"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              value={month}
              min={firstPlanMonth}
              max={lastPlanMonth}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                setMonth(
                  value < firstPlanMonth
                    ? firstPlanMonth
                    : value > lastPlanMonth
                      ? lastPlanMonth
                      : value,
                );
              }}
              className="w-44 bg-background"
              aria-label="Budget month"
            />
            <Button
              size="icon"
              variant="outline"
              disabled={month >= lastPlanMonth}
              onClick={() =>
                setMonth((value) => {
                  const next = shiftMonth(value, 1);
                  return next > lastPlanMonth ? lastPlanMonth : next;
                })
              }
              aria-label="Next month"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-28" />
            ))}
          </div>
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-72" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              title="Monthly income"
              planned={plannedIncome}
              actual={actualIncome}
              icon={TrendingUp}
              tone="income"
            />
            <SummaryCard
              title="Monthly outflows"
              planned={plannedOutflows}
              actual={actualExpenses}
              icon={TrendingDown}
              tone="expense"
            />
            <SummaryCard
              title={actualNet >= 0 ? "Net cash flow" : "Monthly shortfall"}
              planned={plannedNet}
              actual={actualNet}
              icon={actualNet >= 0 ? ArrowUpRight : ArrowDownRight}
              tone="net"
            />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">
                Monthly plan statement · {formatMonth(month)}
              </p>
              <p className="text-sm text-muted-foreground">
                Enter plan amounts below. Changes save automatically when you leave a field.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  copyAllMutation.mutate({
                    targetMonth: month,
                    rows: [...incomeRows, ...expenseRows],
                  })
                }
                disabled={copyAllMutation.isPending || historyMonths.length === 0}
              >
                {copyAllMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copy all averages to plan
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {savingKey || copyAllMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Plan saved
                </>
              )}
              </div>
            </div>
          </div>

          <StatementSection
            title="Income"
            subtitle="Expected income compared with income transactions received this month"
            icon={CircleDollarSign}
            rows={incomeRows}
            tone="income"
            savingKey={savingKey}
            onSave={savePlanLine}
            onCopy={savePlanLine}
          />

          <StatementSection
              title="Living & operating expenses"
              subtitle="Monthly spending by transaction category"
              icon={WalletCards}
              rows={expenseRows}
              tone="expense"
              savingKey={savingKey}
              onSave={savePlanLine}
              onCopy={savePlanLine}
              onRemove={(key) => removeMutation.mutate(key)}
              footer={
                <div className="flex flex-col gap-2 border-t bg-muted/20 p-3 sm:flex-row">
                <Input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addExpenseCategory();
                  }}
                  placeholder="Add another expense category"
                  className="h-8 sm:max-w-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addExpenseCategory}
                  disabled={!newCategory.trim() || saveMutation.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add category
                </Button>
                </div>
              }
            />

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-rose-500/[0.06] px-4 py-3">
              <div className="flex items-center gap-3">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setDebtOpen((value) => !value)} aria-expanded={debtOpen} aria-label={`${debtOpen ? "Collapse" : "Expand"} debt payments`}>
                  <ChevronDown className={`h-4 w-4 transition-transform ${debtOpen ? "" : "-rotate-90"}`} />
                </Button>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Landmark className="h-4 w-4 text-rose-600" />
                    Debt payments
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Plan by debt using Liabilities data; actual debt payments cannot be assigned reliably
                  </p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">Planned</p>
                    <p className="text-base font-semibold">{formatCurrency(plannedDebtPayments)}</p>
                  </div>
                </div>
                </div>
              </div>
            </CardHeader>
            {debtOpen && <CardContent className="p-0">
              {(data?.liabilities ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No liabilities are available. Add them on the Liabilities page.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 bg-slate-100/90 hover:bg-slate-100/90 dark:bg-slate-900/90 dark:hover:bg-slate-900/90">
                      <TableHead className="h-9 font-semibold text-foreground">Debt</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Minimum</TableHead>
                      <TableHead className="text-right">Monthly plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.liabilities.map((liability) => {
                      const key = `debt:${liability.id}`;
                      return (
                        <TableRow key={liability.id} className="h-11">
                          <TableCell className="py-1.5">
                            <p className="font-medium">{liability.name}</p>
                            <p className="text-xs text-muted-foreground">{liability.category}</p>
                          </TableCell>
                          <TableCell className="py-1.5 text-right text-sm tabular-nums">
                            {formatCurrency(liability.balance)}
                          </TableCell>
                          <TableCell className="py-1.5 text-right text-sm tabular-nums">
                            {formatCurrency(liability.minimumPayment)}
                          </TableCell>
                          <TableCell className="py-1.5">
                            <PlanAmountInput
                              value={planMap.get(key) ?? liability.minimumPayment}
                              suggested={liability.minimumPayment}
                              saving={savingKey === key}
                              onSave={(amount) => savePlanLine(key, amount)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-violet-500/[0.06] px-4 py-3">
              <div className="flex items-center gap-3">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setGoalsOpen((value) => !value)} aria-expanded={goalsOpen} aria-label={`${goalsOpen ? "Collapse" : "Expand"} goals`}>
                  <ChevronDown className={`h-4 w-4 transition-transform ${goalsOpen ? "" : "-rotate-90"}`} />
                </Button>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-violet-600" />
                    Goals & planned contributions
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Plan by goal using current goal data; actual contributions cannot be assigned reliably
                  </p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">Planned</p>
                    <p className="text-base font-semibold">{formatCurrency(plannedGoals)}</p>
                  </div>
                </div>
                </div>
              </div>
            </CardHeader>
            {goalsOpen && <CardContent className="p-0">
              {(data?.goals ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No goals are available. Add a goal on the Goals & Tracking page.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 bg-slate-100/90 hover:bg-slate-100/90 dark:bg-slate-900/90 dark:hover:bg-slate-900/90">
                      <TableHead className="h-9 font-semibold text-foreground">Goal</TableHead>
                      <TableHead className="min-w-48">Progress</TableHead>
                      <TableHead className="text-right">Required monthly</TableHead>
                      <TableHead className="text-right">Monthly plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.goals.map((goal) => {
                      const key = `goal:${goal.id}`;
                      const progress =
                        goal.targetAmount > 0
                          ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
                          : 0;
                      const required = monthlyGoalRequirement(goal, month);
                      return (
                        <TableRow key={goal.id} className="h-12">
                          <TableCell className="py-1.5">
                            <p className="font-medium">{goal.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {categoryLabel(goal.category)}
                              {goal.targetDate ? ` · due ${goal.targetDate}` : ""}
                            </p>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div className="space-y-1.5">
                              <Progress value={progress} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5 text-right text-sm tabular-nums">
                            {required > 0 ? formatCurrency(required) : "—"}
                          </TableCell>
                          <TableCell className="py-1.5">
                            <PlanAmountInput
                              value={planMap.get(key) ?? required}
                              suggested={required}
                              saving={savingKey === key}
                              onSave={(amount) => savePlanLine(key, amount)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>}
          </Card>
        </>
      )}
    </div>
  );
}