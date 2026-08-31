import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Target, Pencil, Trash2, TrendingUp, CheckCircle2,
  PiggyBank, Home, GraduationCap, Car, Plane, Briefcase,
  ShieldCheck, BarChart3, Wallet, Calendar, Clock, Trophy, Landmark,
} from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "savings",        label: "Savings",         icon: PiggyBank,   color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-800" },
  { value: "debt_payoff",    label: "Debt Payoff",     icon: Wallet,      color: "text-rose-500",    bg: "bg-rose-500/10",    border: "border-rose-200 dark:border-rose-800" },
  { value: "emergency_fund", label: "Emergency Fund",  icon: ShieldCheck, color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-200 dark:border-amber-800" },
  { value: "home",           label: "Home Purchase",   icon: Home,        color: "text-[#1C91D4]",   bg: "bg-[#1C91D4]/10",   border: "border-blue-200 dark:border-blue-800" },
  { value: "investment",     label: "Investment",      icon: BarChart3,   color: "text-violet-500",  bg: "bg-violet-500/10",  border: "border-violet-200 dark:border-violet-800" },
  { value: "retirement",     label: "Retirement",      icon: Landmark,    color: "text-[#1475A8]",   bg: "bg-[#1475A8]/10",   border: "border-blue-200 dark:border-blue-800" },
  { value: "education",      label: "Education",       icon: GraduationCap, color: "text-cyan-500", bg: "bg-cyan-500/10",     border: "border-cyan-200 dark:border-cyan-800" },
  { value: "travel",         label: "Travel",          icon: Plane,       color: "text-pink-500",    bg: "bg-pink-500/10",    border: "border-pink-200 dark:border-pink-800" },
  { value: "vehicle",        label: "Vehicle",         icon: Car,         color: "text-orange-500",  bg: "bg-orange-500/10",  border: "border-orange-200 dark:border-orange-800" },
  { value: "business",       label: "Business",        icon: Briefcase,   color: "text-indigo-500",  bg: "bg-indigo-500/10",  border: "border-indigo-200 dark:border-indigo-800" },
  { value: "custom",         label: "Other / Custom",  icon: Target,      color: "text-gray-500",    bg: "bg-gray-500/10",    border: "border-gray-200 dark:border-gray-700" },
] as const;

type CategoryValue = typeof CATEGORIES[number]["value"];

