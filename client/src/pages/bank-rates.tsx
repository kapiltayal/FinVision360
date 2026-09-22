import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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

interface BankRateUploadPreview {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
}

type BankRateMapping = {
  bankName: string;
  bankType: string;
  rateType: string;
  rateName: string;
  rateValue: string;
};

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

const EMPTY_BANK_RATE_MAPPING: BankRateMapping = {
  bankName: "",
  bankType: "",
  rateType: "",
  rateName: "",
  rateValue: "",
};

const BANK_RATE_MAPPING_FIELDS: Array<{
  key: keyof BankRateMapping;
  label: string;
  required: boolean;
}> = [
  { key: "bankName", label: "Institution Name", required: true },
  { key: "bankType", label: "Bank Type", required: false },
  { key: "rateType", label: "Rate Type", required: true },
  { key: "rateName", label: "Product Name", required: true },
  { key: "rateValue", label: "Rate Value", required: true },
];

const BANK_RATE_MAPPING_ALIASES: Record<keyof BankRateMapping, string[]> = {
  bankName: ["bankname", "bank", "bankfinancialinstitution", "bankorfinancialinstitution", "financialinstitution", "financialinstitutionname", "institutionname", "institution", "banksource"],
  bankType: ["banktype", "institutiontype", "financialinstitutiontype"],
  rateType: ["ratetype", "type", "accounttype", "producttype"],
  rateName: ["ratename", "productname", "product", "accountname"],
  rateValue: ["ratevalue", "rate", "apy", "apr", "interestrate"],
};

function suggestBankRateMapping(headers: string[]): BankRateMapping {
  const find = (aliases: string[]) => aliases.find((alias) => headers.includes(alias)) || "";
  return {
    bankName: find(BANK_RATE_MAPPING_ALIASES.bankName),
    bankType: find(BANK_RATE_MAPPING_ALIASES.bankType),
    rateType: find(BANK_RATE_MAPPING_ALIASES.rateType),
    rateName: find(BANK_RATE_MAPPING_ALIASES.rateName),
    rateValue: find(BANK_RATE_MAPPING_ALIASES.rateValue),
  };
}

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
  const [uploadPreview, setUploadPreview] = useState<BankRateUploadPreview | null>(null);
  const [uploadMapping, setUploadMapping] = useState<BankRateMapping>(EMPTY_BANK_RATE_MAPPING);

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
      const response = await apiRequest("POST", "/api/bank-rates/manual", manualForm);
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

  const previewRates = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const response = await apiRequest("POST", "/api/bank-rates/preview", body);
      return await response.json() as BankRateUploadPreview;
    },
    onSuccess: (preview) => {
      setUploadPreview(preview);
      setUploadMapping(suggestBankRateMapping(preview.headers));
    },
    onError: (error: Error) => {
      setUploadPreview(null);
      toast({ title: "Could not preview file", description: error.message, variant: "destructive" });
    },
  });

  const importRates = useMutation({
    mutationFn: async ({ file, mapping }: { file: File; mapping: BankRateMapping }) => {
      const body = new FormData();
      body.append("file", file);
      body.append("mapping", JSON.stringify(mapping));
      const response = await apiRequest("POST", "/api/bank-rates/import", body);
      return await response.json() as { imported: number };
    },
    onSuccess: ({ imported }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates/institutions"] });
      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadMapping(EMPTY_BANK_RATE_MAPPING);
      toast({ title: "Bank rates imported", description: `${imported} rate${imported === 1 ? "" : "s"} added.` });
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteRate = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bank-rates/${id}`);
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
    const file = event.target.files?.[0] ?? null;
    setUploadFile(file);
    setUploadPreview(null);
    setUploadMapping(EMPTY_BANK_RATE_MAPPING);
    if (file) previewRates.mutate(file);
  };

  const requiredMappingComplete = BANK_RATE_MAPPING_FIELDS
    .filter((field) => field.required)
    .every((field) => Boolean(uploadMapping[field.key]));

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
          if (!open) {
            setUploadFile(null);
            setUploadPreview(null);
            setUploadMapping(EMPTY_BANK_RATE_MAPPING);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{uploadPreview ? "Review Bank Rate Import" : "Upload Bank Rates"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-5 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 dark:border-slate-700"
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
              {previewRates.isPending && (
                <p className="mt-2 text-sm text-primary">Reading file and preparing preview...</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.tsv,.txt,.xls,.xlsx,.xlsm"
                onChange={chooseFile}
              />
            </div>

            {!uploadPreview && !previewRates.isPending && (
              <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900">
                <p className="mb-2 font-medium">What happens next</p>
                <p className="text-muted-foreground">
                  Select a file to preview its rows and map your columns before anything is saved.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  CSV, tab-delimited, XLS, XLSX, and XLSM files are supported. Maximum 5,000 data rows.
                </p>
              </div>
            )}

            {uploadPreview && (
              <>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Map your columns</p>
                      <p className="text-xs text-muted-foreground">
                        Choose which uploaded column supplies each bank-rate field. Nothing is stored until you import.
                      </p>
                    </div>
                    <Badge variant="secondary">{uploadPreview.totalRows} rows detected</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {BANK_RATE_MAPPING_FIELDS.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <Label>
                          {field.label}{field.required ? " *" : " (optional)"}
                        </Label>
                        <Select
                          value={uploadMapping[field.key] || "__none__"}
                          onValueChange={(value) => setUploadMapping((current) => ({
                            ...current,
                            [field.key]: value === "__none__" ? "" : value,
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              {field.required ? "Not mapped" : "Not mapped (use default)"}
                            </SelectItem>
                            {uploadPreview.headers.map((header) => (
                              <SelectItem key={`${field.key}-${header}`} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  {!requiredMappingComplete && (
                    <p className="mt-3 text-sm text-destructive">
                      Map all required fields before importing.
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">Preview</p>
                    <span className="text-xs text-muted-foreground">Showing first {uploadPreview.sampleRows.length} rows</span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {uploadPreview.headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadPreview.sampleRows.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {uploadPreview.headers.map((header) => (
                              <TableCell key={`${rowIndex}-${header}`} className="max-w-48 truncate text-sm">
                                {String(row[header] ?? "")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            {uploadPreview && (
              <Button
                variant="outline"
                onClick={() => {
                  setUploadPreview(null);
                  setUploadMapping(EMPTY_BANK_RATE_MAPPING);
                }}
              >
                Choose Different File
              </Button>
            )}
            <Button
              onClick={() => {
                if (uploadFile && uploadPreview) {
                  importRates.mutate({ file: uploadFile, mapping: uploadMapping });
                } else if (!uploadFile) {
                  fileInputRef.current?.click();
                } else {
                  previewRates.mutate(uploadFile);
                }
              }}
              disabled={!uploadFile || previewRates.isPending || importRates.isPending || (!!uploadPreview && !requiredMappingComplete)}
              className="gap-2"
            >
              {uploadPreview ? <Upload className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
              {importRates.isPending ? "Importing..." : uploadPreview ? "Import Rates" : "Preview File"}
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