import { useMutation, useMutationState } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export type RetirementAccountInclusionKind =
  | "asset"
  | "liability"
  | "net-worth-entry"
  | "income-expense-entry"
  | "pension"
  | "social-security"
  | "expected-expenses";
type ProjectionKind = "net-worth" | "income-expense";

const inclusionMutationKey = ["/api/retirement/account-inclusion"];

type InlineAccountInclusionProps = {
  accountId: number;
  kind: RetirementAccountInclusionKind;
  projection: ProjectionKind;
  included: boolean;
  accountName: string;
};

export function InlineAccountInclusion({
  accountId,
  kind,
  projection,
  included,
  accountName,
}: InlineAccountInclusionProps) {
  const { toast } = useToast();
  const pendingRequests = useMutationState({
    filters: { mutationKey: inclusionMutationKey, status: "pending" },
  });
  const saveInclusion = useMutation({
    mutationKey: inclusionMutationKey,
    mutationFn: (nextIncluded: boolean) =>
      apiRequest("PUT", "/api/retirement/account-inclusion", {
        kind,
        accountId,
        projection,
        included: nextIncluded,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/retirement/net-worth-projection"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/retirement/income-expense-projection"] }),
      ]);
    },
    onError: (error: Error) =>
      toast({
        title: "Could not update account selection",
        description: error.message,
        variant: "destructive",
      }),
  });
  const projectionLabel = projection === "net-worth" ? "Net worth" : "Income & expenses";
  const kindLabel: Record<RetirementAccountInclusionKind, string> = {
    asset: "asset account",
    liability: "liability account",
    "net-worth-entry": "custom net worth entry",
    "income-expense-entry": "custom income or expense",
    pension: "pension",
    "social-security": "Social Security",
    "expected-expenses": "expected lifestyle expenses",
  };
  const label = `${included ? "Exclude" : "Include"} ${kindLabel[kind]} ${accountName} ${
    included ? "from" : "in"
  } the ${projectionLabel} projection`;

  return (
    <input
      type="checkbox"
      className="h-4 w-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50"
      checked={included}
      disabled={pendingRequests.length > 0}
      aria-label={label}
      onChange={(event) => saveInclusion.mutate(event.currentTarget.checked)}
    />
  );
}

export function ProjectionExclusionNotice({
  count,
  names,
  projection,
}: {
  count: number;
  names: string[];
  projection: ProjectionKind;
}) {
  const projectionLabel = projection === "net-worth" ? "Net worth" : "Income & expenses";
  const { toast } = useToast();
  const pendingRequests = useMutationState({
    filters: { mutationKey: inclusionMutationKey, status: "pending" },
  });
  const resetInclusion = useMutation({
    mutationKey: inclusionMutationKey,
    mutationFn: () =>
      apiRequest("POST", "/api/retirement/account-inclusion/reset", { projection }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/retirement/net-worth-projection"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/retirement/income-expense-projection"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/retirement/account-inclusion"] }),
      ]);
    },
    onError: (error: Error) =>
      toast({
        title: "Could not reset projection selections",
        description: error.message,
        variant: "destructive",
      }),
  });
  if (count <= 0) return null;

  return (
    <div
      className="rounded-lg border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
      role="status"
    >
      <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0">
          <span className="block">{count} {count === 1 ? "account has" : "accounts have"} been excluded from the calculations.</span>
          {names.length > 0 && <span className="mt-1 block break-words font-normal">Excluded: {names.join(", ")}</span>}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 self-start px-2 text-xs sm:self-center"
          disabled={pendingRequests.length > 0}
          aria-label={`Include all items in the ${projectionLabel} projection`}
          onClick={() => resetInclusion.mutate()}
        >
          {resetInclusion.isPending ? "Resetting…" : "Reset"}
        </Button>
      </span>
    </div>
  );
}
