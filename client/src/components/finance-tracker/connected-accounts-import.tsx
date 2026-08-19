import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Building2, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PlaidItem = {
  id: number;
  institutionName: string | null;
  institutionId: string | null;
  lastSynced: string | null;
  createdAt: string;
};

type PlaidAccount = {
  id: number;
  plaidItemId: number;
  plaidAccountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
};

type AccountsResponse = {
  items: PlaidItem[];
  accounts: PlaidAccount[];
};

type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  skippedReasons: {
    pending: number;
    transfers: number;
    unsupportedCurrency: number;
    invalid: number;
  };
  unavailable: number;
  unavailableInstitutions: string[];
  recurringMarked: number;
};

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 89);
  return isoDate(date);
}

export function ConnectedAccountsImportPanel({ onImported }: { onImported: () => void }) {
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(() => isoDate(new Date()));
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data, isLoading, isError } = useQuery<AccountsResponse>({
    queryKey: ["/api/plaid/accounts"],
    queryFn: () => apiRequest("GET", "/api/plaid/accounts").then((response) => response.json()),
  });

  const items = data?.items ?? [];
  const accounts = data?.accounts ?? [];
  const visibleAccounts = useMemo(
    () => selectedItem === "all"
      ? accounts
      : accounts.filter((account) => account.plaidItemId === Number(selectedItem)),
    [accounts, selectedItem]
  );
  const institutionById = useMemo(
    () => new Map(items.map((item) => [item.id, item.institutionName || "Connected Institution"])),
    [items]
  );

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/transactions/import-from-plaid", {
        itemId: selectedItem === "all" ? undefined : Number(selectedItem),
        accountId: selectedAccount === "all" ? undefined : selectedAccount,
        startDate,
        endDate,
      });
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      onImported();
      const imported = data.inserted + data.updated;
      toast({
        title: imported ? `${imported} connected transactions synced` : "Connected transactions are up to date",
        description: data.skipped ? `${data.skipped} pending, transfer, or unsupported transactions skipped` : undefined,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connected account import failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const dateRangeValid = Boolean(startDate && endDate && startDate <= endDate);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading connected accounts…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        Connected accounts could not be loaded. Please refresh and try again.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed p-8 text-center">
        <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No financial accounts connected</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Connect a bank or credit account first, then return here to import its transactions.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <a href="/connected-accounts">Open Connected Accounts</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Import from connected accounts</p>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
          Choose an institution or individual account and a date range. Re-importing updates matching Plaid transactions instead of creating duplicates.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs">Institution</Label>
          <Select
            value={selectedItem}
            onValueChange={(value) => {
              setSelectedItem(value);
              setSelectedAccount("all");
              setResult(null);
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All connected institutions</SelectItem>
              {items.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.institutionName || "Connected Institution"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Account</Label>
          <Select
            value={selectedAccount}
            onValueChange={(value) => {
              setSelectedAccount(value);
              setResult(null);
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {selectedItem === "all" ? "All connected accounts" : "All accounts at this institution"}
              </SelectItem>
              {visibleAccounts.map((account) => (
                <SelectItem key={account.plaidAccountId} value={account.plaidAccountId}>
                  {account.name}
                  {selectedItem === "all" ? ` · ${institutionById.get(account.plaidItemId)}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Start date</Label>
          <Input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setResult(null);
            }}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">End date</Label>
          <Input
            type="date"
            value={endDate}
            min={startDate}
            max={isoDate(new Date())}
            onChange={(event) => {
              setEndDate(event.target.value);
              setResult(null);
            }}
            className="mt-1"
          />
        </div>
      </div>

      {!dateRangeValid && (
        <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          Select an end date on or after the start date.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          onClick={() => importMutation.mutate()}
          disabled={!dateRangeValid || importMutation.isPending}
        >
          {importMutation.isPending
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <RefreshCw className="mr-2 h-4 w-4" />}
          {importMutation.isPending ? "Importing transactions…" : "Import Transactions"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Pending, transfer, credit-card payment, and non-USD transactions are skipped.
        </p>
      </div>

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Import complete
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["New", result.inserted],
              ["Updated", result.updated],
              ["Skipped", result.skipped],
              ["Unavailable", result.unavailable],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md bg-background/70 px-3 py-2">
                <p className="text-lg font-semibold">{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {result.unavailableInstitutions.length > 0 && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              Transactions were unavailable from: {result.unavailableInstitutions.join(", ")}. Try again after the institution finishes refreshing.
            </p>
          )}
          {result.skipped > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Skipped details: {[
                result.skippedReasons.pending ? `${result.skippedReasons.pending} pending` : "",
                result.skippedReasons.transfers ? `${result.skippedReasons.transfers} transfers` : "",
                result.skippedReasons.unsupportedCurrency ? `${result.skippedReasons.unsupportedCurrency} non-USD` : "",
                result.skippedReasons.invalid ? `${result.skippedReasons.invalid} unavailable` : "",
              ].filter(Boolean).join(" · ")}
            </p>
          )}
          {result.recurringMarked > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {result.recurringMarked} matching transactions were flagged as recurring.
            </p>
          )}
        </div>
      )}
    </div>
  );
}