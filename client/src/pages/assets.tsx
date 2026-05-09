import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLastUpdated } from "@/hooks/use-last-updated";
import { ExportMenu } from "@/components/export-menu";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Wallet, TrendingUp, ChevronDown, Clock, Link2 } from "lucide-react";
import { type Asset, type PlaidAccount, ASSET_CATEGORIES } from "@shared/schema";
import { formatCurrency, formatPercent, getCategoryLabel } from "@/lib/format";

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
  const { toast } = useToast();
  const { formattedDate, markUpdated } = useLastUpdated("assets");
  const { data: assets = [], isLoading } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });
  const { data: plaidAccounts = [] } = useQuery<PlaidAccount[]>({ queryKey: ["/api/plaid/accounts"] });
  const plaidLinkedAssetIds = new Set(plaidAccounts.map((a) => a.linkedAssetId).filter(Boolean));

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

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingAsset(undefined);
    setDialogOpen(true);
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-add-asset">
              <Plus className="h-4 w-4 mr-2" /> Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingAsset ? "Edit Asset" : "Add New Asset"}</DialogTitle>
            </DialogHeader>
            <AssetForm asset={editingAsset} onClose={() => setDialogOpen(false)} onUpdated={markUpdated} />
          </DialogContent>
        </Dialog>
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
        <Card className="stat-card-3d stat-card-3d-green border">
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

      {assets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No assets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Start tracking your wealth by adding your first asset.</p>
            <Button onClick={openCreate} data-testid="button-add-first-asset">
              <Plus className="h-4 w-4 mr-2" /> Add Your First Asset
            </Button>
          </CardContent>
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
                                      <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-500" title="Synced via Plaid" />
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
