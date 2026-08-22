import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Landmark,
  Pencil,
  Plus,
  Save,
  Trash2,
  WalletCards,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type RetirementPension } from "@shared/schema";

type PensionForm = {
  name: string;
  amount: string;
  frequency: "monthly" | "annual";
  startAge: string;
  notes: string;
};

const EMPTY_FORM: PensionForm = {
  name: "",
  amount: "",
  frequency: "monthly",
  startAge: "65",
  notes: "",
};

function monthlyAmount(pension: RetirementPension): number {
  const amount = Number(pension.amount) || 0;
  return pension.frequency === "annual" ? amount / 12 : amount;
}

function frequencyLabel(frequency: string): string {
  return frequency === "annual" ? "per year" : "per month";
}

export default function RetirementPensionPage() {
  const { toast } = useToast();
  const [form, setForm] = useState<PensionForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RetirementPension | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: pensions = [], isLoading } = useQuery<RetirementPension[]>({
    queryKey: ["/api/retirement/pensions"],
    staleTime: 0,
  });

  const monthlyTotal = useMemo(
    () => pensions.reduce((total, pension) => total + monthlyAmount(pension), 0),
    [pensions],
  );
  const annualTotal = monthlyTotal * 12;

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: PensionForm }) =>
      apiRequest(id ? "PATCH" : "POST", id ? `/api/retirement/pensions/${id}` : "/api/retirement/pensions", {
        name: data.name.trim(),
        amount: data.amount,
        frequency: data.frequency,
        startAge: Number(data.startAge),
        notes: data.notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retirement/pensions"] });
      setForm(EMPTY_FORM);
      setEditingId(null);
      setFormError(null);
      toast({ title: editingId ? "Pension updated" : "Pension added" });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to save pension", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/retirement/pensions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retirement/pensions"] });
      setDeleteTarget(null);
      toast({ title: "Pension removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to remove pension", description: error.message, variant: "destructive" });
    },
  });

  const updateForm = <K extends keyof PensionForm>(key: K, value: PensionForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (formError) setFormError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount);
    const startAge = Number(form.startAge);

    if (!form.name.trim()) {
      setFormError("Enter a name for this pension source.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter a benefit amount greater than zero.");
      return;
    }
    if (!Number.isInteger(startAge) || startAge < 0 || startAge > 120) {
      setFormError("Enter a whole-number start age from 0 to 120.");
      return;
    }

    saveMutation.mutate({ id: editingId, data: form });
  };

  const startEditing = (pension: RetirementPension) => {
    setEditingId(pension.id);
    setForm({
      name: pension.name,
      amount: String(pension.amount),
      frequency: pension.frequency === "annual" ? "annual" : "monthly",
      startAge: String(pension.startAge),
      notes: pension.notes ?? "",
    });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="page-header-gradient">
        <h1 className="text-2xl font-bold" data-testid="text-pension-title">Pension Planning</h1>
        <p className="text-muted-foreground">
          Track every pension source you expect to receive in retirement
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/10">
                <WalletCards className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expected Monthly Income</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300" data-testid="text-pension-monthly-total">
                  {formatCurrency(monthlyTotal)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <CircleDollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expected Annual Income</p>
                <p className="text-xl font-bold" data-testid="text-pension-annual-total">
                  {formatCurrency(annualTotal)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card-3d">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-500/10">
                <Landmark className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pension Sources</p>
                <p className="text-xl font-bold" data-testid="text-pension-count">{pensions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {editingId ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
              {editingId ? "Edit Pension Source" : "Add Pension Source"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pension-name">Pension name or source</Label>
                <Input
                  id="pension-name"
                  data-testid="input-pension-name"
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="e.g. State pension, employer pension"
                  maxLength={120}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pension-amount">Estimated benefit amount</Label>
                <CurrencyInput
                  id="pension-amount"
                  data-testid="input-pension-amount"
                  value={form.amount}
                  onChange={(value) => updateForm("amount", value)}
                  placeholder="2,000"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pension-frequency">Payment frequency</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={(value: "monthly" | "annual") => updateForm("frequency", value)}
                  >
                    <SelectTrigger id="pension-frequency" data-testid="select-pension-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pension-start-age">Starts at age</Label>
                  <Input
                    id="pension-start-age"
                    data-testid="input-pension-start-age"
                    type="number"
                    min={0}
                    max={120}
                    step={1}
                    value={form.startAge}
                    onChange={(event) => updateForm("startAge", event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pension-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <textarea
                  id="pension-notes"
                  data-testid="input-pension-notes"
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Plan details, survivor benefits, or other reminders"
                  maxLength={500}
                />
              </div>

              {formError && (
                <p className="text-sm text-destructive" role="alert" data-testid="text-pension-form-error">
                  {formError}
                </p>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={saveMutation.isPending} className="flex-1" data-testid="button-save-pension">
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? "Saving..." : editingId ? "Update Pension" : "Add Pension"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={cancelEditing} disabled={saveMutation.isPending}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Your Pension Sources</CardTitle>
                <p className="mt-1 text-sm font-normal text-muted-foreground">
                  Estimates are converted to a monthly amount for the totals above.
                </p>
              </div>
              <Badge variant="secondary">{pensions.length} source{pensions.length === 1 ? "" : "s"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3" aria-label="Loading pension sources">
                <div className="h-20 animate-pulse rounded-lg bg-muted" />
                <div className="h-20 animate-pulse rounded-lg bg-muted" />
              </div>
            ) : pensions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Landmark className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <h2 className="font-semibold">No pension sources added yet</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Add an employer, union, or other pension estimate to include it in your retirement income totals.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pensions.map((pension) => (
                  <div
                    key={pension.id}
                    className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                    data-testid={`pension-record-${pension.id}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{pension.name}</h3>
                          <Badge variant="outline">Starts at {pension.startAge}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatCurrency(Number(pension.amount))} {frequencyLabel(pension.frequency)}
                          {" · "}
                          <span className="font-medium text-foreground">{formatCurrency(monthlyAmount(pension))}/mo</span>
                        </p>
                        {pension.notes && (
                          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {pension.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(pension)}
                          data-testid={`button-edit-pension-${pension.id}`}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(pension)}
                          data-testid={`button-delete-pension-${pension.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {pension.name}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/[0.04]">
        <CardContent className="flex gap-3 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            Pension amounts are estimates you provide. The totals are planning figures and do not calculate eligibility, taxes, cost-of-living adjustments, or survivor benefits.
          </p>
          <CalendarClock className="mt-0.5 hidden h-4 w-4 shrink-0 text-primary sm:block" />
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove pension source?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.name ?? "this pension"} from your retirement income totals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove Pension"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}