import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Building2, CheckCircle2, FileSpreadsheet, Landmark, Loader2, Upload, Wallet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type BookEntryKind = "asset" | "liability";

type CategoryOption = { value: string; label: string };

type PlaidAccount = {
  id: number;
  plaidItemId: number;
  plaidAccountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  currentBalance: string | null;
  availableBalance: string | null;
  linkedAssetId: number | null;
  linkedLiabilityId: number | null;
};

type PlaidItem = {
  id: number;
  institutionName: string | null;
};

type ImportResponse = {
  inserted: number;
  updated: number;
  skipped: number;
  skippedReasons: Record<string, number>;
};

type CsvEntry = {
  name: string;
  category: string;
  value?: string;
  balance?: string;
  interestRate?: string;
  minimumPayment?: string;
  institution?: string;
  notes?: string;
};

function detectDelimiter(line: string) {
  const counts = { "\t": 0, ",": 0, ";": 0, "|": 0 };
  for (const character of line) {
    if (character in counts) (counts as Record<string, number>)[character]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCSVText(text: string): string[][] {
  if (!text.trim()) return [];
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0]);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let quoteClosed = false;

  const finishCell = () => {
    row.push(cell.trim());
    cell = "";
    quoteClosed = false;
  };
  const finishRow = () => {
    finishCell();
    if (row.some((value) => value)) rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted) {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        if (cell.length || quoteClosed) throw new Error("Quotes must begin at the start of a CSV field.");
        quoted = true;
      }
      continue;
    }
    if (quoteClosed) {
      if (character !== delimiter && character !== "\r" && character !== "\n") {
        throw new Error("Unexpected characters after a quoted CSV field.");
      }
    }
    if (character === delimiter && !quoted) {
      finishCell();
      continue;
    }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      finishRow();
      continue;
    }
    cell += character;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  if (cell.length || row.length) finishRow();
  return rows;
}

function guessColumn(headers: string[], keywords: string[]) {
  const normalized = headers.map((header) => header.toLowerCase().trim());
  for (const keyword of keywords) {
    const index = normalized.findIndex((header) => header.includes(keyword));
    if (index !== -1) return String(index);
  }
  return "";
}

function parseMoney(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  const negative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const number = Number(trimmed.replace(/[$,\s()]/g, ""));
  return negative ? -number : number;
}

function categoryForValue(categories: readonly CategoryOption[], value: string | undefined, fallback: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  return categories.find((category) =>
    category.value.toLowerCase() === normalized || category.label.toLowerCase() === normalized
  )?.value ?? fallback;
}

