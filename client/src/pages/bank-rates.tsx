import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, FileSpreadsheet, Landmark, PenLine, Trash2, Upload } from "lucide-react";

interface BankRate {
  id: number;
  configId: number;
  bankName: string;
  bankType: string;
  rateType: string;
  rateName: string;
  rateValue: string;
  scrapedAt: string;
}

interface FinancialInstitution {
  name: string;
  type: string;
}

const BANK_TYPES = [
  "Standard Bank",
  "Credit Union",
  "Brokerage",
  "Online Bank",
  "Other",
] as const;

const RATE_TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  cd: "CD",
  money_market: "Money Market",
  loan: "Loan",
};

const RATE_TYPE_COLORS: Record<string, string> = {
  checking: "bg-[#1C91D4]/15 text-[#1475A8] dark:bg-[#1C91D4]/20 dark:text-[#7EC8ED]",
  savings: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cd: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  money_market: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  loan: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

const EMPTY_MANUAL_FORM = {
  bankName: "",
  bankType: "Standard Bank",
  rateType: "savings",
  rateName: "",
  rateValue: "",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RateTable({
  rates,
  onDelete,
}: {
  rates: BankRate[];
  onDelete: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Financial Institution</TableHead>
            <TableHead>Institution Type</TableHead>
            <TableHead>Rate Type</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Recorded At</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rates.map((rate) => (
            <TableRow key={rate.id}>
              <TableCell className="font-medium">{rate.bankName}</TableCell>
              <TableCell>
                <Badge variant="outline" className="whitespace-nowrap font-normal">
                  {rate.bankType || "Standard Bank"}
                </Badge>
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${RATE_TYPE_COLORS[rate.rateType] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                  {RATE_TYPE_LABELS[rate.rateType] || rate.rateType}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{rate.rateName}</TableCell>
              <TableCell className="font-bold text-primary">{rate.rateValue}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Clock className="h-3 w-3" />
                  {formatDate(rate.scrapedAt)}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-red-500"
                  onClick={() => onDelete(rate.id)}
                  aria-label={`Delete ${rate.bankName} ${rate.rateName} rate`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function BankRatesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteRateId, setDeleteRateId] = useState<number | null>(null);
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const isAdmin = !!(user as any)?.isAdmin;

  useEffect(() => {
    if (user && !isAdmin) navigate("/");
  }, [user, isAdmin, navigate]);

  const { data: rates = [], isLoading } = useQuery<BankRate[]>({
    queryKey: ["/api/bank-rates"],
    enabled: isAdmin,
  });

  const { data: institutions = [] } = useQuery<FinancialInstitution[]>({
    queryKey: ["/api/bank-rates/institutions"],
    enabled: isAdmin,
  });

  const latestRates = useMemo(() => {
    const seen = new Set<string>();
    return rates.filter((rate) => {
      const key = `${rate.bankName.toLocaleLowerCase()}-${rate.rateType}-${rate.rateName.toLocaleLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rates]);

  const addManualRate = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/bank-rates/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualForm),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Could not save the bank rate");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates/institutions"] });
      setManualDialogOpen(false);
      setManualForm(EMPTY_MANUAL_FORM);
      toast({ title: "Bank rate added" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not add rate", description: error.message, variant: "destructive" });
    },
  });

  const importRates = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/bank-rates/import", { method: "POST", body });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not import the bank-rate file");
      return result as { imported: number };
    },
    onSuccess: ({ imported }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates/institutions"] });
      setUploadDialogOpen(false);
      setUploadFile(null);
      toast({ title: "Bank rates imported", description: `${imported} rate${imported === 1 ? "" : "s"} added.` });
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteRate = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/bank-rates/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this rate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates"] });
      setDeleteRateId(null);
      toast({ title: "Rate deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not delete rate", description: error.message, variant: "destructive" });
    },
  });

  if (!user || !isAdmin) return null;

  const updateInstitutionName = (bankName: string) => {
    const existing = institutions.find(
      (institution) => institution.name.localeCompare(bankName, undefined, { sensitivity: "accent" }) === 0,
    );
    setManualForm((current) => ({
      ...current,
      bankName,
      ...(existing ? { bankType: existing.type } : {}),
    }));
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    setUploadFile(event.target.files?.[0] ?? null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="page-header-gradient mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Bank Rate Monitor</h1>
            <p className="text-sm text-muted-foreground">Record and compare rates from banks and financial institutions</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setUploadDialogOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Rates
          </Button>
          <Button onClick={() => setManualDialogOpen(true)} className="gap-2">
            <PenLine className="h-4 w-4" />
            Add Rate Manually
          </Button>
        </div>
      </div>

      <Tabs defaultValue="rates">
        <TabsList className="mb-4">
          <TabsTrigger value="rates">Current Rates</TabsTrigger>
          <TabsTrigger value="history">Rate History</TabsTrigger>
        </TabsList>

        <TabsContent value="rates">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading rates...</div>
          ) : latestRates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Landmark className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="mb-2 text-muted-foreground">No rates recorded yet.</p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Add a rate manually or upload a bank-rate file to get started.
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={() => setUploadDialogOpen(true)} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Rates
                  </Button>
                  <Button onClick={() => setManualDialogOpen(true)} className="gap-2">
                    <PenLine className="h-4 w-4" />
                    Add Rate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <RateTable rates={latestRates} onDelete={setDeleteRateId} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading history...</div>
          ) : rates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">No rate history yet.</CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Rate Records</CardTitle>
                <CardDescription>Manual and file-imported rate history ({rates.length} records)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <RateTable rates={rates} onDelete={setDeleteRateId} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Bank Rate Manually</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="institution-name">Bank or Financial Institution</Label>
              <Input
                id="institution-name"
                list="existing-financial-institutions"
                value={manualForm.bankName}
                onChange={(event) => updateInstitutionName(event.target.value)}
                placeholder="Enter or select an institution"
                autoComplete="off"
              />
              <datalist id="existing-financial-institutions">
                {institutions.map((institution) => (
                  <option key={institution.name} value={institution.name}>{institution.type}</option>
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Start typing to choose an institution already in the table, or enter a new one.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Institution Type</Label>
              <Select
                value={manualForm.bankType}
                onValueChange={(bankType) => setManualForm((current) => ({ ...current, bankType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BANK_TYPES.map((bankType) => (
                    <SelectItem key={bankType} value={bankType}>{bankType}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Rate Type</Label>
              <Select
                value={manualForm.rateType}
                onValueChange={(rateType) => setManualForm((current) => ({ ...current, rateType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="cd">CD</SelectItem>
                  <SelectItem value="money_market">Money Market</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rate-product-name">Product Name</Label>
              <Input
                id="rate-product-name"
                value={manualForm.rateName}
                onChange={(event) => setManualForm((current) => ({ ...current, rateName: event.target.value }))}
                placeholder="e.g. High-Yield Savings APY"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rate-value">Rate Value</Label>
              <Input
                id="rate-value"
                value={manualForm.rateValue}
                onChange={(event) => setManualForm((current) => ({ ...current, rateValue: event.target.value }))}
                placeholder="e.g. 4.50%"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addManualRate.mutate()}
              disabled={
                !manualForm.bankName.trim()
                || !manualForm.bankType
                || !manualForm.rateName.trim()
                || !manualForm.rateValue.trim()
                || addManualRate.isPending
              }
            >
              {addManualRate.isPending ? "Saving..." : "Save Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) setUploadFile(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Bank Rates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-7 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 dark:border-slate-700"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
              }}
            >
              <FileSpreadsheet className="mx-auto mb-3 h-9 w-9 text-primary" />
              <p className="font-medium">{uploadFile ? uploadFile.name : "Choose a rates file"}</p>
              <p className="mt-1 text-xs text-muted-foreground">CSV, tab-delimited, XLS, XLSX, or XLSM · maximum 5 MiB</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.tsv,.txt,.xls,.xlsx,.xlsm"
                onChange={chooseFile}
              />
            </div>

            <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900">
              <p className="mb-2 font-medium">File columns</p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li><strong className="text-foreground">Institution Name</strong> — required</li>
                <li><strong className="text-foreground">Bank Type</strong> — optional; defaults to Standard Bank</li>
                <li><strong className="text-foreground">Rate Type</strong> — required</li>
                <li><strong className="text-foreground">Product Name</strong> — required</li>
                <li><strong className="text-foreground">Rate Value</strong> — required</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Common alternatives such as Bank Name, Type, Product, APY, APR, and Interest Rate are also recognized.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => uploadFile && importRates.mutate(uploadFile)}
              disabled={!uploadFile || importRates.isPending}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {importRates.isPending ? "Importing..." : "Import Rates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteRateId !== null} onOpenChange={() => setDeleteRateId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Rate Record</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this bank-rate record.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRateId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteRateId !== null && deleteRate.mutate(deleteRateId)}
              disabled={deleteRate.isPending}
            >
              {deleteRate.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}