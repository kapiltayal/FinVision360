import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, Landmark, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type AccountKind = "asset" | "liability";
type ProjectionKind = "net-worth" | "income-expense";

type RetirementAccount = {
  id: number;
  kind: AccountKind;
  name: string;
  category: string;
  balance: string;
  netWorthIncluded: boolean;
  incomeExpenseIncluded: boolean;
};

type AccountInclusionResponse = {
  accounts: RetirementAccount[];
};

type RetirementAccountSelectionProps = {
  projection: ProjectionKind;
};

const inclusionQueryKey = ["/api/retirement/account-inclusion"];

export function RetirementAccountSelection({ projection }: RetirementAccountSelectionProps) {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch, isFetching } = useQuery<AccountInclusionResponse>({
    queryKey: inclusionQueryKey,
  });

  const saveInclusion = useMutation({
    mutationFn: (choice: { accountId: number; kind: AccountKind; included: boolean }) =>
      apiRequest("PUT", "/api/retirement/account-inclusion", {
        ...choice,
        projection,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inclusionQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/retirement/net-worth-projection"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/retirement/income-expense-projection"] }),
      ]);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update account selection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const accounts = data?.accounts;
  const projectionLabel = projection === "net-worth" ? "Net worth" : "Income & expenses";
  const includedValue = (account: RetirementAccount) =>
    projection === "net-worth" ? account.netWorthIncluded : account.incomeExpenseIncluded;

  return (
    <section
      aria-labelledby={`account-selection-${projection}`}
      className="overflow-hidden rounded-xl border border-violet-500/15 bg-violet-500/[0.025]"
    >
      <div className="flex flex-col gap-3 border-b border-violet-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300">
            <Landmark className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id={`account-selection-${projection}`} className="text-sm font-semibold">
              Accounts in this projection
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Choose which accounts count toward {projectionLabel.toLowerCase()}. Choices are saved separately for each projection; this never moves or removes real funds.
            </p>
          </div>
        </div>
        {isError ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-2 self-start sm:self-auto"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4" aria-label="Loading account selections" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 rounded-lg bg-background/70 px-3 py-3">
              <div className="space-y-2">
                <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-24 animate-pulse rounded bg-muted/70" />
              </div>
              <div className="h-5 w-9 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-start gap-3 px-4 py-5 text-sm" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Account selections couldn’t be loaded.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your projection is not assuming that all accounts are included. Retry to load your saved choices.
            </p>
          </div>
        </div>
      ) : !accounts?.length ? (
        <div className="px-4 py-5 text-sm">
          <p className="font-medium">No accounts to include yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Assets and liabilities you add will appear here.</p>
        </div>
      ) : (
        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none transition-colors hover:bg-violet-500/[0.035] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-sm font-semibold">Manage accounts</span>
              <span className="truncate text-xs text-muted-foreground">
                {accounts.filter(includedValue).length} of {accounts.length} included
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-4 border-t border-violet-500/10 p-3 sm:p-4">
            {(["asset", "liability"] as const).map((kind) => {
              const group = accounts.filter((account) => account.kind === kind);
              if (group.length === 0) return null;
              return (
                <div key={kind}>
                  <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {kind === "asset" ? "Assets" : "Liabilities"}
                  </h3>
                  <ul className="space-y-1.5">
                    {group.map((account) => {
                      const included = includedValue(account);
                      const labelId = `account-${projection}-${account.kind}-${account.id}`;
                      const amount = Number(account.balance);
                      return (
                        <li
                          key={`${account.kind}-${account.id}`}
                          className="flex min-h-[3.75rem] items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/75 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{account.name}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {account.category}
                              <span aria-hidden="true"> · </span>
                              <span className="tabular-nums">
                                {Number.isFinite(amount) ? formatCurrency(amount) : account.balance}
                              </span>
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2.5">
                            <span className={`text-xs font-medium ${included ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
                              {included ? "Included" : "Excluded"}
                            </span>
                            <Switch
                              id={labelId}
                              checked={included}
                              disabled={saveInclusion.isPending}
                              aria-label={`${included ? "Exclude" : "Include"} ${account.kind} ${account.name} ${included ? "from" : "in"} the ${projectionLabel} projection`}
                              onCheckedChange={(checked) =>
                                saveInclusion.mutate({
                                  accountId: account.id,
                                  kind: account.kind,
                                  included: checked,
                                })
                              }
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {projection === "income-expense" ? (
              <p className="border-t border-violet-500/10 px-1 pt-3 text-xs leading-relaxed text-muted-foreground">
                Cash-flow projections currently use withdrawals from retirement-category assets and payments on outstanding debts. Other asset categories have no direct cash-flow contribution.
              </p>
            ) : null}
          </div>
        </details>
      )}
    </section>
  );
}
