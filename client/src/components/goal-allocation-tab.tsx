import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowDown, ArrowRight, Banknote, Check, ClipboardList, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format";
import { applySavedOrder, moveItem } from "@/lib/goal-allocation-order";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { accountAllocationColor, GoalAllocationConnections } from "./goal-allocation-connections";

type AllocationGoal = {
  id: number; title: string; category: string; targetAmount: string; currentAmount: string;
  legacyAmount?: string; allocatedAmount?: string; targetDate?: string | null;
};
type AllocationAccount = {
  id: number; name: string; category: string; institution?: string | null; value: string;
  allocatedAmount: string; unallocatedAmount: string; deficitAmount: string;
};
type AllocationLink = { id: number; assetId: number; goalId: number; amount: string };
type AllocationOrder = { accountOrder: number[]; activeGoalOrder: number[] };
type AllocationData = {
  accounts: AllocationAccount[]; goals: AllocationGoal[]; allocations: AllocationLink[];
  accountOrder?: number[]; activeGoalOrder?: number[];
};

const money = (value: string | number | null | undefined) => Number(value || 0);
const cents = (value: number) => Math.round(value * 100) / 100;
const ACCOUNT_ORDER_DRAG_TYPE = "application/x-finvision-account-order";
const GOAL_ORDER_DRAG_TYPE = "application/x-finvision-goal-order";
const hasDragType = (dataTransfer: DataTransfer, type: string) => Array.from(dataTransfer.types).includes(type);

function invalidateAllocationData() {
  void queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
  void queryClient.invalidateQueries({ queryKey: ["/api/goal-allocations"] });
  void queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/budget-plan") });
}

