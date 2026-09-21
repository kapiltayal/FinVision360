import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, CircleAlert, Landmark, Pencil, Plus, ShieldCheck, Trash2, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type CashflowItem = {
  id: string;
  projectionEntryId?: number;
  source: "social-security" | "pension" | "expected-expenses" | "debt-payment" | "projection-only";
  name: string;
  monthlyAmount: number;
  details: string | null;
  isProjectionOnly: boolean;
};
type Assumption = { kind: "income" | "expense"; name: string; messages: string[] };
type Projection = {
  retirementAge: number;
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  monthlySurplus: number;
  expectedMonthlyExpenses: number;
  income: CashflowItem[];
  expenses: CashflowItem[];
  assumptions: Assumption[];
};
type EntryForm = { kind: "income" | "expense"; name: string; amount: string; notes: string };

const projectionKey = ["/api/retirement/income-expense-projection"];
const money = (value: number) => `${formatCurrency(value)} /mo`;

function tone(source: CashflowItem["source"]) {
  if (source === "social-security") return { icon: ShieldCheck, color: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10" };
  if (source === "pension") return { icon: Landmark, color: "text-teal-700 dark:text-teal-300", bg: "bg-teal-500/10" };
  if (source === "debt-payment") return { icon: WalletCards, color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-500/10" };
  return { icon: source === "expected-expenses" ? TrendingDown : WalletCards, color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10" };
}

function EntryDialog({ open, onOpenChange, initial, kind, onSubmit, saving }: {
  open: boolean; onOpenChange: (open: boolean) => void; initial: EntryForm | null;
  kind: "income" | "expense";
  onSubmit: (form: EntryForm) => void; saving: boolean;
}) {
  const [form, setForm] = useState<EntryForm>(initial || { kind, name: "", amount: "", notes: "" });
  useEffect(() => setForm(initial || { kind, name: "", amount: "", notes: "" }), [initial, kind, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Edit" : "Add"} projection-only {form.kind}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
          {!initial && <div className="grid grid-cols-2 gap-2">
            {(["income", "expense"] as const).map((kind) => (
              <Button key={kind} type="button" variant={form.kind === kind ? "default" : "outline"} onClick={() => setForm({ ...form, kind })}>
                {kind === "income" ? "Income" : "Expense"}
              </Button>
            ))}
          </div>}
          <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="For example, rental income" required /></div>
          <div className="space-y-2"><Label>Monthly amount</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required /></div>
          <div className="space-y-2"><Label>Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save projection"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CashflowRow({ item, onEdit, onDelete }: { item: CashflowItem; onEdit: () => void; onDelete: () => void }) {
  const style = tone(item.source);
  const Icon = style.icon;
  return (
    <div className="group flex items-start gap-3 border-b border-current/10 px-4 py-3 last:border-b-0">
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.color}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.details || (item.isProjectionOnly ? "Projection-only estimate" : "Included in your retirement projection")}</p></div>
      <div className="flex shrink-0 items-center gap-1"><span className={`text-sm font-bold tabular-nums ${style.color}`}>{money(item.monthlyAmount)}</span>{item.isProjectionOnly && <span className="ml-1 flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} aria-label={`Edit ${item.name}`}><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete} aria-label={`Delete ${item.name}`}><Trash2 className="h-3.5 w-3.5" /></Button></span>}</div>
    </div>
  );
}

function Column({ kind, items, onAdd, onEdit, onDelete, expected, onExpectedChange, onExpectedBlur, savingExpected }: {
  kind: "income" | "expense"; items: CashflowItem[]; onAdd: () => void; onEdit: (item: CashflowItem) => void; onDelete: (item: CashflowItem) => void;
  expected?: number; onExpectedChange?: (value: number) => void; onExpectedBlur?: () => void; savingExpected?: boolean;
}) {
  const income = kind === "income";
  const displayItems = items.filter((item) => item.source !== "expected-expenses");
  return (
    <section className={`overflow-hidden rounded-2xl border ${income ? "border-teal-200/80 dark:border-teal-900" : "border-amber-200/80 dark:border-amber-900"}`}>
      <header className={`flex items-center justify-between border-b px-4 py-3 ${income ? "bg-teal-50/70 dark:bg-teal-950/20" : "bg-amber-50/70 dark:bg-amber-950/20"}`}>
        <div><h3 className="font-semibold">{income ? "Income" : "Expenses"}</h3><p className="text-xs text-muted-foreground">{income ? "Reliable monthly income at retirement" : "Monthly commitments to plan for"}</p></div>
        <Button size="sm" variant="outline" onClick={onAdd}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
      </header>
      <div className="bg-background">
        {displayItems.length === 0 && income ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">No projected income yet.</div> : displayItems.map((item) => (
          <CashflowRow key={item.id} item={item} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        ))}
        {!income && expected !== undefined && onExpectedChange && <div className="border-t bg-amber-50/40 px-4 py-3 dark:bg-amber-950/10">
          <div className="flex items-center gap-3"><div className="h-8 w-8 shrink-0 rounded-lg bg-amber-500/10" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Expected lifestyle expenses</p><p className="text-xs text-muted-foreground">Your editable spending baseline</p></div><div className="flex items-center"><span className="text-sm font-bold text-amber-700 dark:text-amber-300">$</span><Input className="h-8 w-24 border-amber-300/70 bg-background text-right font-semibold tabular-nums" type="number" min="0" step="1" value={expected} onChange={(e) => onExpectedChange(Number(e.target.value) || 0)} onBlur={onExpectedBlur} disabled={savingExpected} /><span className="ml-1 text-xs font-medium text-amber-700 dark:text-amber-300">/mo</span></div></div>
        </div>}
      </div>
    </section>
  );
}

function Assumptions({ assumptions }: { assumptions: Assumption[] }) {
  const [open, setOpen] = useState(false);
  return <section className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800">
    <button type="button" className="flex w-full items-center justify-between gap-3 bg-slate-50/80 px-4 py-3 text-left hover:bg-slate-100/80 dark:bg-slate-900/40 dark:hover:bg-slate-900/70" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span className="flex items-center gap-2 font-semibold"><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />Assumptions &amp; Callout</span><span className="text-xs text-muted-foreground">{assumptions.length ? `${assumptions.length} note${assumptions.length === 1 ? "" : "s"}` : "All inputs considered"}</span>
    </button>
    {open && <div className="space-y-2 border-t p-4">{assumptions.length ? assumptions.map((a, index) => <div key={`${a.kind}-${a.name}-${index}`} className="rounded-lg border p-3"><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${a.kind === "income" ? "bg-teal-500/10 text-teal-700 dark:text-teal-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{a.kind}</span><span className="text-sm font-semibold">{a.name}</span></div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{a.messages.map((message, i) => <li key={`${message}-${i}`}>{message}</li>)}</ul></div>) : <p className="text-sm text-muted-foreground">Your retirement income and expense inputs are being used as entered.</p>}</div>}
  </section>;
}

export function RetirementIncomeExpenseProjection() {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<Projection>({
    queryKey: projectionKey,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CashflowItem | null>(null);
  const [draftKind, setDraftKind] = useState<"income" | "expense">("income");
  const [expected, setExpected] = useState<number | null>(null);
  const [expectedDirty, setExpectedDirty] = useState(false);
  useEffect(() => { if (data && !expectedDirty) setExpected(data.expectedMonthlyExpenses); }, [data?.expectedMonthlyExpenses, expectedDirty]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: projectionKey });
  const entryMutation = useMutation({
    mutationFn: (form: EntryForm) => apiRequest(editing ? "PATCH" : "POST", editing ? `/api/retirement/income-expense-entries/${editing.projectionEntryId}` : "/api/retirement/income-expense-entries", { kind: form.kind, name: form.name, amount: Number(form.amount), notes: form.notes }),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Projection saved", description: "Your retirement cash flow was updated." }); },
    onError: (error: Error) => toast({ title: "Could not save projection", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (item: CashflowItem) => apiRequest("DELETE", `/api/retirement/income-expense-entries/${item.projectionEntryId}`),
    onSuccess: () => { invalidate(); toast({ title: "Projection removed" }); },
    onError: (error: Error) => toast({ title: "Could not remove projection", description: error.message, variant: "destructive" }),
  });
  const settingsMutation = useMutation({
    mutationFn: (value: number) => apiRequest("PUT", "/api/retirement/income-expense-settings", { expectedMonthlyExpenses: value }),
    onSuccess: async (_response, value) => {
      await invalidate();
      setExpected(value);
      setExpectedDirty(false);
      toast({ title: "Expenses baseline saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save expense baseline", description: error.message, variant: "destructive" }),
  });
  const grouped = useMemo(() => ({ income: data?.income || [], expenses: data?.expenses || [] }), [data?.income, data?.expenses]);
  if (isLoading) return <div className="space-y-4"><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="grid gap-4 md:grid-cols-2"><div className="h-64 animate-pulse rounded-2xl bg-muted" /><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div></div>;
  if (isError || !data) return <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center dark:border-rose-900 dark:bg-rose-950/20"><CircleAlert className="mx-auto h-8 w-8 text-rose-600" /><p className="mt-3 font-semibold">We couldn’t load your retirement cash flow</p><p className="mt-1 text-sm text-muted-foreground">Your saved plan is safe. Try loading it again.</p><Button className="mt-4" variant="outline" onClick={() => refetch()}>Try again</Button></div>;
  const surplus = data.monthlySurplus;
  const openAdd = (kind: "income" | "expense") => { setEditing(null); setDraftKind(kind); setDialogOpen(true); };
  const openEdit = (item: CashflowItem, kind: "income" | "expense") => { setEditing(item); setDraftKind(kind); setDialogOpen(true); };
  return <div className="space-y-5">
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-teal-50/60 to-amber-50/60 px-5 py-6 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-teal-950/20 dark:to-amber-950/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">At age {data.retirementAge}</p><h2 className="mt-1 text-xl font-bold tracking-tight">Your retirement monthly picture</h2></div><div className="text-left sm:text-right"><p className="text-xs text-muted-foreground">{surplus >= 0 ? "Monthly surplus" : "Monthly shortfall"}</p><p className={`text-3xl font-bold tabular-nums ${surplus >= 0 ? "text-teal-700 dark:text-teal-300" : "text-rose-700 dark:text-rose-300"}`}>{money(Math.abs(surplus))}</p></div></div>
      <div className="mt-5 grid grid-cols-2 divide-x rounded-xl border bg-background/70 sm:grid-cols-3"><div className="p-3"><p className="text-xs text-muted-foreground">Total income</p><p className="mt-1 text-lg font-bold tabular-nums text-teal-700 dark:text-teal-300">{money(data.totalMonthlyIncome)}</p></div><div className="p-3 pl-4"><p className="text-xs text-muted-foreground">Total expenses</p><p className="mt-1 text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">{money(data.totalMonthlyExpenses)}</p></div><div className="col-span-2 border-t p-3 sm:col-span-1 sm:border-l sm:border-t-0 sm:pl-4"><p className="text-xs text-muted-foreground">Income coverage</p><p className="mt-1 text-lg font-bold tabular-nums">{data.totalMonthlyExpenses ? `${Math.round(data.totalMonthlyIncome / data.totalMonthlyExpenses * 100)}%` : "—"}</p></div></div>
    </div>
    <div className="grid items-start gap-4 md:grid-cols-2">
      <Column kind="income" items={grouped.income} onAdd={() => openAdd("income")} onEdit={(item) => openEdit(item, "income")} onDelete={(item) => { if (window.confirm(`Remove ${item.name} from your projection?`)) deleteMutation.mutate(item); }} />
      <Column kind="expense" items={grouped.expenses} expected={expected ?? data.expectedMonthlyExpenses} onExpectedChange={(value) => { setExpected(value); setExpectedDirty(true); }} onExpectedBlur={() => { if (expected !== null) settingsMutation.mutate(expected); }} savingExpected={settingsMutation.isPending} onAdd={() => openAdd("expense")} onEdit={(item) => openEdit(item, "expense")} onDelete={(item) => { if (window.confirm(`Remove ${item.name} from your projection?`)) deleteMutation.mutate(item); }} />
    </div>
    <Assumptions assumptions={data.assumptions || []} />
    <EntryDialog open={dialogOpen} onOpenChange={setDialogOpen} kind={draftKind} saving={entryMutation.isPending} initial={editing ? { kind: draftKind, name: editing.name, amount: String(editing.monthlyAmount), notes: editing.details || "" } : null} onSubmit={(form) => entryMutation.mutate(form)} />
  </div>;
}