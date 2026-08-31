import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Building2, CheckCircle2, FileSpreadsheet, Landmark, Loader2, Upload, Wallet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type BookEntryKind = "asset" | "liability";

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

function skippedDescription(skippedReasons: Record<string, number>) {
  return Object.entries(skippedReasons)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${count} ${reason.toLowerCase()}`)
    .join(" · ");
}

export function BookEntryCsvImportPanel({
  kind,
  onImported,
}: {
  kind: BookEntryKind;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const importMutation = useMutation({
    mutationFn: (selectedFile: File) => {
      const data = new FormData();
      data.append("file", selectedFile);
      return apiRequest("POST", `/api/${kind}s/ingest`, data).then((response) => response.json() as Promise<ImportResponse>);
    },
    onSuccess: (data) => {
      setResult(data);
      onImported();
      toast({
        title: `${kind === "asset" ? "Assets" : "Liabilities"} imported`,
        description: `${data.inserted} added${data.skipped ? ` · ${data.skipped} skipped` : ""}`,
      });
    },
    onError: (error: Error) => toast({
      title: "File import failed",
      description: error.message,
      variant: "destructive",
    }),
  });

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "tsv", "txt", "xls", "xlsx"].includes(extension)) {
      toast({ title: "Invalid file type", description: "Invalid file type. Please upload a valid CSV or JSON file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File is too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }
    setFile(file);
    setResult(null);
    event.target.value = "";
  };

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
        <p className="text-sm font-medium">Click to upload a file</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload CSV, TSV, TXT, XLS, or XLSX (maximum 5 MiB). The server will map your data.
        </p>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" className="hidden" onChange={handleFile} />
      </div>

      {file && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-emerald-600">{file.name}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Choose another file
            </Button>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={importMutation.isPending}
            onClick={() => importMutation.mutate(file)}
          >
            {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {importMutation.isPending ? "Importing…" : "Import file"}
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

function plaidBookKind(type: string, subtype: string | null): { kind: BookEntryKind | "skip" } {
  const normalizedSubtype = (subtype ?? "").toLowerCase();
  if (type === "depository") {
    return { kind: "asset" };
  }
  if (type === "investment" || type === "brokerage") {
    return { kind: "asset" };
  }
  if (type === "credit") return { kind: "liability" };
  if (type === "loan") {
    return { kind: "liability" };
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
                  <p className="truncate text-xs text-muted-foreground">
                    {institutionById.get(account.plaidItemId)} · {(account.subtype || account.type).replace(/_/g, " ")}
                  </p>
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
  manualContent,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  kind: BookEntryKind;
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
              <TabsTrigger value="csv"><FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />Import File</TabsTrigger>
              <TabsTrigger value="connected"><Landmark className="mr-1.5 h-3.5 w-3.5" />Connected Accounts</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="mt-4">{manualContent}</TabsContent>
            <TabsContent value="csv" className="mt-4"><BookEntryCsvImportPanel kind={kind} onImported={onImported} /></TabsContent>
            <TabsContent value="connected" className="mt-4"><BookEntryConnectedAccountsPanel kind={kind} onImported={onImported} /></TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}