export function GoalAllocationTab({ onAddGoal }: { onAddGoal: () => void }) {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<AllocationData>({
    queryKey: ["/api/goal-allocations"],
  });
  const [editor, setEditor] = useState<{ assetId: number; goalId: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [legacyAmount, setLegacyAmount] = useState("0");
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<number | null>(null);
  const [draggingGoalId, setDraggingGoalId] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: (body: { assetId: number; goalId: number; amount: number; legacyAmount: number }) =>
      apiRequest("POST", "/api/goal-allocations", body),
    onSuccess: () => {
      invalidateAllocationData();
      toast({ title: "Allocation saved", description: "Your goal funding has been updated." });
      setEditor(null);
    },
    onError: (error: Error) => toast({ title: "Could not save allocation", description: error.message, variant: "destructive" }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/goal-allocations/${id}`),
    onSuccess: () => {
      invalidateAllocationData();
      toast({ title: "Allocation removed" });
      setRemoveId(null);
    },
    onError: (error: Error) => toast({ title: "Could not remove allocation", description: error.message, variant: "destructive" }),
  });

  const orderMutation = useMutation({
    mutationFn: (order: AllocationOrder) =>
      apiRequest("PUT", "/api/goal-allocations/order", order).then((response) => response.json() as Promise<AllocationOrder>),
    onMutate: async (order) => {
      const queryKey = ["/api/goal-allocations"];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AllocationData>(queryKey);
      if (previous) queryClient.setQueryData<AllocationData>(queryKey, { ...previous, ...order });
      return {
        previousOrder: previous
          ? { accountOrder: previous.accountOrder, activeGoalOrder: previous.activeGoalOrder }
          : null,
      };
    },
    onError: (error: Error, _order, context) => {
      const queryKey = ["/api/goal-allocations"];
      if (context?.previousOrder) {
        queryClient.setQueryData<AllocationData>(queryKey, (current) =>
          current ? { ...current, ...context.previousOrder } : current);
      } else void queryClient.invalidateQueries({ queryKey });
      toast({ title: "Could not save tile order", description: error.message, variant: "destructive" });
    },
    onSuccess: (savedOrder) => {
      queryClient.setQueryData<AllocationData>(["/api/goal-allocations"], (current) =>
        current ? { ...current, ...savedOrder } : current);
    },
  });

  const accountById = useMemo(() => new Map((data?.accounts ?? []).map((a) => [a.id, a])), [data?.accounts]);
  const goalById = useMemo(() => new Map((data?.goals ?? []).map((g) => [g.id, g])), [data?.goals]);
  const totalAvailable = (data?.accounts ?? []).reduce((sum, account) => sum + money(account.unallocatedAmount), 0);
  const totalAllocated = (data?.accounts ?? []).reduce((sum, account) => sum + money(account.allocatedAmount), 0);
  const totalGoalAmountToGo = (data?.goals ?? []).reduce((sumCents, goal) => {
    const remainingCents = Math.max(
      0,
      Math.round(money(goal.targetAmount) * 100) - Math.round(money(goal.currentAmount) * 100),
    );
    return sumCents + remainingCents;
  }, 0) / 100;
  const currentPair = editor && data ? data.allocations.find((a) => a.assetId === editor.assetId && a.goalId === editor.goalId) : undefined;
  const selectedAccount = editor ? accountById.get(editor.assetId) : undefined;
  const selectedGoal = editor ? goalById.get(editor.goalId) : undefined;
  const amountValue = Number(amount);
  const legacyValue = Number(legacyAmount);
  const existingPairAmount = money(currentPair?.amount);
  const availableForPair = selectedAccount
    ? Math.max(existingPairAmount, existingPairAmount + money(selectedAccount.unallocatedAmount))
    : 0;
  const legacyAvailable = selectedGoal ? money(selectedGoal.legacyAmount) : 0;
  const goalRemaining = selectedGoal
    ? Math.max(0, money(selectedGoal.targetAmount) - money(selectedGoal.currentAmount))
    : 0;
  const netGoalIncrease = Math.max(0, amountValue - existingPairAmount - legacyValue);
  const invalidAmount = !amount.trim() || !Number.isFinite(amountValue) || amountValue <= 0 ||
    cents(amountValue) > cents(availableForPair) || cents(netGoalIncrease) > cents(goalRemaining);
  const invalidLegacy = !legacyAmount.trim() || !Number.isFinite(legacyValue) || legacyValue < 0 ||
    cents(legacyValue) > cents(legacyAvailable) ||
    cents(legacyValue) > cents(Math.max(0, amountValue - existingPairAmount)) ||
    cents(netGoalIncrease) > cents(goalRemaining);

  function openEditor(assetId: number, goalId: number) {
    const account = accountById.get(assetId);
    const goal = goalById.get(goalId);
    if (!account || !goal) return;
    const existing = data?.allocations.find((allocation) => allocation.assetId === assetId && allocation.goalId === goalId);
    setEditor({ assetId, goalId });
    setAmount(String(existing ? money(existing.amount) : 0));
    setLegacyAmount("0");
    if (account && money(account.unallocatedAmount) <= 0 && !existing) {
      toast({ title: "No unallocated funds", description: "This account has no available balance to assign.", variant: "destructive" });
      setEditor(null);
    }
  }

  function submitAllocation() {
    if (!editor || invalidAmount || invalidLegacy) return;
    saveMutation.mutate({
      ...editor,
      amount: cents(amountValue),
      legacyAmount: cents(legacyValue),
    });
  }

  if (isLoading) {
    return <div className="space-y-5" aria-label="Loading goal allocations">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-muted/70" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted/70" />
    </div>;
  }
  if (isError || !data) {
    return <Card><CardContent className="flex flex-col items-center px-6 py-12 text-center">
      <AlertCircle className="mb-3 h-9 w-9 text-rose-500" />
      <h2 className="font-semibold">Allocations aren’t available right now</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">We couldn’t load your accounts and goal links. Your existing balances haven’t been changed.</p>
      <Button className="mt-4" onClick={() => void refetch()}>Try again</Button>
    </CardContent></Card>;
  }

  const allocationData = data;
  const accountsByBalance = [...allocationData.accounts].sort((left, right) => money(right.value) - money(left.value));
  const orderedAccounts = applySavedOrder(accountsByBalance, allocationData.accountOrder ?? []);
  const activeGoals = applySavedOrder(
    allocationData.goals.filter((goal) => money(goal.currentAmount) < money(goal.targetAmount)),
    allocationData.activeGoalOrder ?? [],
  );
  const completedGoals = allocationData.goals.filter((goal) => money(goal.currentAmount) >= money(goal.targetAmount));
  function persistTileOrder(accounts: AllocationAccount[], goals: AllocationGoal[]) {
    if (orderMutation.isPending) return;
    orderMutation.mutate({
      accountOrder: accounts.map((account) => account.id),
      activeGoalOrder: goals.map((goal) => goal.id),
    });
  }
  function reorderAccount(movingId: number, targetId: number, afterTarget = false) {
    const next = moveItem(orderedAccounts, movingId, targetId, afterTarget);
    if (next !== orderedAccounts && next.some((item, index) => item.id !== orderedAccounts[index]?.id)) {
      persistTileOrder(next, activeGoals);
    }
  }
  function reorderGoal(movingId: number, targetId: number, afterTarget = false) {
    const next = moveItem(activeGoals, movingId, targetId, afterTarget);
    if (next !== activeGoals && next.some((item, index) => item.id !== activeGoals[index]?.id)) {
      persistTileOrder(orderedAccounts, next);
    }
  }
  function renderGoal(goal: AllocationGoal, reorderable = false) {
    const goalLinks = allocationData.allocations.filter((link) => link.goalId === goal.id);
    const total = money(goal.currentAmount);
    const target = money(goal.targetAmount);
    const legacy = money(goal.legacyAmount);
    const allocated = goal.allocatedAmount === undefined
      ? goalLinks.reduce((sum, link) => sum + money(link.amount), 0)
      : money(goal.allocatedAmount);
    const remaining = Math.max(0, target - total);
    const pct = target ? Math.min(100, total / target * 100) : 0;
    return <article key={goal.id} data-allocation-goal={goal.id}
      onDragOver={(event) => { if (draggingAssetId !== null || (reorderable && draggingGoalId !== null)) event.preventDefault(); }}
      onDrop={(event) => {
        const sortId = Number(event.dataTransfer.getData(GOAL_ORDER_DRAG_TYPE));
        if (reorderable && Number.isSafeInteger(sortId) && sortId > 0) {
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          reorderGoal(sortId, goal.id, event.clientY >= bounds.top + bounds.height / 2);
          setDraggingGoalId(null);
          return;
        }
        event.preventDefault();
        const id = Number(event.dataTransfer.getData("text/plain"));
        setDraggingAssetId(null);
        if (Number.isInteger(id) && accountById.has(id)) openEditor(id, goal.id);
      }}
      className={`rounded-lg border bg-card p-3 shadow-sm transition-colors ${draggingAssetId !== null ? "border-primary/60 bg-primary/[0.035] ring-1 ring-primary/15" : "hover:border-primary/35"} ${draggingGoalId === goal.id ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          {reorderable && <button
            type="button"
            draggable={!orderMutation.isPending}
            disabled={orderMutation.isPending}
            aria-label={`Reorder goal ${goal.title}; use up or down arrow keys to move`}
            title="Drag to reorder, or use the up/down arrow keys"
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(GOAL_ORDER_DRAG_TYPE, String(goal.id));
              setDraggingGoalId(goal.id);
            }}
            onDragEnd={() => setDraggingGoalId(null)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              const index = activeGoals.findIndex((item) => item.id === goal.id);
              const target = activeGoals[index + (event.key === "ArrowUp" ? -1 : 1)];
              if (target) reorderGoal(goal.id, target.id, event.key === "ArrowDown");
            }}
            className="inline-flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          ><GripVertical className="h-4 w-4" aria-hidden="true" /></button>}
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h4 className="truncate font-semibold">{goal.title}</h4>{total >= target && <Badge className="border-0 bg-emerald-500/10 text-emerald-700"><Check className="mr-1 h-3 w-3" />Reached</Badge>}</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(total)} total funding of {formatCurrency(target)}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" disabled={allocationData.accounts.length === 0} onClick={() => {
          const first = allocationData.accounts.find((account) => money(account.unallocatedAmount) > 0) ??
            allocationData.accounts.find((account) => allocationData.allocations.some((link) => link.assetId === account.id && link.goalId === goal.id)) ??
            allocationData.accounts[0];
          if (first) openEditor(first.id, goal.id);
        }} aria-label={`Assign account funds to ${goal.title}`}><Plus className="mr-1.5 h-3.5 w-3.5" /> Assign</Button>
      </div>
      <Progress value={pct} className="mt-2 h-1" />
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-muted/35 px-2.5 py-2 text-xs sm:grid-cols-3">
        <div><p className="text-muted-foreground">Account allocations</p><p className="mt-0.5 font-semibold">{formatCurrency(allocated)}</p></div>
        <div><p className="text-muted-foreground">Legacy funding</p><p className="mt-0.5 font-semibold text-amber-700">{formatCurrency(legacy)}</p></div>
        <div><p className="text-muted-foreground">{remaining > 0 ? "Remaining target" : "Target status"}</p><p className="mt-0.5 font-semibold">{remaining > 0 ? formatCurrency(remaining) : "Fully funded"}</p></div>
      </div>
      <div className="mt-2 space-y-1">
        {goalLinks.length === 0 ? <p className="text-xs text-muted-foreground">No account links yet. Assign cash to see it here.</p> :
          goalLinks.map((link) => {
            const account = accountById.get(link.assetId);
            if (!account) return null;
            return <div key={link.id} data-allocation-row={link.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background" style={{ backgroundColor: accountAllocationColor(link.assetId) }} />
                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /><span className="truncate text-sm">{account.name}</span>
              </div>
              <div className="flex items-center gap-1.5"><span className="whitespace-nowrap text-sm font-semibold">{formatCurrency(link.amount)}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(link.assetId, goal.id)} aria-label={`Edit ${account.name} allocation for ${goal.title}`}><span className="text-xs">Edit</span></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700" onClick={() => setRemoveId(link.id)} aria-label={`Remove ${account.name} allocation from ${goal.title}`}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>;
          })}
        {legacy > 0 && <p className="flex items-center gap-1.5 px-1 text-xs text-amber-700"><ArrowDown className="h-3.5 w-3.5" /> {formatCurrency(legacy)} tracked outside account links</p>}
      </div>
    </article>;
  }

  return (
    <section className="space-y-4" aria-label="Goal allocation">
      <Card className="stat-card-surface">
        <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">A clearer way to save</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Give every dollar a direction.</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Earmark cash already in your accounts—no transfers, no new buckets. Drag an account to a goal, or use the assign button.</p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground sm:self-auto">
            <ClipboardList className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Allocation is a plan, not a transfer
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-primary/15 bg-primary/[0.035]"><CardContent className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Unassigned cash</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{formatCurrency(totalAvailable)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available across eligible accounts</p>
        </CardContent></Card>
        <Card><CardContent className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Earmarked for goals</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{formatCurrency(totalAllocated)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Still held in your accounts</p>
        </CardContent></Card>
        <Card><CardContent className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Goal amount to go</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{formatCurrency(totalGoalAmountToGo)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Across active goals</p>
        </CardContent></Card>
      </div>

      {(data.accounts.length === 0 || data.goals.length === 0) && (
        <Card className="border-dashed"><CardContent className="grid gap-4 p-8 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Banknote className="h-6 w-6" /></div>
          <div><h3 className="font-semibold">{data.accounts.length === 0 ? "Add an account to start allocating" : "Create a goal to give your cash a purpose"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{data.accounts.length === 0 ? "Once your assets are in FinVision360, you can earmark available balances here." : "Your existing accounts will appear here as soon as you have a goal to fund."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.accounts.length === 0 && <Button asChild variant="outline"><Link href="/assets">Go to Assets</Link></Button>}
              {data.goals.length === 0 && <Button onClick={onAddGoal}>Add a goal</Button>}
            </div>
          </div>
        </CardContent></Card>
      )}
      {data.goals.length > 0 && (
        <GoalAllocationConnections allocations={data.allocations}>
          <div className="grid gap-y-6 lg:grid-cols-[253px_minmax(0,1fr)] lg:gap-x-48 xl:grid-cols-[276px_minmax(0,1fr)] xl:gap-x-72">
          <section aria-labelledby="alloc-accounts-heading" className="min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <div><h3 id="alloc-accounts-heading" className="font-semibold">Your accounts</h3><p className="text-xs text-muted-foreground">Drag one onto a goal to assign cash</p></div>
              <Badge variant="secondary">{data.accounts.length}</Badge>
            </div>
            <div className="space-y-2">
              {orderedAccounts.map((account, accountIndex) => {
                const deficit = money(account.deficitAmount);
                return <article
                  key={account.id}
                  data-allocation-account={account.id}
                  onDragOver={(event) => {
                    if (hasDragType(event.dataTransfer, ACCOUNT_ORDER_DRAG_TYPE)) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(event) => {
                    const movingId = Number(event.dataTransfer.getData(ACCOUNT_ORDER_DRAG_TYPE));
                    if (!Number.isSafeInteger(movingId) || movingId <= 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    reorderAccount(movingId, account.id, event.clientY >= bounds.top + bounds.height / 2);
                    setDraggingAssetId(null);
                  }}
                  className={`rounded-lg border bg-card p-3 shadow-sm transition-opacity ${draggingAssetId === account.id ? "opacity-50" : "hover:border-primary/35"}`}
                  aria-label={`${account.name}, ${formatCurrency(account.value)} total, ${formatCurrency(account.unallocatedAmount)} unallocated`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-1.5">
                      <button
                        type="button"
                        draggable={!orderMutation.isPending}
                        disabled={orderMutation.isPending}
                        aria-label={`Reorder account ${account.name}; use up or down arrow keys to move`}
                        title="Drag to reorder, or use the up/down arrow keys"
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(ACCOUNT_ORDER_DRAG_TYPE, String(account.id));
                          event.dataTransfer.setData("text/plain", String(account.id));
                          setDraggingAssetId(account.id);
                        }}
                        onDragEnd={() => setDraggingAssetId(null)}
                        onKeyDown={(event) => {
                          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                          event.preventDefault();
                          const target = orderedAccounts[accountIndex + (event.key === "ArrowUp" ? -1 : 1)];
                          if (target) reorderAccount(account.id, target.id, event.key === "ArrowDown");
                        }}
                        className="inline-flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                      ><GripVertical className="h-4 w-4" aria-hidden="true" /></button>
                      <div className="flex min-w-0 items-start gap-2">
                        <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background" style={{ backgroundColor: accountAllocationColor(account.id) }} />
                        <div className="min-w-0"><p className="truncate font-medium">{account.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{account.institution || account.category}</p></div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total balance</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatCurrency(account.value)}</p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                    <div><p className="text-muted-foreground">Unallocated</p><p className={`mt-0.5 font-semibold ${deficit > 0 ? "text-rose-600" : ""}`}>{formatCurrency(account.unallocatedAmount)}</p></div>
                    <div className="text-right"><p className="text-muted-foreground">Assigned</p><p className="mt-0.5 font-semibold">{formatCurrency(account.allocatedAmount)}</p></div>
                  </div>
                  {deficit > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600"><AlertCircle className="h-3.5 w-3.5" /> Overallocated by {formatCurrency(deficit)}</p>}
                </article>;
              })}
            </div>
          </section>

          <section aria-labelledby="alloc-goals-heading" className="min-w-0 space-y-3 lg:max-w-lg">
            <div className="flex items-center justify-between">
              <div><h3 id="alloc-goals-heading" className="font-semibold">Goals &amp; allocations</h3><p className="text-xs text-muted-foreground">Change or release any connection at any time</p></div>
              <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
            </div>
            <div className="space-y-3">
              {activeGoals.length === 0 && <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No active goals. Completed goals stay available below.</p>}
              {activeGoals.map((goal) => renderGoal(goal, true))}
            </div>
            {completedGoals.length > 0 && <details className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-medium [&::-webkit-details-marker]:hidden">
                <span>Completed goals <Badge className="ml-2 border-0 bg-emerald-500/10 text-emerald-700">{completedGoals.length}</Badge></span>
                <span className="text-xs text-muted-foreground group-open:hidden">Show allocations</span>
                <span className="hidden text-xs text-muted-foreground group-open:inline">Hide allocations</span>
              </summary>
              <div className="space-y-3 border-t p-3 sm:p-4">{completedGoals.map((goal) => renderGoal(goal))}</div>
            </details>}
          </section>
          </div>
        </GoalAllocationConnections>
      )}

      <Dialog open={!!editor} onOpenChange={(open) => { if (!open) setEditor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{currentPair ? "Edit allocation" : "Allocate account funds"}</DialogTitle></DialogHeader>
          {selectedAccount && selectedGoal && <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{selectedAccount.name} <span className="text-muted-foreground">→</span> {selectedGoal.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">Available to assign: {formatCurrency(availableForPair)} · no money leaves this account</p></div>
            <div className="space-y-2"><Label htmlFor="allocation-account">Account</Label>
              <Select value={String(editor?.assetId ?? "")} onValueChange={(value) => {
                const nextAssetId = Number(value);
                const nextPair = data.allocations.find((link) => link.assetId === nextAssetId && link.goalId === selectedGoal.id);
                setEditor({ assetId: nextAssetId, goalId: selectedGoal.id });
                setAmount(String(nextPair ? money(nextPair.amount) : 0));
              }}>
                <SelectTrigger id="allocation-account"><SelectValue placeholder="Choose account" /></SelectTrigger>
                <SelectContent>{data.accounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name} · {formatCurrency(account.unallocatedAmount)} free</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="allocation-amount">Total amount assigned ($)</Label>
              <Input id="allocation-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} aria-describedby="allocation-limit" />
              <p id="allocation-limit" className={`text-xs ${invalidAmount ? "text-rose-600" : "text-muted-foreground"}`}>{invalidAmount
                ? amountValue <= 0 || !amount.trim() ? "Enter an amount greater than zero."
                  : cents(netGoalIncrease) > cents(goalRemaining) ? "The added funding exceeds this goal's remaining target."
                  : "Amount exceeds the available balance for this account."
                : `Account capacity: ${formatCurrency(availableForPair)} · Goal remaining: ${formatCurrency(goalRemaining)}`}</p></div>
            {legacyAvailable > 0 && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <Label htmlFor="legacy-conversion">Move legacy funding into this account link ($)</Label>
              <Input id="legacy-conversion" type="number" inputMode="decimal" min="0" max={legacyAvailable} step="0.01" value={legacyAmount} onChange={(event) => {
                const mapped = Number(event.target.value);
                setLegacyAmount(event.target.value);
                if (Number.isFinite(mapped) && mapped > 0) {
                  setAmount(String(cents(money(currentPair?.amount) + mapped)));
                }
              }} aria-describedby="legacy-help" />
              <p id="legacy-help" className={`text-xs ${invalidLegacy ? "text-rose-600" : "text-muted-foreground"}`}>Up to {formatCurrency(legacyAvailable)} is currently unlinked. Converting keeps total goal funding unchanged.</p>
            </div>}
            <DialogFooter><Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button><Button onClick={submitAllocation} disabled={saveMutation.isPending || invalidAmount || invalidLegacy}>{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save allocation</Button></DialogFooter>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={removeId !== null} onOpenChange={(open) => { if (!open) setRemoveId(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Release this allocation?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This removes the account-to-goal connection. The cash stays in its account and your goal funding total will decrease by this linked amount.</p>
          <DialogFooter><Button variant="outline" onClick={() => setRemoveId(null)}>Keep allocation</Button><Button variant="destructive" disabled={removeMutation.isPending} onClick={() => removeId !== null && removeMutation.mutate(removeId)}>{removeMutation.isPending ? "Removing…" : "Remove allocation"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
