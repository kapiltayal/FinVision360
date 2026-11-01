import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  CircleHelp,
  Landmark,
  Users,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { BeneficiaryAllocationSummary } from "@/lib/estate-beneficiary-allocation";

type BeneficiaryAllocationViewProps = {
  summary: BeneficiaryAllocationSummary;
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

export function BeneficiaryAllocationView({ summary }: BeneficiaryAllocationViewProps) {
  const hasAccounts =
    summary.beneficiaries.some((beneficiary) => beneficiary.accounts.length > 0) ||
    summary.unassignedAccounts.length > 0;
  const hasBeneficiaries = summary.beneficiaries.length > 0;

  return (
    <div className="space-y-4">
      {summary.overallocatedAccounts.length > 0 ? (
        <section
          role="alert"
          className="rounded-xl border border-amber-300/80 bg-amber-50/80 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/30 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-amber-950 dark:text-amber-100">
                Some accounts are allocated above 100%
              </h2>
              <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
                These legacy allocations are shown as recorded, without reallocating any amounts.
                Allocated totals may exceed total assets. Review the beneficiary percentages in Account view.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {summary.overallocatedAccounts.map((accountName, index) => (
                  <li
                    key={`${accountName}-${index}`}
                    className="rounded-md border border-amber-300/80 bg-background/70 px-2.5 py-1 text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
                  >
                    {accountName}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-background to-indigo-50 shadow-sm dark:border-blue-900/60 dark:from-blue-950/35 dark:via-card dark:to-indigo-950/25">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
                Allocation overview
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-foreground sm:text-lg">
                Where assets are assigned
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:flex sm:gap-7">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total assets</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{formatCurrency(summary.totalAssetValue)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Allocated</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-blue-700 dark:text-blue-300">{formatCurrency(summary.totalAssignedValue)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unassigned</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{formatCurrency(summary.totalUnassignedValue)}</p>
            </div>
          </div>
        </div>
      </section>

      {!hasAccounts ? (
        <section className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-3 font-semibold text-foreground">No assets to allocate yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Add assets to your financial overview to see beneficiary allocations here.
          </p>
        </section>
      ) : !hasBeneficiaries ? (
        <section className="rounded-xl border border-blue-200/70 bg-blue-50/50 px-5 py-4 dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="flex items-start gap-3">
            <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-foreground">No beneficiary allocations recorded</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The accounts below currently have no named beneficiary allocation. Their unassigned amounts are shown separately.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {hasBeneficiaries ? (
        <section aria-labelledby="beneficiary-allocation-heading" className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <header className="flex flex-col gap-1 border-b bg-muted/35 px-4 py-4 sm:px-5">
            <h2 id="beneficiary-allocation-heading" className="font-semibold text-foreground">
              By beneficiary
            </h2>
            <p className="text-sm text-muted-foreground">
              Each total reflects the saved share of each account.
            </p>
            <p className="text-xs text-muted-foreground">
              Identical beneficiary names are grouped regardless of case or extra spaces; differently named beneficiaries are not automatically merged.
            </p>
          </header>
          <div className="divide-y">
            {summary.beneficiaries.map((beneficiary) => (
              <article key={beneficiary.key} className="min-w-0">
                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
                      <Users className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-foreground">{beneficiary.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {beneficiary.accounts.length} {beneficiary.accounts.length === 1 ? "account" : "accounts"}
                      </p>
                    </div>
                  </div>
                  <p className="pl-12 text-xl font-bold tabular-nums tracking-tight text-blue-700 dark:text-blue-300 sm:pl-0">
                    {formatCurrency(beneficiary.totalAmount)}
                  </p>
                </div>
                <Breakdown label="Account breakdown" count={beneficiary.accounts.length}>
                  {beneficiary.accounts.map((account) => (
                    <AccountBreakdown key={account.assetId} account={account} />
                  ))}
                </Breakdown>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {summary.unassignedAccounts.length > 0 ? (
        <section aria-labelledby="unassigned-allocation-heading" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <header className="flex flex-col gap-2 border-b bg-muted/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 id="unassigned-allocation-heading" className="font-semibold text-foreground">Unassigned assets</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Accounts or portions without a named beneficiary allocation.
              </p>
            </div>
            <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">
              {formatCurrency(summary.totalUnassignedValue)}
            </p>
          </header>
          <div className="divide-y divide-border/60">
            {summary.unassignedAccounts.map((account) => (
              <AccountBreakdown key={account.assetId} account={account} showReason />
            ))}
          </div>
        </section>
      ) : hasAccounts ? (
        <section className="flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          <p className="text-emerald-950/80 dark:text-emerald-100/80">
            No unassigned account portions are included in this summary.
          </p>
        </section>
      ) : null}
    </div>
  );
}