function getCat(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Goal {
  id: number;
  title: string;
  category: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  const parts = datePart.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function daysRemaining(targetDate: string | null): number | null {
  const target = parseDateOnly(targetDate);
  if (!target) return null;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = target.getTime() - todayStart.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function formatGoalDate(value: string | null, options: Intl.DateTimeFormatOptions): string {
  const date = parseDateOnly(value);
  return date ? date.toLocaleDateString("en-US", options) : "";
}

function formatDaysRemaining(days: number | null): string {
  if (days === null) return "No deadline";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days < 30) return `${days}d left`;
  if (days < 365) return `${Math.round(days / 30)}mo left`;
  return `${(days / 365).toFixed(1)}yr left`;
}

function monthlySavingsRequired(
  targetAmount: number,
  currentAmount: number,
  targetDate: string | null,
): number | null {
  const remaining = Math.max(0, targetAmount - currentAmount);
  if (remaining === 0) return 0;
  const days = daysRemaining(targetDate);
  if (days === null) return null;

  // Treat any partial month as a full monthly contribution so the goal is
  // fully funded by its deadline, including goals that are already overdue.
  const months = Math.max(1, Math.ceil(days / 30.4375));
  return remaining / months;
}

// ── Empty form ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: "",
  category: "savings" as CategoryValue,
  targetAmount: "",
  currentAmount: "",
  targetDate: "",
  notes: "",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [progressAmount, setProgressAmount] = useState("");

  const { data: goals = [], isLoading } = useQuery<Goal[]>({ queryKey: ["/api/goals"] });

  // Summary stats
  const stats = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter(
      (g) => parseFloat(g.currentAmount) >= parseFloat(g.targetAmount)
    ).length;
    const totalTarget = goals.reduce((s, g) => s + parseFloat(g.targetAmount), 0);
    const totalCurrent = goals.reduce((s, g) => s + parseFloat(g.currentAmount), 0);
    const monthlyRequired = goals.reduce(
      (s, g) =>
        s +
        (monthlySavingsRequired(
          parseFloat(g.targetAmount),
          parseFloat(g.currentAmount),
          g.targetDate,
        ) ?? 0),
      0,
    );
    const overallPct = totalTarget > 0 ? Math.min(100, (totalCurrent / totalTarget) * 100) : 0;
    return { total, completed, totalTarget, totalCurrent, monthlyRequired, overallPct };
  }, [goals]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Goal created" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast({ title: "Failed to create goal", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/goals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Goal updated" });
      setDialogOpen(false);
      setEditGoal(null);
      setProgressGoal(null);
    },
    onError: (e: any) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Goal deleted" });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  // Handlers
  function openAdd() {
    setForm(EMPTY_FORM);
    setEditGoal(null);
    setDialogOpen(true);
  }

  function openEdit(goal: Goal) {
    setForm({
      title: goal.title,
      category: goal.category as CategoryValue,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      targetDate: formatDateInputValue(goal.targetDate),
      notes: goal.notes ?? "",
    });
    setEditGoal(goal);
    setDialogOpen(true);
  }

  function openProgress(goal: Goal) {
    setProgressAmount(parseFloat(goal.currentAmount).toFixed(2));
    setProgressGoal(goal);
  }

  function handleSaveGoal() {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const targetAmt = parseFloat(form.targetAmount);
    if (!form.targetAmount || isNaN(targetAmt) || targetAmt <= 0) {
      toast({ title: "Enter a valid target amount", variant: "destructive" });
      return;
    }
    const payload = {
      title: form.title.trim(),
      category: form.category,
      targetAmount: targetAmt,
      currentAmount: parseFloat(form.currentAmount) || 0,
      targetDate: form.targetDate || null,
      notes: form.notes || null,
    };
    if (editGoal) {
      updateMutation.mutate({ id: editGoal.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleProgressSave() {
    if (!progressGoal) return;
    updateMutation.mutate({
      id: progressGoal.id,
      data: { currentAmount: parseFloat(progressAmount) || 0 },
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap page-header-gradient">
        <div>
          <h1 className="text-2xl font-bold">Goals &amp; Tracking</h1>
          <p className="text-muted-foreground">Set financial goals and track your progress over time</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-goal">
          <Plus className="h-4 w-4 mr-2" /> Add Goal
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Goals</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d stat-card-3d-green border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-[#1C91D4]/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[#1C91D4]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Savings Required</p>
                <p className="text-lg font-bold">{formatCurrency(stats.monthlyRequired)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-violet-500/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overall Progress</p>
                <p className="text-lg font-bold">{stats.overallPct.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall progress bar */}
      {stats.total > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Combined Progress</span>
              <span className="text-muted-foreground">
                {formatCurrency(stats.totalCurrent)} of {formatCurrency(stats.totalTarget)}
              </span>
            </div>
            <Progress value={stats.overallPct} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Goals grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 space-y-4">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-2 bg-muted rounded" />
                <div className="h-8 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="h-7 w-7 text-primary" />
            </div>
            <p className="font-semibold text-lg">No goals yet</p>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Set your first financial goal — saving for a home, paying off debt, building an emergency fund, and more.
            </p>
            <Button onClick={openAdd} className="mt-2">
              <Plus className="h-4 w-4 mr-2" /> Add Your First Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Active goals ─────────────────────────────────────────────── */}
          {goals.filter((g) => parseFloat(g.currentAmount) < parseFloat(g.targetAmount)).length > 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
                Active Goals
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {goals
                  .filter((g) => parseFloat(g.currentAmount) < parseFloat(g.targetAmount))
                  .map((goal) => {
                    const cat = getCat(goal.category);
                    const Icon = cat.icon;
                    const target = parseFloat(goal.targetAmount);
                    const current = parseFloat(goal.currentAmount);
                    const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
                    const days = daysRemaining(goal.targetDate);
                    const overdue = days !== null && days < 0;
                    const monthlyRequired = monthlySavingsRequired(target, current, goal.targetDate);

                    return (
                      <Card key={goal.id} className="stat-card-3d border flex flex-col">
                        <CardContent className="p-5 flex flex-col gap-4 flex-1">
                          {/* Title row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`h-9 w-9 rounded-md ${cat.bg} flex items-center justify-center shrink-0`}>
                                <Icon className={`h-5 w-5 ${cat.color}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{goal.title}</p>
                                <Badge variant="outline" className={`text-xs mt-0.5 ${cat.border}`}>
                                  {cat.label}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{formatCurrency(current)} saved</span>
                              <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>
                            </div>
                            <Progress value={pct} className="h-2.5" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{formatCurrency(target - current)} to go</span>
                              <span>of {formatCurrency(target)}</span>
                            </div>
                          </div>

                          {/* Deadline and monthly savings needed */}
                          <div className="space-y-1 text-xs">
                            {goal.targetDate ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <Calendar className={`h-3.5 w-3.5 ${overdue ? "text-rose-500" : "text-muted-foreground"}`} />
                                  <span className={overdue ? "text-rose-500 font-medium" : "text-muted-foreground"}>
                                    {formatGoalDate(goal.targetDate, { month: "short", day: "numeric", year: "numeric" })}
                                    {" · "}
                                    {formatDaysRemaining(days)}
                                  </span>
                                </div>
                                {monthlyRequired !== null && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <TrendingUp className="h-3.5 w-3.5 text-[#1C91D4]" />
                                    <span>
                                      Monthly savings needed:{" "}
                                      <span className="font-medium text-foreground">{formatCurrency(monthlyRequired)}</span>
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">No deadline set</span>
                              </div>
                            )}
                          </div>

                          {/* Notes */}
                          {goal.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2">{goal.notes}</p>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-1 mt-auto">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => openProgress(goal)}
                              data-testid={`button-update-progress-${goal.id}`}
                            >
                              <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Update Progress
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openEdit(goal)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-rose-500 hover:text-rose-600" onClick={() => setDeleteId(goal.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ── Achieved goals ────────────────────────────────────────────── */}
          {goals.filter((g) => parseFloat(g.currentAmount) >= parseFloat(g.targetAmount)).length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
                  Achieved Goals
                </h2>
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0 text-xs">
                  {goals.filter((g) => parseFloat(g.currentAmount) >= parseFloat(g.targetAmount)).length} completed
                </Badge>
              </div>

              <div className="space-y-2">
                {goals
                  .filter((g) => parseFloat(g.currentAmount) >= parseFloat(g.targetAmount))
                  .map((goal) => {
                    const cat = getCat(goal.category);
                    const Icon = cat.icon;
                    const target = parseFloat(goal.targetAmount);

                    return (
                      <Card key={goal.id} className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20">
                        <CardContent className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {/* Icon */}
                            <div className={`h-8 w-8 rounded-md ${cat.bg} flex items-center justify-center shrink-0`}>
                              <Icon className={`h-4 w-4 ${cat.color}`} />
                            </div>

                            {/* Title + category */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm truncate">{goal.title}</p>
                                <Badge variant="outline" className={`text-xs ${cat.border} hidden sm:inline-flex`}>
                                  {cat.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatCurrency(target)} achieved
                                {goal.targetDate && (
                                  <span className="ml-2">
                                    · target was {formatGoalDate(goal.targetDate, { month: "short", year: "numeric" })}
                                    {" · "}
                                    <span className="font-medium text-emerald-700 dark:text-emerald-400">$0/mo needed</span>
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Done badge + actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(goal)}>
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-400 hover:text-rose-600" onClick={() => setDeleteId(goal.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditGoal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editGoal ? "Edit Goal" : "Add New Goal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Goal Title</Label>
              <Input
                placeholder="e.g. Emergency Fund, Down Payment…"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as CategoryValue }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <c.icon className={`h-4 w-4 ${c.color}`} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Target Amount ($)</Label>
                <CurrencyInput
                  value={form.targetAmount}
                  onChange={(v) => setForm((f) => ({ ...f, targetAmount: v }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Current Amount ($)</Label>
                <CurrencyInput
                  value={form.currentAmount}
                  onChange={(v) => setForm((f) => ({ ...f, currentAmount: v }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Target Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="Any notes about this goal…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSaveGoal}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving…" : editGoal ? "Save Changes" : "Create Goal"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Progress dialog */}
      <Dialog open={!!progressGoal} onOpenChange={(o) => { if (!o) setProgressGoal(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Progress</DialogTitle>
          </DialogHeader>
          {progressGoal && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{progressGoal.title}</span>
                {" — "}target: {formatCurrency(parseFloat(progressGoal.targetAmount))}
              </p>
              <div className="space-y-1.5">
                <Label>Current Amount Saved ($)</Label>
                <CurrencyInput
                  value={progressAmount}
                  onChange={setProgressAmount}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{((parseFloat(progressAmount) || 0) / parseFloat(progressGoal.targetAmount) * 100).toFixed(0)}% of target</span>
                  <span>{formatCurrency(parseFloat(progressGoal.targetAmount) - (parseFloat(progressAmount) || 0))} remaining</span>
                </div>
                <Progress
                  value={Math.min(100, ((parseFloat(progressAmount) || 0) / parseFloat(progressGoal.targetAmount)) * 100)}
                  className="h-2"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProgressGoal(null)}>Cancel</Button>
                <Button onClick={handleProgressSave} disabled={updateMutation.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete goal?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the goal and all its progress.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 hover:bg-rose-600"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