function skippedDescription(skippedReasons: Record<string, number>) {
  return Object.entries(skippedReasons)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${count} ${reason.toLowerCase()}`)
    .join(" · ");
}

export function BookEntryCsvImportPanel({
  kind,
  categories,
  onImported,
}: {
  kind: BookEntryKind;
  categories: readonly CategoryOption[];
  onImported: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState({
    name: "",
    category: "",
    amount: "",
    interestRate: "",
    minimumPayment: "",
    institution: "",
    notes: "",
  });
  const [result, setResult] = useState<ImportResponse | null>(null);

  const importMutation = useMutation({
    mutationFn: (entries: CsvEntry[]) => apiRequest("POST", `/api/${kind}s/import`, { entries }).then((response) => response.json() as Promise<ImportResponse>),
    onSuccess: (data) => {
      setResult(data);
      onImported();
      toast({
        title: `${kind === "asset" ? "Assets" : "Liabilities"} imported`,
        description: `${data.inserted} added${data.skipped ? ` · ${data.skipped} skipped` : ""}`,
      });
    },
    onError: (error: Error) => toast({
      title: "CSV import failed",
      description: error.message || "Please check the file and try again.",
      variant: "destructive",
    }),
  });

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      let parsed: string[][];
      try {
        parsed = parseCSVText(String(loadEvent.target?.result ?? ""));
      } catch (error) {
        setRows([]);
        setHeaders([]);
        toast({
          title: "CSV could not be read",
          description: error instanceof Error ? error.message : "Please correct the file and try again.",
          variant: "destructive",
        });
        return;
      }
      if (parsed.length < 2) {
        setRows([]);
        setHeaders([]);
        toast({ title: "CSV needs a header and at least one row", variant: "destructive" });
        return;
      }
      const nextHeaders = parsed[0];
      const nextRows = parsed.slice(1).filter((row) => row.some((cell) => cell.trim()));
      setHeaders(nextHeaders);
      setRows(nextRows);
      setResult(null);
      setColumnMap({
        name: guessColumn(nextHeaders, ["name", "account", "description", "asset", "liability"]),
        category: guessColumn(nextHeaders, ["category", "type", "subtype"]),
        amount: guessColumn(nextHeaders, kind === "asset"
          ? ["value", "balance", "amount", "market"]
          : ["balance", "amount", "value", "owed"]),
        interestRate: guessColumn(nextHeaders, ["interest", "rate", "apr"]),
        minimumPayment: guessColumn(nextHeaders, ["minimum payment", "min payment", "payment"]),
        institution: guessColumn(nextHeaders, ["institution", "bank", "provider", "lender"]),
        notes: guessColumn(nextHeaders, ["notes", "note", "memo", "comment"]),
      });
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const buildEntries = () => {
    const get = (row: string[], column: string) => column === "" ? "" : (row[Number(column)] ?? "").trim();
    const entries: CsvEntry[] = [];
    const skippedReasons: Record<string, number> = {};
    const addSkipped = (reason: string) => { skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1; };

    rows.forEach((row) => {
      const name = get(row, columnMap.name);
      const rawAmount = get(row, columnMap.amount);
      const amount = parseMoney(rawAmount);
      if (!name) {
        addSkipped("missing name");
        return;
      }
      if (!Number.isFinite(amount) || (kind === "asset" && amount < 0)) {
        addSkipped("invalid amount");
        return;
      }
      const entry: CsvEntry = {
        name,
        category: categoryForValue(categories, get(row, columnMap.category), categories[0].value),
        [kind === "asset" ? "value" : "balance"]: (kind === "liability" ? Math.abs(amount) : amount).toFixed(2),
        interestRate: "0",
        institution: get(row, columnMap.institution) || undefined,
        notes: get(row, columnMap.notes) || undefined,
      };
      const rawInterest = get(row, columnMap.interestRate);
      if (rawInterest) {
        const interest = parseMoney(rawInterest);
        if (!Number.isFinite(interest) || interest < 0) {
          addSkipped("invalid interest rate");
          return;
        }
        entry.interestRate = interest.toFixed(2);
      }
      if (kind === "liability") {
        entry.minimumPayment = "0";
        const rawPayment = get(row, columnMap.minimumPayment);
        if (rawPayment) {
          const payment = parseMoney(rawPayment);
          if (!Number.isFinite(payment) || payment < 0) {
            addSkipped("invalid minimum payment");
            return;
          }
          entry.minimumPayment = payment.toFixed(2);
        }
      }
      entries.push(entry);
    });
    return { entries, skippedReasons };
  };

  const columnOptions = [
    { key: "name", label: "Name", required: true },
    { key: "category", label: "Category", required: false },
    { key: "amount", label: kind === "asset" ? "Value / balance" : "Balance / amount", required: true },
    { key: "interestRate", label: "Interest / return rate", required: false },
    ...(kind === "liability" ? [{ key: "minimumPayment", label: "Minimum payment", required: false }] : []),
    { key: "institution", label: "Institution", required: false },
    { key: "notes", label: "Notes", required: false },
  ];
  const requiredColumnsReady = Boolean(columnMap.name && columnMap.amount && rows.length);
  const preview = rows.slice(0, 5);

  return (
    <div className="space-y-4">
      <div
        className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 p-7 text-center transition-colors hover:border-blue-400 dark:border-slate-700"
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") fileRef.current?.click();
        }}
      >
        <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-blue-500" />
        <p className="text-sm font-medium">Click to upload CSV / TSV / TXT</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {kind === "asset"
            ? "Include columns for name and value. Category and other details are optional."
            : "Include columns for name and balance. Negative balances are treated as amounts owed."}
        </p>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
      </div>

      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-emerald-600">{rows.length} rows detected</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Choose another file
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {columnOptions.map((column) => (
              <div key={column.key}>
                <Label className="text-xs">
                  {column.label}{column.required ? " *" : ""}
                </Label>
                <Select
                  value={columnMap[column.key as keyof typeof columnMap] || "none"}
                  onValueChange={(value) => setColumnMap((current) => ({ ...current, [column.key]: value === "none" ? "" : value }))}
                >
                  <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {!column.required && <SelectItem value="none">— none —</SelectItem>}
                    {headers.map((header, index) => (
                      <SelectItem key={index} value={String(index)}>{header || `Column ${index + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {preview.length > 0 && (
            <div className="overflow-x-auto rounded-lg border text-xs">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>{headers.map((header, index) => <th key={index} className="px-3 py-2 text-left font-medium text-muted-foreground">{header || `Column ${index + 1}`}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t">
                      {headers.map((_, columnIndex) => <td key={columnIndex} className="max-w-[150px] truncate px-3 py-1.5">{row[columnIndex] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button
            type="button"
            className="w-full"
            disabled={!requiredColumnsReady || importMutation.isPending}
            onClick={() => {
              const { entries, skippedReasons } = buildEntries();
              if (!entries.length) {
                toast({ title: "No valid rows to import", description: skippedDescription(skippedReasons), variant: "destructive" });
                return;
              }
              importMutation.mutate(entries);
            }}
          >
            {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {importMutation.isPending ? "Importing…" : `Import ${rows.length} ${kind}${rows.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
          <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Import complete
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            {result.inserted} added{result.updated ? ` · ${result.updated} updated` : ""}{result.skipped ? ` · ${result.skipped} skipped` : ""}
          </p>
          {result.skipped > 0 && <p className="mt-1 text-xs text-muted-foreground">{skippedDescription(result.skippedReasons)}</p>}
        </div>
      )}
    </div>
  );
}

function plaidBookKind(type: string, subtype: string | null): { kind: BookEntryKind | "skip"; category?: string } {
  const normalizedSubtype = (subtype ?? "").toLowerCase();
  if (type === "depository") {
    return { kind: "asset", category: ["savings", "money market", "cd"].includes(normalizedSubtype) ? "savings_account" : "bank_account" };
  }
  if (type === "investment" || type === "brokerage") {
    const retirement = ["401k", "ira", "roth", "retirement", "403b", "pension"].some((term) => normalizedSubtype.includes(term));
    return { kind: "asset", category: retirement ? "retirement_fund" : "investment" };
  }
  if (type === "credit") return { kind: "liability", category: "credit_card" };
  if (type === "loan") {
    if (["mortgage", "home equity"].includes(normalizedSubtype)) return { kind: "liability", category: "mortgage" };
    if (normalizedSubtype === "auto") return { kind: "liability", category: "auto_loan" };
    if (normalizedSubtype === "student") return { kind: "liability", category: "student_loan" };
    return { kind: "liability", category: "personal_loan" };
  }
  return { kind: "skip" };
}

export function BookEntryConnectedAccountsPanel({
  kind,
  onImported,
}: {
  kind: BookEntryKind;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const { data, isLoading, isError } = useQuery<{ accounts: PlaidAccount[]; items: PlaidItem[] }>({
    queryKey: ["/api/plaid/accounts"],
  });

  const items = data?.items ?? [];
  const institutionById = useMemo(() => new Map(items.map((item) => [item.id, item.institutionName || "Connected Institution"])), [items]);
  const eligibleAccounts = useMemo(
    () => (data?.accounts ?? []).filter((account) => plaidBookKind(account.type, account.subtype).kind === kind),
    [data?.accounts, kind]
  );
  const availableAccounts = eligibleAccounts.filter((account) => kind === "asset" ? !account.linkedAssetId && !account.linkedLiabilityId : !account.linkedAssetId && !account.linkedLiabilityId);
  const selectedAvailableIds = selectedIds.filter((id) => availableAccounts.some((account) => account.id === id));

  const importMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/plaid/accounts/import-to-book", { kind, accountIds: selectedAvailableIds }).then((response) => response.json() as Promise<ImportResponse>),
    onSuccess: (data) => {
      setResult(data);
      setSelectedIds([]);
      onImported();
      toast({
        title: `${kind === "asset" ? "Assets" : "Liabilities"} imported from connected accounts`,
        description: `${data.inserted} added${data.skipped ? ` · ${data.skipped} already imported or unavailable` : ""}`,
      });
    },
    onError: (error: Error) => toast({
      title: "Connected account import failed",
      description: error.message || "Please try again.",
      variant: "destructive",
    }),
  });

  const toggleAccount = (id: number) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id]);
    setResult(null);
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading connected accounts…</div>;
  }
  if (isError) {
    return <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Connected accounts could not be loaded. Please refresh and try again.</div>;
  }
  if (!items.length) {
    return (
      <div className="rounded-xl border-2 border-dashed p-8 text-center">
        <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No financial accounts connected</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Connect a bank or credit account first, then return here to import it.</p>
        <Button variant="outline" className="mt-4" asChild><a href="/connected-accounts">Open Connected Accounts</a></Button>
      </div>
    );
  }
  if (!eligibleAccounts.length) {
    return (
      <div className="rounded-xl border-2 border-dashed p-8 text-center">
        <Landmark className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No eligible connected {kind === "asset" ? "asset accounts" : "liability accounts"}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Connect a {kind === "asset" ? "checking, savings, investment, or retirement" : "credit card or loan"} account to import it here.</p>
        <Button variant="outline" className="mt-4" asChild><a href="/connected-accounts">Manage Connected Accounts</a></Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Import from connected accounts</p>
        <p className="mt-1 text-xs text-muted-foreground">Select accounts to add. Accounts already linked to this page are kept up to date and will not be duplicated.</p>
      </div>
      <div className="space-y-2">
        {eligibleAccounts.map((account) => {
          const mapping = plaidBookKind(account.type, account.subtype);
          const linked = kind === "asset" ? account.linkedAssetId || account.linkedLiabilityId : account.linkedAssetId || account.linkedLiabilityId;
          const available = !linked;
          return (
            <Card key={account.id} className={available && selectedAvailableIds.includes(account.id) ? "border-primary bg-primary/[0.03]" : ""}>
              <CardContent className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={selectedAvailableIds.includes(account.id)}
                  disabled={!available}
                  onChange={() => toggleAccount(account.id)}
                  aria-label={`Select ${account.name}`}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  {kind === "asset" ? <Wallet className="h-4 w-4 text-primary" /> : <Landmark className="h-4 w-4 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{account.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{institutionById.get(account.plaidItemId)} · {mapping.category?.replace(/_/g, " ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(parseFloat(account.currentBalance || "0") || 0))}</p>
                  {available ? <Badge variant="outline" className="mt-1 text-[10px]">Available</Badge> : <Badge variant="secondary" className="mt-1 text-[10px]">Already imported</Badge>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" onClick={() => importMutation.mutate()} disabled={!selectedAvailableIds.length || importMutation.isPending}>
          {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          {importMutation.isPending ? "Importing…" : `Import ${selectedAvailableIds.length || ""} selected`}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds(availableAccounts.map((account) => account.id))} disabled={!availableAccounts.length}>
          Select all available
        </Button>
      </div>
      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
          <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Import complete</p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">{result.inserted} added{result.updated ? ` · ${result.updated} updated` : ""}{result.skipped ? ` · ${result.skipped} skipped` : ""}</p>
        </div>
      )}
    </div>
  );
}

export function BookEntryDialog({
  open,
  onOpenChange,
  title,
  kind,
  categories,
  manualContent,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  kind: BookEntryKind;
  categories: readonly CategoryOption[];
  manualContent: React.ReactNode;
  onImported: () => void;
}) {
  const [tab, setTab] = useState("manual");
  const isEdit = title.startsWith("Edit");

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) setTab("manual");
      onOpenChange(value);
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {isEdit ? manualContent : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="manual"><Wallet className="mr-1.5 h-3.5 w-3.5" />Manual</TabsTrigger>
              <TabsTrigger value="csv"><FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />Import CSV</TabsTrigger>
              <TabsTrigger value="connected"><Landmark className="mr-1.5 h-3.5 w-3.5" />Connected Accounts</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="mt-4">{manualContent}</TabsContent>
            <TabsContent value="csv" className="mt-4"><BookEntryCsvImportPanel kind={kind} categories={categories} onImported={onImported} /></TabsContent>
            <TabsContent value="connected" className="mt-4"><BookEntryConnectedAccountsPanel kind={kind} onImported={onImported} /></TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}