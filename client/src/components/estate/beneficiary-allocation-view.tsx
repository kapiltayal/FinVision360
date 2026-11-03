import React, { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Landmark,
  Pencil,
  Users,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import type { BeneficiaryAllocationSummary } from "@/lib/estate-beneficiary-allocation";

type BeneficiaryAllocationViewProps = {
  summary: BeneficiaryAllocationSummary;
  onEdit?: (beneficiaryId: number) => void;
};

type AllocationAccount = BeneficiaryAllocationSummary["beneficiaries"][number]["accounts"][number];

function formatPercentage(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function AccountBreakdown({
  account,
  showReason = false,
}: {
  account: AllocationAccount & { reason?: string };
  showReason?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Landmark className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{account.accountName}</p>
          {account.institution ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{account.institution}</p>
          ) : null}
          {showReason ? (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Why:</span> {account.reason}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 pl-11 text-left sm:min-w-[340px] sm:pl-0 sm:text-right">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Share</p>
          <p className="text-xs text-muted-foreground sm:text-sm">{formatPercentage(account.percentage)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Account value</p>
          <p className="text-xs tabular-nums text-muted-foreground sm:text-sm">{formatCurrency(account.accountValue)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {showReason ? "Unassigned" : "Allocated"}
          </p>
          <p className="text-xs font-semibold tabular-nums text-foreground sm:text-sm">{formatCurrency(account.amount)}</p>
        </div>
      </div>
    </div>
  );
}

function Breakdown({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="group border-t border-border/70"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-primary outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 [&::-webkit-details-marker]:hidden">
        <span>{label} · {count} {count === 1 ? "account" : "accounts"}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </summary>
      <div className="divide-y divide-border/60 bg-muted/20">{children}</div>
    </details>
  );
}

export function BeneficiaryAllocationView({ summary, onEdit }: BeneficiaryAllocationViewProps) {
  const [expandedBeneficiaries, setExpandedBeneficiaries] = useState<Record<string, boolean>>({});
  const hasAccounts =
    summary.beneficiaries.length > 0 ||
    summary.unassignedAccounts.length > 0;

  return (
    <div className="space-y-3">
      {!hasAccounts ? (
        <section className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-3 font-semibold text-foreground">No assets to allocate yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Add assets to see allocations here.</p>
        </section>
      ) : (
        <div className="space-y-3">
          {summary.overallocatedAccounts.length > 0 ? (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Allocations exceed 100% for {summary.overallocatedAccounts.join(", ")}. Review them in Account view.
              </p>
            </div>
          ) : null}
          {summary.beneficiaries.map((beneficiary) => {
            const isExpanded = expandedBeneficiaries[beneficiary.key] ?? false;
            return (
              <article
                key={beneficiary.key}
                data-testid={`beneficiary-allocation-card-${beneficiary.key}`}
                className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"
              >
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1">
                      <h3 className="truncate font-semibold text-foreground">{beneficiary.name}</h3>
                      {onEdit && beneficiary.beneficiaryId !== undefined && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                          aria-label={`Edit beneficiary ${beneficiary.name}`}
                          title="Edit beneficiary"
                          data-testid={`button-edit-beneficiary-${beneficiary.beneficiaryId}`}
                          onClick={() => onEdit(beneficiary.beneficiaryId!)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {beneficiary.accounts.length} {beneficiary.accounts.length === 1 ? "account" : "accounts"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <p className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-300">
                    {formatCurrency(beneficiary.totalAmount)}
                  </p>
                  {beneficiary.accounts.length > 0 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground"
                      aria-label={`${isExpanded ? "Hide" : "Show"} accounts for ${beneficiary.name}`}
                      aria-expanded={isExpanded}
                      data-testid={`button-toggle-beneficiary-accounts-${beneficiary.key}`}
                      onClick={() =>
                        setExpandedBeneficiaries((current) => ({
                          ...current,
                          [beneficiary.key]: !isExpanded,
                        }))
                      }
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </Button>
                  ) : null}
                </div>
              </div>
              {isExpanded ? (
                <div className="divide-y divide-border/60 border-t border-border/70 bg-muted/20">
                  {beneficiary.accounts.map((account) => (
                  <AccountBreakdown key={account.assetId} account={account} />
                  ))}
                </div>
              ) : null}
              </article>
            );
          })}

          {summary.unassignedAccounts.length > 0 ? (
            <article
              data-testid="unassigned-allocation-card"
              className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Unassigned</h3>
                    <p className="text-xs text-muted-foreground">
                      {summary.unassignedAccounts.length} {summary.unassignedAccounts.length === 1 ? "account" : "accounts"}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-lg font-bold tabular-nums text-foreground">
                  {formatCurrency(summary.totalUnassignedValue)}
                </p>
              </div>
              <Breakdown label="Accounts" count={summary.unassignedAccounts.length}>
                {summary.unassignedAccounts.map((account) => (
                  <AccountBreakdown key={account.assetId} account={account} showReason />
                ))}
              </Breakdown>
            </article>
          ) : null}
        </div>
      )}
    </div>
  );
}
