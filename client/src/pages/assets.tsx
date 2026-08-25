import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLastUpdated } from "@/hooks/use-last-updated";
import { ExportMenu } from "@/components/export-menu";
import { BookEntryDialog } from "@/components/book-entry-import";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Wallet, TrendingUp, ChevronDown, Clock, Link2, LayoutGrid, Table2, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { type Asset, type PlaidAccount, ASSET_CATEGORIES } from "@shared/schema";
import { formatCurrency, formatPercent, getCategoryLabel } from "@/lib/format";

type AssetSortKey = "category" | "name" | "institution" | "value" | "rate";
type SortDirection = "asc" | "desc";

function AssetSortHeader({
  label,
  column,
  sortConfig,
  onSort,
  align = "left",
}: {
  label: string;
  column: AssetSortKey;
  sortConfig: { key: AssetSortKey; direction: SortDirection };
  onSort: (column: AssetSortKey) => void;
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
        data-testid={`button-sort-assets-${column}`}
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

function AssetForm({
  asset,
  onClose,
  onUpdated,
}: {
  asset?: Asset;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: asset?.name || "",
    category: asset?.category || "bank_account",
    value: asset?.value || "",
    interestRate: asset?.interestRate || "0",
    institution: asset?.institution || "",
    notes: asset?.notes || "",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/assets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset created" });
      onUpdated?.();
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/assets/${asset!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset updated" });
      onUpdated?.();
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.value) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    if (asset) {
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
            data-testid="input-asset-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Chase Checking"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger data-testid="select-asset-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Value ($)</Label>
          <Input
            data-testid="input-asset-value"
            type="number"
            step="0.01"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Rate of Return (%)</Label>
          <Input
            data-testid="input-asset-rate"
            type="number"
            step="0.01"
            value={form.interestRate}
            onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label>Institution</Label>
          <Input
            data-testid="input-asset-institution"
            value={form.institution}
            onChange={(e) => setForm({ ...form, institution: e.target.value })}
            placeholder="e.g., Chase Bank"
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Notes</Label>
          <Textarea
            data-testid="input-asset-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes..."
            rows={2}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-asset">
          {isPending ? "Saving..." : asset ? "Update" : "Add Asset"}
        </Button>
      </div>
    </form>
  );
}

export default function AssetsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | undefined>();
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [sortConfig, setSortConfig] = useState<{ key: AssetSortKey; direction: SortDirection }>({
    key: "category",
    direction: "asc",
  });
  const { toast } = useToast();
  const { formattedDate, markUpdated } = useLastUpdated("assets");
  const { data: assets = [], isLoading } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });
  const { data: plaidData } = useQuery<{ accounts: PlaidAccount[]; items: any[] }>({ queryKey: ["/api/plaid/accounts"] });
  const plaidLinkedAssetIds = new Set((plaidData?.accounts ?? []).map((a) => a.linkedAssetId).filter(Boolean));

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Asset deleted" });
      markUpdated();
    },
  });

  const totalValue = assets.reduce((sum, a) => sum + parseFloat(a.value || "0"), 0);
  const weightedRate = totalValue > 0
    ? assets.reduce((sum, a) => sum + parseFloat(a.value || "0") * parseFloat(a.interestRate || "0"), 0) / totalValue
    : 0;
  const sortedAssets = useMemo(() => {
    const sorted = [...assets];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortConfig.key === "category") {
        comparison = getCategoryLabel(ASSET_CATEGORIES, a.category).localeCompare(getCategoryLabel(ASSET_CATEGORIES, b.category));
      } else if (sortConfig.key === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortConfig.key === "institution") {
        comparison = (a.institution || "").localeCompare(b.institution || "");
      } else if (sortConfig.key === "value") {
        comparison = parseFloat(a.value || "0") - parseFloat(b.value || "0");
      } else {
        comparison = parseFloat(a.interestRate || "0") - parseFloat(b.interestRate || "0");
      }

      if (comparison === 0 && sortConfig.key !== "category") {
        comparison = getCategoryLabel(ASSET_CATEGORIES, a.category).localeCompare(getCategoryLabel(ASSET_CATEGORIES, b.category));
      }
      if (comparison === 0) {
        comparison = parseFloat(a.value || "0") - parseFloat(b.value || "0");
        return comparison === 0 ? a.name.localeCompare(b.name) : -comparison;
      }
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [assets, sortConfig]);

  const handleSort = (key: AssetSortKey) => {
    setSortConfig((current) => (
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "category" || key === "name" || key === "institution" ? "asc" : "desc" }
    ));
  };

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingAsset(undefined);
    setDialogOpen(true);
  };

  const handleImported = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/plaid/accounts"] });
    markUpdated();
  };

  if (isLoading) {
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
    filename: "Assets",
    sheets: [{
      name: "Assets",
      columns: ["Name", "Category", "Value ($)", "Interest Rate (%)", "Institution", "Notes"],
      rows: assets.map((a) => [
        a.name,
        getCategoryLabel(ASSET_CATEGORIES, a.category),
        parseFloat(a.value || "0"),
        parseFloat(a.interestRate || "0"),
        a.institution || "",
        a.notes || "",
      ]),
    }],
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-1 flex-wrap page-header-gradient">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-assets-title">Assets</h1>
          <p className="text-muted-foreground">Manage your financial assets</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1" data-testid="text-assets-last-updated">
            <Clock className="h-3 w-3" /> Last updated: {formattedDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={exportData} />
          <Button onClick={openCreate} size="sm" data-testid="button-add-asset">
              <Plus className="h-4 w-4 mr-2" /> Add Asset
          </Button>
          <BookEntryDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title={editingAsset ? "Edit Asset" : "Add New Asset"}
            kind="asset"
            categories={ASSET_CATEGORIES}
            onImported={handleImported}
            manualContent={<AssetForm asset={editingAsset} onClose={() => setDialogOpen(false)} onUpdated={markUpdated} />}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-xl font-bold" data-testid="text-total-assets">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Rate of Return</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-avg-rate">{formatPercent(weightedRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Number of Accounts</p>
                <p className="text-xl font-bold">{assets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {assets.length > 0 && (
        <div className="flex justify-end">
          <div className="flex items-center gap-1 rounded-lg border border-primary/10 bg-primary/[0.03] p-1" role="group" aria-label="Asset view options">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "cards" ? "default" : "ghost"}
              onClick={() => setViewMode("cards")}
              aria-pressed={viewMode === "cards"}
              data-testid="button-assets-card-view"
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
              data-testid="button-assets-table-view"
              className="h-9 gap-2 px-4"
            >
              <Table2 className="h-4 w-4" />
              Table
            </Button>
          </div>
        </div>
      )}

      {assets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No assets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Start tracking your wealth by adding your first asset.</p>
            <Button onClick={openCreate} size="sm" data-testid="button-add-first-asset">
              <Plus className="h-4 w-4 mr-2" /> Add Your First Asset
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-assets">
              <thead className="border-b bg-muted/50">
                <tr className="text-left">
                  <AssetSortHeader label="Category" column="category" sortConfig={sortConfig} onSort={handleSort} />
                  <AssetSortHeader label="Name" column="name" sortConfig={sortConfig} onSort={handleSort} />
                  <AssetSortHeader label="Institution" column="institution" sortConfig={sortConfig} onSort={handleSort} />
                  <AssetSortHeader label="Value" column="value" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <AssetSortHeader label="Rate of Return" column="rate" sortConfig={sortConfig} onSort={handleSort} align="right" />
                  <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-muted/30" data-testid={`table-row-asset-${asset.id}`}>
                    <td className="px-5 py-3 text-muted-foreground">{getCategoryLabel(ASSET_CATEGORIES, asset.category)}</td>
                    <td className="px-5 py-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="max-w-52 truncate">{asset.name}</span>
                        {plaidLinkedAssetIds.has(asset.id) && (
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-label="Synced via Plaid" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{asset.institution || "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold whitespace-nowrap">{formatCurrency(asset.value)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {parseFloat(asset.interestRate || "0") > 0
                        ? <span className="text-emerald-600 dark:text-emerald-400">{formatPercent(asset.interestRate || "0")}</span>
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(asset)} data-testid={`button-table-edit-asset-${asset.id}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit {asset.name}</span>
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(asset.id)} data-testid={`button-table-delete-asset-${asset.id}`}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {asset.name}</span>
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
          {Object.entries(
            assets.reduce((groups, asset) => {
              const cat = asset.category;
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(asset);
              return groups;
            }, {} as Record<string, typeof assets>)
          ).map(([category, categoryAssets], idx, arr) => {
            const isOpen = openCategory === category;
            const categoryTotal = categoryAssets.reduce((sum, a) => sum + parseFloat(a.value || "0"), 0);
            const categoryWeightedRate = categoryTotal > 0
              ? categoryAssets.reduce((sum, a) => sum + parseFloat(a.value || "0") * parseFloat(a.interestRate || "0"), 0) / categoryTotal
              : 0;

            return (
              <div key={category} className={idx < arr.length - 1 ? "border-b" : ""}>
                <button
                  onClick={() => setOpenCategory(isOpen ? null : category)}
                  data-testid={`accordion-category-${category}`}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/70 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Wallet className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{getCategoryLabel(ASSET_CATEGORIES, category)}</p>
                      <p className="text-xs text-muted-foreground">{categoryAssets.length} {categoryAssets.length === 1 ? "account" : "accounts"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold">{formatCurrency(categoryTotal)}</p>
                      {categoryWeightedRate > 0 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{formatPercent(categoryWeightedRate)} avg rate</p>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 pt-1 border-t bg-muted/60">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                        {categoryAssets.map((asset) => (
                          <Card key={asset.id} className="hover-elevate bg-background" data-testid={`card-asset-${asset.id}`}>
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between gap-1 mb-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <h3 className="font-semibold truncate">{asset.name}</h3>
                                    {plaidLinkedAssetIds.has(asset.id) && (
                                      <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-label="Synced via Plaid" />
                                    )}
                                  </div>
                                  {asset.institution && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{asset.institution}</p>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <Button size="icon" variant="ghost" onClick={() => openEdit(asset)} data-testid={`button-edit-asset-${asset.id}`}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(asset.id)} data-testid={`button-delete-asset-${asset.id}`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Value</span>
                                  <span className="text-lg font-bold">{formatCurrency(asset.value)}</span>
                                </div>
                                {parseFloat(asset.interestRate || "0") > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Rate of Return</span>
                                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatPercent(asset.interestRate || "0")}</span>
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
        </Card>
      )}
    </div>
  );
}
