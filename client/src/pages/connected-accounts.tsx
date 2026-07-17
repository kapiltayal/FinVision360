import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePlaidLink } from "react-plaid-link";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/use-seo";
import {
  Building2, RefreshCw, Trash2, Plus, ShieldCheck, Link2,
  CreditCard, Landmark, TrendingUp, Wallet, AlertCircle, Loader2,
  ChevronDown, ChevronRight,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  currentBalance: string | null;
  availableBalance: string | null;
  lastUpdated: string;
};

function accountTypeIcon(type: string, subtype: string | null) {
  if (type === "credit") return <CreditCard className="h-4 w-4" />;
  if (type === "investment" || type === "brokerage") return <TrendingUp className="h-4 w-4" />;
  if (subtype === "checking") return <Wallet className="h-4 w-4" />;
  return <Landmark className="h-4 w-4" />;
}

function accountTypeLabel(type: string, subtype: string | null) {
  if (subtype) return subtype.charAt(0).toUpperCase() + subtype.slice(1).replace(/_/g, " ");
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatBalance(val: string | null) {
  if (!val) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parseFloat(val));
}

function PlaidLinkButton({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();

  const { data: tokenData, isLoading: tokenLoading } = useQuery<{ link_token: string }>({
    queryKey: ["/api/plaid/create-link-token"],
    staleTime: 5 * 60 * 1000,
  });

  const exchangeMutation = useMutation({
    mutationFn: (body: { public_token: string; institution: any }) =>
      apiRequest("POST", "/api/plaid/exchange-token", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plaid/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plaid/create-link-token"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/liabilities"] });
      toast({ title: "Account connected!", description: "Your accounts now appear under Assets and Liabilities." });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Connection failed", description: "Could not connect your account. Please try again.", variant: "destructive" });
    },
  });

  const onPlaidSuccess = useCallback(
    (public_token: string, metadata: any) => {
      exchangeMutation.mutate({ public_token, institution: metadata.institution });
    },
    [exchangeMutation]
  );

  const { open, ready } = usePlaidLink({
    token: tokenData?.link_token ?? null,
    onSuccess: onPlaidSuccess,
  });

  if (tokenLoading) {
    return (
      <Button disabled data-testid="button-connect-bank-loading">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparing…
      </Button>
    );
  }

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || exchangeMutation.isPending}
      data-testid="button-connect-bank"
      className="text-white border-0"
      style={{ background: "linear-gradient(135deg, #1565a8 0%, #1c91d4 55%, #42b8ed 100%)" }}
    >
      {exchangeMutation.isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Plus className="h-4 w-4 mr-2" />
      )}
      Connect a Bank Account
    </Button>
  );
}

export default function ConnectedAccountsPage() {
  useSEO({
    title: "Connected Accounts — FinVision360",
    description: "Securely connect your bank and investment accounts to sync balances automatically.",
    canonical: "/connected-accounts",
  });

  const { toast } = useToast();
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpanded = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const { data, isLoading } = useQuery<{ accounts: PlaidAccount[]; items: PlaidItem[] }>({
    queryKey: ["/api/plaid/accounts"],
  });

  const items = data?.items ?? [];
  const accounts = data?.accounts ?? [];

  const syncMutation = useMutation({
    mutationFn: (itemId: number) => apiRequest("POST", `/api/plaid/sync/${itemId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plaid/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/liabilities"] });
      toast({ title: "Synced!", description: "Balances have been updated." });
      setSyncingId(null);
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Could not refresh balances.", variant: "destructive" });
      setSyncingId(null);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/plaid/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plaid/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/liabilities"] });
      toast({ title: "Disconnected", description: "Bank connection and synced entries removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not disconnect account.", variant: "destructive" });
    },
  });

  const handleSync = (itemId: number) => {
    setSyncingId(itemId);
    syncMutation.mutate(itemId);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 page-header-gradient">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" />
            Connected Accounts
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Securely link your banks and investment accounts to sync balances automatically.
          </p>
        </div>
        <PlaidLinkButton onSuccess={() => {}} />
      </div>

      {/* Security note */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="flex items-start gap-3 py-4">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <span className="font-semibold">Bank-level security.</span> FinVision360 uses Plaid to connect your accounts. We never see or store your banking credentials. All data is encrypted and read-only — we cannot move money or make transactions.
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading connected accounts…
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-lg">No accounts connected yet</p>
              <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                Connect your bank or investment accounts to automatically sync balances. Your manual entries are always preserved.
              </p>
            </div>
            <PlaidLinkButton onSuccess={() => {}} />
          </CardContent>
        </Card>
      )}

      {/* Connected institutions */}
      {!isLoading && items.map((item) => {
        const itemAccounts = accounts.filter((a) => a.plaidItemId === item.id);
        const isSyncing = syncingId === item.id;

        return (
          <Card key={item.id} data-testid={`card-institution-${item.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {item.institutionName ?? "Connected Institution"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {item.lastSynced
                        ? `Last synced ${new Date(item.lastSynced).toLocaleString()}`
                        : "Never synced"}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(item.id)}
                    disabled={isSyncing}
                    data-testid={`button-sync-${item.id}`}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Syncing…" : "Sync Now"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        data-testid={`button-disconnect-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Disconnect
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect {item.institutionName}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove all synced account data for this institution. Your manually entered assets and liabilities will not be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => disconnectMutation.mutate(item.id)}
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <button
              className="w-full flex items-center justify-between px-6 py-3 text-sm text-muted-foreground hover:bg-accent/40 transition-colors"
              onClick={() => toggleExpanded(item.id)}
              data-testid={`button-toggle-accounts-${item.id}`}
            >
              <span className="flex items-center gap-2">
                {expandedItems.has(item.id)
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />}
                <span>{itemAccounts.length} account{itemAccounts.length !== 1 ? "s" : ""}</span>
              </span>
              <span className="text-xs">{expandedItems.has(item.id) ? "Hide" : "Show accounts"}</span>
            </button>
            {expandedItems.has(item.id) && (
              <>
                <Separator />
                <CardContent className="pt-4">
                  {itemAccounts.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <AlertCircle className="h-4 w-4" />
                      No accounts found — try syncing.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {itemAccounts.map((acct) => (
                        <div
                          key={acct.id}
                          className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-accent/40 transition-colors"
                          data-testid={`row-account-${acct.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-muted-foreground">
                              {accountTypeIcon(acct.type, acct.subtype)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{acct.name}</p>
                              {acct.officialName && acct.officialName !== acct.name && (
                                <p className="text-xs text-muted-foreground">{acct.officialName}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="secondary" className="text-xs capitalize hidden sm:flex">
                              {accountTypeLabel(acct.type, acct.subtype)}
                            </Badge>
                            <div className="text-right">
                              <p className="font-semibold text-sm" data-testid={`text-balance-${acct.id}`}>
                                {formatBalance(acct.currentBalance)}
                              </p>
                              {acct.availableBalance && acct.availableBalance !== acct.currentBalance && (
                                <p className="text-xs text-muted-foreground">
                                  {formatBalance(acct.availableBalance)} available
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
