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
import { Plus, Pencil, Trash2, CreditCard, TrendingDown, ChevronDown, Clock, Link2 } from "lucide-react";
import { type Liability, type PlaidAccount, LIABILITY_CATEGORIES } from "@shared/schema";
import { formatCurrency, formatPercent, getCategoryLabel } from "@/lib/format";

function LiabilityForm({
  liability,
  onClose,
  onUpdated,
}: {
  liability?: Liability;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: liability?.name || "",
    category: liability?.category || "credit_card",
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
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger data-testid="select-liability-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIABILITY_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  const { toast } = useToast();
  const { formattedDate, markUpdated } = useLastUpdated("liabilities");
  const { data: liabilities = [], isLoading } = useQuery<Liability[]>({ queryKey: ["/api/liabilities"] });
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

  const openEdit = (liability: Liability) => {
    setEditingLiability(liability);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingLiability(undefined);
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
    filename: "Liabilities",
    sheets: [{
      name: "Liabilities",
      columns: ["Name", "Category", "Balance ($)", "Interest Rate (%)", "Min Payment ($)", "Institution", "Notes"],
      rows: liabilities.map((l) => [
        l.name,
        getCategoryLabel(LIABILITY_CATEGORIES, l.category),
        parseFloat(l.balance || "0"),
        parseFloat(l.interestRate || "0"),
        parseFloat(l.minimumPayment || "0"),
        l.institution || "",
        l.notes || "",
      ]),
    }],
  };

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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-add-liability">
              <Plus className="h-4 w-4 mr-2" /> Add Liability
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingLiability ? "Edit Liability" : "Add New Liability"}</DialogTitle>
            </DialogHeader>
            <LiabilityForm liability={editingLiability} onClose={() => setDialogOpen(false)} onUpdated={markUpdated} />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="stat-card-3d stat-card-3d-red border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-destructive/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Owed</p>
                <p className="text-xl font-bold" data-testid="text-total-liabilities">{formatCurrency(totalBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d stat-card-3d-red border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Interest Rate</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400" data-testid="text-avg-liability-rate">{formatPercent(weightedRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d stat-card-3d-red border">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-destructive/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Min Payments</p>
                <p className="text-xl font-bold">{formatCurrency(totalMinPayment)}/mo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {liabilities.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No liabilities</h3>
            <p className="text-sm text-muted-foreground mb-4">Track your debts by adding your first liability.</p>
            <Button onClick={openCreate} data-testid="button-add-first-liability">
              <Plus className="h-4 w-4 mr-2" /> Add Your First Liability
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          {Object.entries(
            liabilities.reduce((groups, liability) => {
              const cat = liability.category;
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(liability);
              return groups;
            }, {} as Record<string, typeof liabilities>)
          ).map(([category, categoryLiabilities], idx, arr) => {
            const isOpen = openCategory === category;
            const categoryTotal = categoryLiabilities.reduce((sum, l) => sum + parseFloat(l.balance || "0"), 0);
            const categoryWeightedRate = categoryTotal > 0
              ? categoryLiabilities.reduce((sum, l) => sum + parseFloat(l.balance || "0") * parseFloat(l.interestRate || "0"), 0) / categoryTotal
              : 0;
            const categoryMinPayment = categoryLiabilities.reduce((sum, l) => sum + parseFloat(l.minimumPayment || "0"), 0);

            return (
              <div key={category} className={idx < arr.length - 1 ? "border-b" : ""}>
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
                      <p className="font-semibold text-sm">{getCategoryLabel(LIABILITY_CATEGORIES, category)}</p>
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
                                      <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-500" title="Synced via Plaid" />
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
        </Card>
      )}
    </div>
  );
}
