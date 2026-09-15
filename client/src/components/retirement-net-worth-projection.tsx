import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { groupedBookCategories, type BookCategory } from "@/lib/book-categories";

export type RetirementProjectionAsset = {
  id: string | number;
  sourceAssetId?: number | null;
  projectionEntryId?: number;
  name: string;
  parentCategory: string;
  category: string;
  currentValue: number;
  projectedValue: number;
  returnRate: number;
  rateSource: "override" | "account" | "asset-type-default" | "projection-only";
  institution?: string | null;
  isProjectionOnly?: boolean;
  details?: string | null;
};

export type RetirementProjectionLiability = {
  id: string | number;
  sourceLiabilityId?: number | null;
  projectionEntryId?: number;
  name: string;
  parentCategory: string;
  category: string;
  currentBalance: number;
  projectedBalance: number;
  interestRate: number;
  minimumPayment: number;
  maturityDate?: string | null;
  status: "paid-off" | "remaining" | "unknown";
  message?: string | null;
  institution?: string | null;
  isProjectionOnly?: boolean;
};

export type RetirementProjection = {
  retirementAge: number;
  yearsToRetirement: number;
  projectedNetWorth: number;
  projectedAssetTotal: number;
  projectedLiabilityTotal: number;
  assets: RetirementProjectionAsset[];
  liabilities: RetirementProjectionLiability[];
};

export type ProjectionEntryInput = {
  kind: "asset" | "liability";
  name: string;
  parentCategory: string;
  category: string;
  amount: string;
  notes: string;
};

type ProjectionActions = {
  onAssetRateChange: (assetId: number, rateOfReturn: number) => Promise<unknown>;
  onAssetRateReset: (assetId: number) => Promise<unknown>;
  onSaveEntry: (entryId: number | null, entry: ProjectionEntryInput) => Promise<unknown>;
  onDeleteEntry: (entryId: number) => void;
  saving: boolean;
};

function sourceLabel(source: RetirementProjectionAsset["rateSource"]) {
  if (source === "override") return "your projection override";
  if (source === "account") return "account rate";
  if (source === "asset-type-default") return "asset type default";
  return "retirement value";
}

