import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLastUpdated } from "@/hooks/use-last-updated";
import { ExportMenu } from "@/components/export-menu";
import { BookEntryDialog } from "@/components/book-entry-import";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, CreditCard, TrendingDown, ChevronDown, Clock, Link2, LayoutGrid, Table2, Layers3, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { type Liability, type PlaidAccount } from "@shared/schema";
import { formatCurrency, formatPercent } from "@/lib/format";
import { type BookCategory, categoryLabel, categoryParent, groupedBookCategories, groupedBookEntries } from "@/lib/book-categories";

type LiabilitySortKey = "parentCategory" | "category" | "name" | "institution" | "balance" | "rate" | "minimumPayment";
type SortDirection = "asc" | "desc";

function LiabilitySortHeader({
  label,
  column,
  sortConfig,
  onSort,
  align = "left",
}: {
  label: string;
  column: LiabilitySortKey;
  sortConfig: { key: LiabilitySortKey; direction: SortDirection };
  onSort: (column: LiabilitySortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = sortConfig.key === column;
  return (
    <th
      scope="col"
      aria-sort={isActive ? (sortConfig.direction === "asc" ? "ascending" : "descending") : "none"}
      className={`px-5 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onSort(column)}
        className={`h-auto gap-1 px-0 py-1 font-medium hover:bg-transparent hover:text-foreground ${align === "right" ? "ml-auto justify-end" : ""}`}
        data-testid={`button-sort-liabilities-${column}`}
      >
        {label}
        {isActive ? (
          sortConfig.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    </th>
  );
}

function LiabilityForm({
  liability,
  categories,
  onClose,
  onUpdated,
}: {
  liability?: Liability;
  categories: BookCategory[];
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: liability?.name || "",
    category: liability?.category || "",
    balance: liability?.balance || "",
    interestRate: liability?.interestRate || "0",
    minimumPayment: liability?.minimumPayment || "0",
    institution: liability?.institution || "",
    notes: liability?.notes || "",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/liabilities", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liabilities"] });
      toast({ title: "Liability created" });
      onUpdated?.();
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/liabilities/${liability!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liabilities"] });
      toast({ title: "Liability updated" });
      onUpdated?.();
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.balance) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    if (!categories.some((category) => category.category === form.category)) {
      toast({ title: "Select a valid category", variant: "destructive" });
      return;
    }
    if (liability) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label>Name</Label>
          <Input
            data-testid="input-liability-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Chase Visa"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <select
            data-testid="select-liability-category"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          >
            <option value="" disabled>Select a category</option>
            {liability && !categories.some((category) => category.category === liability.category) && (
              <option value={liability.category} disabled>{liability.category} (legacy category)</option>
            )}
            {groupedBookCategories(categories).map(([parent, entries]) => (
              <optgroup key={parent} label={parent}>
                {entries.map((category) => <option key={`${category.parentCategory}-${category.category}`} value={category.category}>{category.category}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Balance ($)</Label>
          <Input
            data-testid="input-liability-balance"
            type="number"
            step="0.01"
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Interest Rate (%)</Label>
          <Input
            data-testid="input-liability-rate"
            type="number"
            step="0.01"
            value={form.interestRate}
            onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label>Minimum Payment ($)</Label>
          <Input
            data-testid="input-liability-min-payment"
            type="number"
            step="0.01"
            value={form.minimumPayment}
            onChange={(e) => setForm({ ...form, minimumPayment: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Institution</Label>
          <Input
            data-testid="input-liability-institution"
            value={form.institution}
            onChange={(e) => setForm({ ...form, institution: e.target.value })}
            placeholder="e.g., Chase Bank"
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Notes</Label>
          <Textarea
            data-testid="input-liability-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes..."
            rows={2}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-liability">
          {isPending ? "Saving..." : liability ? "Update" : "Add Liability"}
        </Button>
      </div>
    </form>
  );
}

export default function LiabilitiesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<Liability | undefined>();
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [sortConfig, setSortConfig] = useState<{ key: LiabilitySortKey; direction: SortDirection }>({
    key: "parentCategory",
    direction: "asc",
  });
  const { toast } = useToast();
  const { formattedDate, markUpdated } = useLastUpdated("liabilities");
  const { data: liabilities = [], isLoading: liabilitiesLoading } = useQuery<Liability[]>({ queryKey: ["/api/liabilities"] });
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<BookCategory[]>({ queryKey: ["/api/liabilities/categories"] });
  const { data: plaidData } = useQuery<{ accounts: PlaidAccount[]; items: any[] }>({ queryKey: ["/api/plaid/accounts"] });
  const plaidLinkedLiabilityIds = new Set((plaidData?.accounts ?? []).map((a) => a.linkedLiabilityId).filter(Boolean));

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/liabilities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liabilities"] });
      toast({ title: "Liability deleted" });
      markUpdated();
    },
  });

  const totalBalance = liabilities.reduce((sum, l) => sum + parseFloat(l.balance || "0"), 0);
  const weightedRate = totalBalance > 0
    ? liabilities.reduce((sum, l) => sum + parseFloat(l.balance || "0") * parseFloat(l.interestRate || "0"), 0) / totalBalance
    : 0;
  const totalMinPayment = liabilities.reduce((sum, l) => sum + parseFloat(l.minimumPayment || "0"), 0);
  const sortedLiabilities = useMemo(() => {
    const sorted = [...liabilities];
    sorted.sort((a, b) => {
      let comparison = 0;
      const parentA = categoryParent(categories, a.category);
      const parentB = categoryParent(categories, b.category);
      const categoryA = categoryLabel(categories, a.category);
      const categoryB = categoryLabel(categories, b.category);
      if (sortConfig.key === "parentCategory" || sortConfig.key === "category") {
        comparison = parentA.localeCompare(parentB) || categoryA.localeCompare(categoryB);
      } else if (sortConfig.key === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortConfig.key === "institution") {
        comparison = (a.institution || "").localeCompare(b.institution || "");
      } else if (sortConfig.key === "balance") {
        comparison = parseFloat(a.balance || "0") - parseFloat(b.balance || "0");
      } else if (sortConfig.key === "rate") {
        comparison = parseFloat(a.interestRate || "0") - parseFloat(b.interestRate || "0");
      } else {
        comparison = parseFloat(a.minimumPayment || "0") - parseFloat(b.minimumPayment || "0");
      }

      if (comparison === 0 && sortConfig.key !== "parentCategory" && sortConfig.key !== "category") {
        comparison = parentA.localeCompare(parentB) || categoryA.localeCompare(categoryB);
      }
      if (comparison === 0) {
        comparison = parseFloat(a.balance || "0") - parseFloat(b.balance || "0");
        return comparison === 0 ? a.name.localeCompare(b.name) : -comparison;
      }
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [liabilities, categories, sortConfig]);

  const handleSort = (key: LiabilitySortKey) => {
    setSortConfig((current) => (
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "parentCategory" || key === "category" || key === "name" || key === "institution" ? "asc" : "desc" }
    ));
  };

  const openEdit = (liability: Liability) => {
    setEditingLiability(liability);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingLiability(undefined);
    setDialogOpen(true);
  };

  const handleImported = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/liabilities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/plaid/accounts"] });
    markUpdated();
  };

  if (liabilitiesLoading || categoriesLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const exportData = {
    filename: "Liabilities",
    sheets: [{
      name: "Liabilities",
      columns: ["Name", "Category", "Balance ($)", "Interest Rate (%)", "Min Payment ($)", "Institution", "Notes"],
      rows: liabilities.map((l) => [
        l.name,
        categoryLabel(categories, l.category),
        parseFloat(l.balance || "0"),
        parseFloat(l.interestRate || "0"),
        parseFloat(l.minimumPayment || "0"),
        l.institution || "",
        l.notes || "",
      ]),
    }],
  };
  const groupedLiabilities = groupedBookEntries(liabilities, categories);
  const liabilitiesByParent = new Map<string, typeof groupedLiabilities>();
  groupedLiabilities.forEach((group) => {
    const parentGroups = liabilitiesByParent.get(group.parentCategory) ?? [];
    parentGroups.push(group);
    liabilitiesByParent.set(group.parentCategory, parentGroups);
  });
  const parentLiabilityGroups = Array.from(liabilitiesByParent.entries());

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-1 flex-wrap page-header-gradient">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-liabilities-title">Liabilities</h1>
          <p className="text-muted-foreground">Track your debts and obligations</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1" data-testid="text-liabilities-last-updated">
            <Clock className="h-3 w-3" /> Last updated: {formattedDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={exportData} />
          <Button onClick={openCreate} size="sm" data-testid="button-add-liability">
              <Plus className="h-4 w-4 mr-2" /> Add Liability
          </Button>
          <BookEntryDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title={editingLiability ? "Edit Liability" : "Add New Liability"}
            kind="liability"
            onImported={handleImported}
            manualContent={<LiabilityForm liability={editingLiability} categories={categories} onClose={() => setDialogOpen(false)} onUpdated={markUpdated} />}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Owed</p>
                <p className="text-xl font-bold" data-testid="text-total-liabilities">{formatCurrency(totalBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Interest Rate</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400" data-testid="text-avg-liability-rate">{formatPercent(weightedRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Min Payments</p>
                <p className="text-xl font-bold">{formatCurrency(totalMinPayment)}/mo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {liabilities.length > 0 && (
        <div className="flex justify-end">
          <div className="flex items-center gap-1 rounded-lg border border-primary/10 bg-primary/[0.03] p-1" role="group" aria-label="Liability view options">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "cards" ? "default" : "ghost"}
              onClick={() => setViewMode("cards")}
              aria-pressed={viewMode === "cards"}
              data-testid="button-liabilities-card-view"
              className="h-9 gap-2 px-4"
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "table" ? "default" : "ghost"}
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              data-testid="button-liabilities-table-view"
              className="h-9 gap-2 px-4"
            >
              <Table2 className="h-4 w-4" />
              Table
            </Button>
          </div>
        </div>
      )}

      {liabilities.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No liabilities</h3>
            <p className="text-sm text-muted-foreground mb-4">Track your debts by adding your first liability.</p>
            <Button onClick={openCreate} size="sm" data-testid="button-add-first-liability">
              <Plus className="h-4 w-4 mr-2" /> Add Your First Liability
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-liabilities">
              <thead className="border-b bg-muted/50">
                <tr className="text-left">
                  <LiabilitySortHeader label="Parent Category" column="parentCategory" sortConfig={sortConfig} onSort={handleSort} />
                  <LiabilitySortHeader label="Category" column="category" sortConfig={sortConfig} onSort={handleSort} />
                  <LiabilitySortHeader label="Name" column="name" sortConfig={sortConfig} onSort={handleSort} />
                  <LiabilitySortHeader label="Institution" column="institution" sortConfig={sortConfig} onSort={handleSort} />
                  <LiabilitySortHeader label="Balance" column="balance" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <LiabilitySortHeader label="Interest Rate" column="rate" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <LiabilitySortHeader label="Min Payment" column="minimumPayment" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedLiabilities.map((liability) => (
                  <tr key={liability.id} className="hover:bg-muted/30" data-testid={`table-row-liability-${liability.id}`}>
                    <td className="px-5 py-3 font-medium text-foreground/80">{categoryParent(categories, liability.category)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{categoryLabel(categories, liability.category)}</td>
                    <td className="px-5 py-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="max-w-52 truncate">{liability.name}</span>
                        {plaidLinkedLiabilityIds.has(liability.id) && (
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-label="Synced via Plaid" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{liability.institution || "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold whitespace-nowrap">{formatCurrency(liability.balance)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {parseFloat(liability.interestRate || "0") > 0
                        ? <span className="text-red-600 dark:text-red-400">{formatPercent(liability.interestRate || "0")}</span>
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {parseFloat(liability.minimumPayment || "0") > 0
                        ? `${formatCurrency(liability.minimumPayment || "0")}/mo`
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(liability)} data-testid={`button-table-edit-liability-${liability.id}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit {liability.name}</span>
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(liability.id)} data-testid={`button-table-delete-liability-${liability.id}`}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {liability.name}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          {parentLiabilityGroups.map(([parentCategory, categoryGroups]) => {
            const accountCount = categoryGroups.reduce((sum, group) => sum + group.entries.length, 0);
            return (
            <section key={parentCategory} className="border-b last:border-b-0">
              <div className="flex items-center gap-3 border-b-2 border-destructive/25 bg-muted/75 px-5 py-3 dark:bg-muted/55">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-destructive/10">
                  <Layers3 className="h-4 w-4 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">{parentCategory}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryGroups.length} {categoryGroups.length === 1 ? "category" : "categories"} · {accountCount} {accountCount === 1 ? "account" : "accounts"}
                  </p>
                </div>
              </div>
              {categoryGroups.map(({ category, entries: categoryLiabilities }, idx) => {
                const isOpen = openCategory === category;
                const categoryTotal = categoryLiabilities.reduce((sum, l) => sum + parseFloat(l.balance || "0"), 0);
                const categoryWeightedRate = categoryTotal > 0
                  ? categoryLiabilities.reduce((sum, l) => sum + parseFloat(l.balance || "0") * parseFloat(l.interestRate || "0"), 0) / categoryTotal
                  : 0;
                const categoryMinPayment = categoryLiabilities.reduce((sum, l) => sum + parseFloat(l.minimumPayment || "0"), 0);

                return (
                  <div key={category} className={idx < categoryGroups.length - 1 ? "border-b" : ""}>
                    <button
                      onClick={() => setOpenCategory(isOpen ? null : category)}
                      data-testid={`accordion-category-${category}`}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/70 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
                          <CreditCard className="h-4 w-4 text-destructive" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{categoryLabel(categories, category)}</p>
                          <p className="text-xs text-muted-foreground">{categoryLiabilities.length} {categoryLiabilities.length === 1 ? "account" : "accounts"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-semibold">{formatCurrency(categoryTotal)}</p>
                          <div className="flex items-center gap-2 justify-end">
                            {categoryWeightedRate > 0 && (
                              <p className="text-xs text-red-500 dark:text-red-400">{formatPercent(categoryWeightedRate)} rate</p>
                            )}
                            {categoryMinPayment > 0 && (
                              <p className="text-xs text-muted-foreground">{formatCurrency(categoryMinPayment)}/mo</p>
                            )}
                          </div>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="overflow-hidden">
                        <div className="px-5 pb-5 pt-1 border-t bg-muted/60">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                            {categoryLiabilities.map((liability) => (
                              <Card key={liability.id} className="hover-elevate bg-background" data-testid={`card-liability-${liability.id}`}>
                                <CardContent className="p-5">
                                  <div className="flex items-start justify-between gap-1 mb-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <h3 className="font-semibold truncate">{liability.name}</h3>
                                        {plaidLinkedLiabilityIds.has(liability.id) && (
                                          <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-label="Synced via Plaid" />
                                        )}
                                      </div>
                                      {liability.institution && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{liability.institution}</p>
                                      )}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Button size="icon" variant="ghost" onClick={() => openEdit(liability)} data-testid={`button-edit-liability-${liability.id}`}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(liability.id)} data-testid={`button-delete-liability-${liability.id}`}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-muted-foreground">Balance</span>
                                      <span className="text-lg font-bold">{formatCurrency(liability.balance)}</span>
                                    </div>
                                    {parseFloat(liability.interestRate || "0") > 0 && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Interest Rate</span>
                                        <span className="text-sm font-medium text-red-600 dark:text-red-400">{formatPercent(liability.interestRate || "0")}</span>
                                      </div>
                                    )}
                                    {parseFloat(liability.minimumPayment || "0") > 0 && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Min Payment</span>
                                        <span className="text-sm">{formatCurrency(liability.minimumPayment || "0")}/mo</span>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
            );
          })}
        </Card>
      )}
    </div>
  );
}
