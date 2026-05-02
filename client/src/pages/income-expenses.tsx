import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLastUpdated } from "@/hooks/use-last-updated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Plus,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Home,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  type IncomeEntry,
  type ExpenseEntry,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  FREQUENCIES,
} from "@shared/schema";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

function toMonthly(amount: string, frequency: string): number {
  return parseFloat(amount || "0") * (FREQUENCY_MULTIPLIERS[frequency] ?? 1);
}

function getCategoryLabel(value: string, list: readonly { value: string; label: string }[]): string {
  return list.find((c) => c.value === value)?.label ?? value;
}

const CHART_COLORS = [
  "hsl(220, 85%, 48%)",
  "hsl(180, 75%, 38%)",
  "hsl(280, 70%, 42%)",
  "hsl(30, 85%, 48%)",
  "hsl(150, 75%, 35%)",
  "hsl(340, 70%, 45%)",
  "hsl(60, 75%, 40%)",
  "hsl(200, 80%, 45%)",
];

function StatCard({
  title, value, subtitle, icon: Icon, trend, testId, color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  trend?: "up" | "down";
  testId: string;
  color?: "green" | "red" | "default";
}) {
  const iconBg =
    color === "green" ? "bg-emerald-500/10" :
    color === "red" ? "bg-red-500/10" : "bg-primary/10";
  const iconColor =
    color === "green" ? "text-emerald-600 dark:text-emerald-400" :
    color === "red" ? "text-red-600 dark:text-red-400" : "text-primary";
  const valueColor =
    color === "green" ? "text-emerald-700 dark:text-emerald-300" :
    color === "red" ? "text-red-700 dark:text-red-300" : "";
  const cardVariant =
    color === "green" ? "stat-card-3d stat-card-3d-green border" :
    color === "red" ? "stat-card-3d stat-card-3d-red border" :
    "stat-card-3d";

  return (
    <Card data-testid={testId} className={cardVariant}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-1">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
            {subtitle && (
              <div className="flex items-center gap-1">
                {trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
                {trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            )}
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type IncomeForm = {
  name: string;
  category: string;
  amount: string;
  frequency: string;
  notes: string;
};

type ExpenseForm = {
  name: string;
  category: string;
  type: string;
  amount: string;
  frequency: string;
  notes: string;
};

const defaultIncomeForm: IncomeForm = { name: "", category: "salary", amount: "", frequency: "monthly", notes: "" };
const defaultExpenseForm: ExpenseForm = { name: "", category: "housing", type: "need", amount: "", frequency: "monthly", notes: "" };

export default function IncomeExpensesPage() {
  const { toast } = useToast();

  const { data: incomeList = [], isLoading: incomeLoading } = useQuery<IncomeEntry[]>({ queryKey: ["/api/income"] });
  const { data: expenseList = [], isLoading: expensesLoading } = useQuery<ExpenseEntry[]>({ queryKey: ["/api/expenses"] });

  const [incomeDialog, setIncomeDialog] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [incomeForm, setIncomeForm] = useState<IncomeForm>(defaultIncomeForm);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(defaultExpenseForm);

  const totalMonthlyIncome = incomeList.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0);
  const totalMonthlyExpenses = expenseList.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0);
  const netMonthly = totalMonthlyIncome - totalMonthlyExpenses;

  const needsMonthly = expenseList.filter((e) => e.type === "need").reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0);
  const wantsMonthly = expenseList.filter((e) => e.type === "want").reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0);

  const incomeByCat = INCOME_CATEGORIES.map((c) => ({
    name: c.label,
    value: incomeList.filter((e) => e.category === c.value).reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0),
  })).filter((c) => c.value > 0);

  const expenseByCat = EXPENSE_CATEGORIES.map((c) => ({
    name: c.label,
    value: expenseList.filter((e) => e.category === c.value).reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0),
  })).filter((c) => c.value > 0);

  const savingsRate = totalMonthlyIncome > 0 ? ((netMonthly / totalMonthlyIncome) * 100).toFixed(1) : "0.0";

  const { formattedDate, markUpdated } = useLastUpdated("income-expenses");

  const createIncome = useMutation({
    mutationFn: (data: IncomeForm) => apiRequest("POST", "/api/income", { ...data, amount: data.amount }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/income"] }); setIncomeDialog(false); setIncomeForm(defaultIncomeForm); markUpdated(); toast({ title: "Income added" }); },
  });
  const updateIncome = useMutation({
    mutationFn: (data: IncomeForm) => apiRequest("PUT", `/api/income/${editingIncome!.id}`, { ...data, amount: data.amount }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/income"] }); setIncomeDialog(false); setEditingIncome(null); markUpdated(); toast({ title: "Income updated" }); },
  });
  const deleteIncome = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/income/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/income"] }); markUpdated(); toast({ title: "Income removed" }); },
  });

  const createExpense = useMutation({
    mutationFn: (data: ExpenseForm) => apiRequest("POST", "/api/expenses", { ...data, amount: data.amount }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/expenses"] }); setExpenseDialog(false); setExpenseForm(defaultExpenseForm); markUpdated(); toast({ title: "Expense added" }); },
  });
  const updateExpense = useMutation({
    mutationFn: (data: ExpenseForm) => apiRequest("PUT", `/api/expenses/${editingExpense!.id}`, { ...data, amount: data.amount }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/expenses"] }); setExpenseDialog(false); setEditingExpense(null); markUpdated(); toast({ title: "Expense updated" }); },
  });
  const deleteExpense = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/expenses"] }); markUpdated(); toast({ title: "Expense removed" }); },
  });

  function openAddIncome() {
    setEditingIncome(null);
    setIncomeForm(defaultIncomeForm);
    setIncomeDialog(true);
  }
  function openEditIncome(e: IncomeEntry) {
    setEditingIncome(e);
    setIncomeForm({ name: e.name, category: e.category, amount: e.amount, frequency: e.frequency, notes: e.notes ?? "" });
    setIncomeDialog(true);
  }
  function submitIncome() {
    if (!incomeForm.name || !incomeForm.amount) return;
    editingIncome ? updateIncome.mutate(incomeForm) : createIncome.mutate(incomeForm);
  }

  function openAddExpense(defaultType?: "need" | "want") {
    setEditingExpense(null);
    setExpenseForm({ ...defaultExpenseForm, type: defaultType ?? "need" });
    setExpenseDialog(true);
  }
  function openEditExpense(e: ExpenseEntry) {
    setEditingExpense(e);
    setExpenseForm({ name: e.name, category: e.category, type: e.type, amount: e.amount, frequency: e.frequency, notes: e.notes ?? "" });
    setExpenseDialog(true);
  }
  function submitExpense() {
    if (!expenseForm.name || !expenseForm.amount) return;
    editingExpense ? updateExpense.mutate(expenseForm) : createExpense.mutate(expenseForm);
  }

  const isLoading = incomeLoading || expensesLoading;

  const ChartTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md">
          <p className="text-sm font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">{formatCurrency(payload[0].value)}/mo</p>
        </div>
      );
    }
    return null;
  };

  const needs = expenseList.filter((e) => e.type === "need");
  const wants = expenseList.filter((e) => e.type === "want");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-income-expenses-title">Income &amp; Expenses</h1>
        <p className="text-muted-foreground">Track your monthly cash flow and net savings</p>
        {formattedDate && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1" data-testid="text-income-expenses-last-updated">
            <Clock className="h-3 w-3" /> Last updated: {formattedDate}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Monthly Income"
              value={formatCurrency(totalMonthlyIncome)}
              subtitle={`${incomeList.length} source${incomeList.length !== 1 ? "s" : ""}`}
              icon={TrendingUp}
              trend="up"
              testId="card-total-income"
            />
            <StatCard
              title="Monthly Expenses"
              value={formatCurrency(totalMonthlyExpenses)}
              subtitle={`${expenseList.length} item${expenseList.length !== 1 ? "s" : ""}`}
              icon={TrendingDown}
              trend="down"
              testId="card-total-expenses"
            />
            <StatCard
              title={netMonthly >= 0 ? "Net Savings" : "Overspending"}
              value={formatCurrency(Math.abs(netMonthly))}
              subtitle={`${savingsRate}% savings rate`}
              icon={netMonthly >= 0 ? ArrowUpRight : ArrowDownRight}
              trend={netMonthly >= 0 ? "up" : "down"}
              color={netMonthly >= 0 ? "green" : "red"}
              testId="card-net-savings"
            />
          </div>

          {/* Summary Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: "Income",
                        Income: totalMonthlyIncome,
                        Needs: 0,
                        Wants: 0,
                        NetPos: 0,
                        NetNeg: 0,
                      },
                      {
                        name: "Expenses",
                        Income: 0,
                        Needs: needsMonthly,
                        Wants: wantsMonthly,
                        NetPos: 0,
                        NetNeg: 0,
                      },
                      {
                        name: "Net",
                        Income: 0,
                        Needs: 0,
                        Wants: 0,
                        NetPos: Math.max(0, netMonthly),
                        NetNeg: Math.abs(Math.min(0, netMonthly)),
                      },
                    ]}
                    margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                      height={30}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const d = payload[0].payload;
                          if (d.name === "Income") return <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md"><p className="text-sm font-medium">Income</p><p className="text-sm text-muted-foreground">{formatCurrency(totalMonthlyIncome)}/mo</p></div>;
                          if (d.name === "Expenses") return <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md"><p className="text-sm font-medium">Expenses</p><p className="text-sm text-muted-foreground">Needs: {formatCurrency(needsMonthly)}</p><p className="text-sm text-muted-foreground">Wants: {formatCurrency(wantsMonthly)}</p><p className="text-sm font-medium border-t mt-1 pt-1">Total: {formatCurrency(totalMonthlyExpenses)}</p></div>;
                          if (d.name === "Net") return <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md"><p className="text-sm font-medium">Net {netMonthly >= 0 ? "Savings" : "Overspending"}</p><p className={`text-sm ${netMonthly >= 0 ? "text-emerald-500" : "text-red-500"}`}>{formatCurrency(Math.abs(netMonthly))}/mo</p></div>;
                        }
                        return null;
                      }}
                    />
                    {/* All bars share stackId "a" so they sit in the same column per category */}
                    <Bar dataKey="Income" stackId="a" fill="hsl(220, 85%, 48%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Needs"  stackId="a" fill="hsl(210, 70%, 50%)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Wants"  stackId="a" fill="hsl(280, 70%, 50%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="NetPos" stackId="a" fill="hsl(150, 75%, 35%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="NetNeg" stackId="a" fill="hsl(0, 85%, 55%)"   radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Income & Expenses Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Income */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Income Sources
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{incomeList.length} items</Badge>
                    <Button size="sm" variant="outline" onClick={openAddIncome} data-testid="button-add-income">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {incomeList.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No income sources yet.</p>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={openAddIncome}>Add your first income</Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incomeList.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-colors" data-testid={`income-row-${entry.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{entry.name}</p>
                            <p className="text-xs text-muted-foreground">{getCategoryLabel(entry.category, INCOME_CATEGORIES)} · {FREQUENCIES.find((f) => f.value === entry.frequency)?.label ?? entry.frequency}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(parseFloat(entry.amount))}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(toMonthly(entry.amount, entry.frequency))}/mo</p>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditIncome(entry)} data-testid={`button-edit-income-${entry.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteIncome.mutate(entry.id)} data-testid={`button-delete-income-${entry.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-1 border-t flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Total Monthly</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalMonthlyIncome)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    Expenses
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{expenseList.length} items</Badge>
                    <Button size="sm" variant="outline" onClick={() => openAddExpense()} data-testid="button-add-expense">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {expenseList.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No expenses yet.</p>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => openAddExpense()}>Add your first expense</Button>
                  </div>
                ) : (
                  <>
                  <Tabs defaultValue="needs">
                    <TabsList className="mb-3 w-full">
                      <TabsTrigger value="needs" className="flex-1 gap-1.5" data-testid="tab-needs">
                        <Home className="h-3.5 w-3.5" />
                        Needs
                        <Badge variant="secondary" className="ml-1 text-xs">{needs.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="wants" className="flex-1 gap-1.5" data-testid="tab-wants">
                        <ShoppingBag className="h-3.5 w-3.5" />
                        Wants
                        <Badge variant="secondary" className="ml-1 text-xs">{wants.length}</Badge>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="needs" className="mt-0 space-y-2">
                      {needs.length === 0 ? (
                        <div className="py-6 text-center text-muted-foreground text-sm">
                          <p>No needs added.</p>
                          <Button size="sm" variant="ghost" className="mt-1" onClick={() => openAddExpense("need")}>Add a need</Button>
                        </div>
                      ) : (
                        needs.map((entry) => (
                          <ExpenseRow key={entry.id} entry={entry} onEdit={openEditExpense} onDelete={(id) => deleteExpense.mutate(id)} />
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="wants" className="mt-0 space-y-2">
                      {wants.length === 0 ? (
                        <div className="py-6 text-center text-muted-foreground text-sm">
                          <p>No wants added.</p>
                          <Button size="sm" variant="ghost" className="mt-1" onClick={() => openAddExpense("want")}>Add a want</Button>
                        </div>
                      ) : (
                        wants.map((entry) => (
                          <ExpenseRow key={entry.id} entry={entry} onEdit={openEditExpense} onDelete={(id) => deleteExpense.mutate(id)} />
                        ))
                      )}
                    </TabsContent>
                  </Tabs>

                  <div className="mt-3 pt-2 border-t space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Needs Expense</span>
                      <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(needsMonthly)}/mo</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Wants Expense</span>
                      <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(wantsMonthly)}/mo</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1 border-t">
                      <span className="font-semibold">Total Monthly Expense</span>
                      <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(totalMonthlyExpenses)}/mo</span>
                    </div>
                  </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Income Dialog */}
      <Dialog open={incomeDialog} onOpenChange={setIncomeDialog}>
        <DialogContent data-testid="dialog-income">
          <DialogHeader>
            <DialogTitle>{editingIncome ? "Edit Income" : "Add Income Source"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Monthly Salary"
                value={incomeForm.name}
                onChange={(e) => setIncomeForm((p) => ({ ...p, name: e.target.value }))}
                data-testid="input-income-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={incomeForm.category} onValueChange={(v) => setIncomeForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger data-testid="select-income-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INCOME_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={incomeForm.frequency} onValueChange={(v) => setIncomeForm((p) => ({ ...p, frequency: v }))}>
                  <SelectTrigger data-testid="select-income-frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={incomeForm.amount}
                onChange={(e) => setIncomeForm((p) => ({ ...p, amount: e.target.value }))}
                data-testid="input-income-amount"
              />
              {incomeForm.amount && (
                <p className="text-xs text-muted-foreground">
                  ≈ {formatCurrency(toMonthly(incomeForm.amount, incomeForm.frequency))}/month
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Any additional notes..."
                value={incomeForm.notes}
                onChange={(e) => setIncomeForm((p) => ({ ...p, notes: e.target.value }))}
                data-testid="input-income-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncomeDialog(false)}>Cancel</Button>
            <Button
              onClick={submitIncome}
              disabled={createIncome.isPending || updateIncome.isPending || !incomeForm.name || !incomeForm.amount}
              data-testid="button-save-income"
            >
              {editingIncome ? "Save Changes" : "Add Income"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent data-testid="dialog-expense">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Rent, Netflix, Groceries..."
                value={expenseForm.name}
                onChange={(e) => setExpenseForm((p) => ({ ...p, name: e.target.value }))}
                data-testid="input-expense-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger data-testid="select-expense-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={expenseForm.type} onValueChange={(v) => setExpenseForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger data-testid="select-expense-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="need">Need (Essential)</SelectItem>
                    <SelectItem value="want">Want (Discretionary)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                  data-testid="input-expense-amount"
                />
                {expenseForm.amount && (
                  <p className="text-xs text-muted-foreground">
                    ≈ {formatCurrency(toMonthly(expenseForm.amount, expenseForm.frequency))}/month
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={expenseForm.frequency} onValueChange={(v) => setExpenseForm((p) => ({ ...p, frequency: v }))}>
                  <SelectTrigger data-testid="select-expense-frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Any additional notes..."
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))}
                data-testid="input-expense-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialog(false)}>Cancel</Button>
            <Button
              onClick={submitExpense}
              disabled={createExpense.isPending || updateExpense.isPending || !expenseForm.name || !expenseForm.amount}
              data-testid="button-save-expense"
            >
              {editingExpense ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: ExpenseEntry;
  onEdit: (e: ExpenseEntry) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-colors" data-testid={`expense-row-${entry.id}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-md bg-red-500/10 flex items-center justify-center shrink-0">
          <TrendingDown className="h-4 w-4 text-red-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{entry.name}</p>
          <p className="text-xs text-muted-foreground">{getCategoryLabel(entry.category, EXPENSE_CATEGORIES)} · {FREQUENCIES.find((f) => f.value === entry.frequency)?.label ?? entry.frequency}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(parseFloat(entry.amount))}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(toMonthly(entry.amount, entry.frequency))}/mo</p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(entry)} data-testid={`button-edit-expense-${entry.id}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(entry.id)} data-testid={`button-delete-expense-${entry.id}`}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