function AssetRow({ asset, actions }: { asset: RetirementProjectionAsset; actions: ProjectionActions }) {
  const [rate, setRate] = useState(asset.returnRate);
  const [savingRate, setSavingRate] = useState(false);
  useEffect(() => setRate(asset.returnRate), [asset.returnRate]);

  if (asset.isProjectionOnly) {
    return (
      <div className="rounded-lg border bg-background p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{asset.name}</p>
            <p className="text-xs text-muted-foreground">Projection-only asset at retirement</p>
            {asset.details && <p className="mt-1 text-xs text-muted-foreground">{asset.details}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatCurrency(asset.projectedValue)}
            </p>
            <div className="mt-1 flex justify-end gap-1">
              <Button size="icon" variant="ghost" onClick={() => void actions.onSaveEntry(asset.projectionEntryId!, {
                kind: "asset",
                name: asset.name,
                parentCategory: asset.parentCategory,
                category: asset.category,
                amount: String(asset.projectedValue),
                notes: asset.details || "",
              })}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => actions.onDeleteEntry(asset.projectionEntryId!)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{asset.name}</p>
          <p className="truncate text-xs text-muted-foreground">{asset.institution || "Asset account"}</p>
        </div>
        <p className="shrink-0 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
          {formatCurrency(asset.projectedValue)}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Initial value <strong className="text-foreground">{formatCurrency(asset.currentValue)}</strong></span>
        <span>Rate used <strong className="text-foreground">{rate.toFixed(1)}%</strong> ({sourceLabel(asset.rateSource)})</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Slider
          min={0}
          max={30}
          step={0.1}
          value={[rate]}
          onValueChange={([nextRate]) => setRate(nextRate)}
          disabled={savingRate}
          onValueCommit={async ([nextRate]) => {
            setSavingRate(true);
            try {
              await actions.onAssetRateChange(asset.sourceAssetId!, nextRate);
            } catch {
              setRate(asset.returnRate);
            } finally {
              setSavingRate(false);
            }
          }}
          aria-label={`${asset.name} expected annual return`}
          className="flex-1"
        />
        {asset.rateSource === "override" && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 px-2 text-xs"
            disabled={savingRate}
            onClick={async () => {
              setSavingRate(true);
              try {
                await actions.onAssetRateReset(asset.sourceAssetId!);
              } finally {
                setSavingRate(false);
              }
            }}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}

function LiabilityRow({ liability, actions }: { liability: RetirementProjectionLiability; actions: ProjectionActions }) {
  const paidOff = liability.status === "paid-off" || liability.projectedBalance <= 0;
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{liability.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {liability.isProjectionOnly ? "Projection-only liability at retirement" : liability.institution || "Liability account"}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold tabular-nums ${paidOff ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
            {paidOff ? "Paid off" : formatCurrency(liability.projectedBalance)}
          </p>
          {liability.isProjectionOnly && (
            <div className="mt-1 flex justify-end gap-1">
              <Button size="icon" variant="ghost" onClick={() => void actions.onSaveEntry(liability.projectionEntryId!, {
                kind: "liability",
                name: liability.name,
                parentCategory: liability.parentCategory,
                category: liability.category,
                amount: String(liability.projectedBalance),
                notes: liability.message || "",
              })}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => actions.onDeleteEntry(liability.projectionEntryId!)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {!liability.isProjectionOnly && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Current <strong className="text-foreground">{formatCurrency(liability.currentBalance)}</strong></span>
          <span>APR <strong className="text-foreground">{liability.interestRate.toFixed(2)}%</strong></span>
          <span>Payment <strong className="text-foreground">{formatCurrency(liability.minimumPayment)}/mo</strong></span>
          {liability.maturityDate && <span>Matures <strong className="text-foreground">{liability.maturityDate}</strong></span>}
        </div>
      )}
      {liability.message && (
        <p className={`mt-2 text-xs ${liability.status === "unknown" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
          {liability.message}
        </p>
      )}
    </div>
  );
}

function ProjectionGroup({
  kind,
  entries,
  actions,
  onAdd,
}: {
  kind: "asset" | "liability";
  entries: Array<RetirementProjectionAsset | RetirementProjectionLiability>;
  actions: ProjectionActions;
  onAdd: () => void;
}) {
  const [openParents, setOpenParents] = useState<Set<string>>(new Set());
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const grouped = useMemo(() => {
    const parents = new Map<string, Map<string, typeof entries>>();
    entries.forEach((entry) => {
      const categories = parents.get(entry.parentCategory) ?? new Map<string, typeof entries>();
      categories.set(entry.category, [...(categories.get(entry.category) ?? []), entry]);
      parents.set(entry.parentCategory, categories);
    });
    return Array.from(parents.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);
  const amount = (entry: RetirementProjectionAsset | RetirementProjectionLiability) =>
    kind === "asset" ? (entry as RetirementProjectionAsset).projectedValue : (entry as RetirementProjectionLiability).projectedBalance;

  const toggle = (values: Set<string>, value: string, setter: (next: Set<string>) => void) => {
    const next = new Set(values);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  };

  return (
    <section className={`overflow-hidden rounded-xl border ${kind === "asset" ? "border-emerald-200/80 dark:border-emerald-900" : "border-rose-200/80 dark:border-rose-900"}`}>
      <div className={`flex items-center justify-between border-b px-4 py-3 ${kind === "asset" ? "bg-emerald-50/70 dark:bg-emerald-950/20" : "bg-rose-50/70 dark:bg-rose-950/20"}`}>
        <div>
          <p className="font-semibold">{kind === "asset" ? "Projected Assets" : "Projected Liabilities"}</p>
          <p className="text-xs text-muted-foreground">{entries.length} {entries.length === 1 ? "account" : "accounts"}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {grouped.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No projected {kind}s yet.</p>
      ) : grouped.map(([parent, categories]) => {
        const parentEntries = Array.from(categories.values()).flat();
        const isOpen = openParents.has(parent);
        return (
          <div key={parent} className="border-b last:border-b-0">
            <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40" onClick={() => toggle(openParents, parent, setOpenParents)}>
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                <span className="truncate">{parent}</span>
                <span className="text-xs text-muted-foreground">({parentEntries.length})</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(parentEntries.reduce((sum, entry) => sum + amount(entry), 0))}</span>
            </button>
            {isOpen && Array.from(categories.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryEntries]) => {
              const key = `${parent}\u0000${category}`;
              const categoryOpen = openCategories.has(key);
              return (
                <div key={key} className="border-t bg-muted/20">
                  <button type="button" className="flex w-full items-center justify-between gap-3 px-7 py-2.5 text-left text-sm hover:bg-muted/40" onClick={() => toggle(openCategories, key, setOpenCategories)}>
                    <span className="flex items-center gap-2"><ChevronDown className={`h-3.5 w-3.5 transition-transform ${categoryOpen ? "rotate-180" : ""}`} />{category}</span>
                    <span className="text-xs font-semibold tabular-nums">{formatCurrency(categoryEntries.reduce((sum, entry) => sum + amount(entry), 0))}</span>
                  </button>
                  {categoryOpen && (
                    <div className="space-y-2 border-t px-4 py-3 sm:px-7">
                      {categoryEntries.map((entry) => kind === "asset"
                        ? <AssetRow key={entry.id} asset={entry as RetirementProjectionAsset} actions={actions} />
                        : <LiabilityRow key={entry.id} liability={entry as RetirementProjectionLiability} actions={actions} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

function EntryDialog({
  open,
  onOpenChange,
  kind,
  categories,
  initial,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "asset" | "liability";
  categories: BookCategory[];
  initial: ProjectionEntryInput | null;
  onSubmit: (entry: ProjectionEntryInput) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ProjectionEntryInput>({
    kind,
    name: "",
    parentCategory: "",
    category: "",
    amount: "",
    notes: "",
  });
  useEffect(() => {
    setForm(initial || { kind, name: "", parentCategory: "", category: "", amount: "", notes: "" });
  }, [initial, kind, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit" : "Add"} projection-only {kind}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.category}
              onChange={(event) => {
                const selected = categories.find((category) => category.category === event.target.value);
                setForm({ ...form, category: event.target.value, parentCategory: selected?.parentCategory || "" });
              }}
              required
            >
              <option value="" disabled>Select a category</option>
              {groupedBookCategories(categories).map(([parent, entries]) => (
                <optgroup key={parent} label={parent}>
                  {entries.map((entry) => <option key={`${parent}-${entry.category}`} value={entry.category}>{entry.category}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Value at retirement ($)</Label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RetirementNetWorthProjection({
  projection,
  assetCategories,
  liabilityCategories,
  actions,
}: {
  projection: RetirementProjection;
  assetCategories: BookCategory[];
  liabilityCategories: BookCategory[];
  actions: ProjectionActions;
}) {
  const [dialogKind, setDialogKind] = useState<"asset" | "liability" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initial, setInitial] = useState<ProjectionEntryInput | null>(null);

  const openAdd = (kind: "asset" | "liability") => {
    setEditingId(null);
    setInitial(null);
    setDialogKind(kind);
  };
  const wrappedActions: ProjectionActions = {
    ...actions,
    onSaveEntry: (entryId, entry) => {
      if (entryId === null) return Promise.resolve();
      setEditingId(entryId);
      setInitial(entry);
      setDialogKind(entry.kind);
      return Promise.resolve();
    },
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-gradient-to-br from-slate-50 via-blue-50/60 to-emerald-50/60 px-5 py-7 text-center shadow-sm dark:from-slate-950 dark:via-blue-950/20 dark:to-emerald-950/20">
        <p className="text-sm font-medium text-muted-foreground">Projected Net Worth at Age {projection.retirementAge}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{formatCurrency(projection.projectedNetWorth)}</p>
        <div className="mx-auto mt-5 grid max-w-xl grid-cols-2 overflow-hidden rounded-lg border bg-background/70 text-sm">
          <div className="px-3 py-2">
            <span className="text-muted-foreground">Projected assets</span>
            <strong className="block text-emerald-700 dark:text-emerald-300">{formatCurrency(projection.projectedAssetTotal)}</strong>
          </div>
          <div className="border-l px-3 py-2">
            <span className="text-muted-foreground">Projected liabilities</span>
            <strong className="block text-rose-700 dark:text-rose-300">{formatCurrency(projection.projectedLiabilityTotal)}</strong>
          </div>
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ProjectionGroup kind="asset" entries={projection.assets} actions={wrappedActions} onAdd={() => openAdd("asset")} />
        <ProjectionGroup kind="liability" entries={projection.liabilities} actions={wrappedActions} onAdd={() => openAdd("liability")} />
      </div>
      {dialogKind && (
        <EntryDialog
          open
          onOpenChange={(open) => { if (!open) setDialogKind(null); }}
          kind={dialogKind}
          categories={dialogKind === "asset" ? assetCategories : liabilityCategories}
          initial={initial}
          saving={actions.saving}
          onSubmit={async (entry) => {
            try {
              await actions.onSaveEntry(editingId, entry);
              setDialogKind(null);
            } catch {
              // The parent mutation displays the error and the form stays open.
            }
          }}
        />
      )}
    </div>
  );
}