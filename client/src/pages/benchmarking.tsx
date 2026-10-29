import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowDownRight, ArrowUpRight, CalendarDays, CircleDollarSign, ExternalLink, Info, RefreshCw, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { BENCHMARK_SOURCE, buildSpendingBenchmarks, type BenchmarkSummary } from "@/lib/spending-benchmarks";

function formatMonth(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function periodDescription(summary: BenchmarkSummary): string {
  const { period } = summary;
  if (period.months === 0 || !period.startMonth || !period.endMonth) {
    return "No completed calendar months of transaction data yet";
  }
  if (period.months === 1) return `Based on 1 complete month: ${formatMonth(period.endMonth)}`;
  return `Based on ${period.months} complete months: ${formatMonth(period.startMonth)} – ${formatMonth(period.endMonth)}`;
}

function DeltaLabel({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-sm text-muted-foreground">At survey level</span>;
  }
  const isAbove = delta > 0;
  const Icon = isAbove ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Icon aria-hidden="true" className="h-4 w-4" />
      {formatCurrency(Math.abs(delta))} {isAbove ? "above" : "below"} survey
    </span>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-label="Loading spending benchmarks" role="status">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-36" />
    </div>
  );
}

export default function BenchmarkingPage() {
  const { data: summary, isLoading, isError, refetch, isFetching } = useQuery<BenchmarkSummary>({
    queryKey: ["/api/transactions/monthly-averages"],
  });

  const hasTransactions = Boolean(summary && summary.period.months > 0 && summary.categories.some((category) => category.transactionCount > 0));
  const benchmark = summary ? buildSpendingBenchmarks(summary) : null;
  const activeRows = benchmark?.rows.filter((row) => row.hasActivity) ?? [];
  const inactiveRows = benchmark?.rows.filter((row) => !row.hasActivity) ?? [];

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="page-header-gradient">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1 text-xs font-medium text-primary">
              <Scale className="h-3.5 w-3.5" />
              Survey comparison
            </div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-benchmarking-title">Income &amp; Expenses Benchmarking</h1>
            <p className="mt-1 text-muted-foreground">See how your monthly spending compares with surveyed household averages.</p>
            {summary && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="text-benchmarking-period">
                <CalendarDays className="h-3.5 w-3.5" />
                {periodDescription(summary)}
              </p>
            )}
          </div>
          {summary && hasTransactions && (
            <Badge variant="secondary" className="w-fit shrink-0">
              {benchmark?.coveragePercent.toFixed(0)}% of spending matched
            </Badge>
          )}
        </div>
      </header>

      <Card className="border-primary/20 bg-primary/[0.04]">
        <CardContent className="flex gap-3 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            Benchmarks describe surveyed spending, not a target. A difference is simply shown as above or below the survey figure.
            Only comparable categories are included; unmapped spending is shown separately.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="mb-3 h-9 w-9 text-destructive" />
            <h2 className="font-semibold">Benchmarks could not be loaded</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Your transaction summary is temporarily unavailable. Try again to reload the comparison.</p>
            <Button className="mt-4" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !summary || !hasTransactions || !benchmark ? (
        <Card>
          <CardContent className="py-14 text-center">
            <CircleDollarSign className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <h2 className="text-base font-semibold">No transaction history to compare yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Add and categorize expenses in the Financial Tracker. Comparisons appear once completed-month transaction data is available.
            </p>
            <Button asChild className="mt-5">
              <a href="/income-expenses/finance-tracker">Open Financial Tracker</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Benchmark coverage summary">
            <Card className="stat-card-3d">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Average monthly expenses</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(benchmark.totalMonthly)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Across {summary.period.months} complete month{summary.period.months === 1 ? "" : "s"}</p>
              </CardContent>
            </Card>
            <Card className="stat-card-3d">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Matched to survey categories</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(benchmark.matchedMonthly)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{benchmark.coveragePercent.toFixed(1)}% of your monthly spending</p>
              </CardContent>
            </Card>
            <Card className="stat-card-3d">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Not represented in comparison</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(benchmark.unmatchedMonthly)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Unmapped or outside these survey categories</p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="gap-1 pb-3">
              <CardTitle className="text-base">Monthly spending comparison</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Your average versus the survey average for the five comparable categories.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                  <caption className="sr-only">Average monthly spending compared with surveyed monthly category averages</caption>
                  <thead>
                    <tr className="border-y bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-6 py-3 font-medium">Category</th>
                      <th scope="col" className="px-6 py-3 text-right font-medium">Your monthly average</th>
                      <th scope="col" className="px-6 py-3 text-right font-medium">Survey monthly average</th>
                      <th scope="col" className="px-6 py-3 text-right font-medium">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeRows.map((row) => (
                      <tr key={row.key} className="transition-colors hover:bg-muted/20">
                        <th scope="row" className="px-6 py-4 font-medium">{row.label}</th>
                        <td className="px-6 py-4 text-right font-semibold tabular-nums">{formatCurrency(row.userMonthly)}</td>
                        <td className="px-6 py-4 text-right text-muted-foreground tabular-nums">{formatCurrency(row.benchmarkMonthly)}</td>
                        <td className="px-6 py-4 text-right"><DeltaLabel delta={row.delta} /></td>
                      </tr>
                    ))}
                    {inactiveRows.map((row) => (
                      <tr key={row.key} className="text-muted-foreground">
                        <th scope="row" className="px-6 py-4 font-medium text-foreground">{row.label}</th>
                        <td colSpan={3} className="px-6 py-4 text-right italic">No recorded charges</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">About this survey</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="font-medium">
                  {BENCHMARK_SOURCE.name} <span className="text-muted-foreground">({BENCHMARK_SOURCE.year})</span>
                </p>
                <a
                  href={BENCHMARK_SOURCE.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                >
                  View source <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="text-muted-foreground"><span className="font-medium text-foreground">Population:</span> {BENCHMARK_SOURCE.population}</p>
              <p className="text-muted-foreground"><span className="font-medium text-foreground">Methodology:</span> {BENCHMARK_SOURCE.methodology}</p>
              <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                Comparisons use only the categories listed above. The matched and unmatched amounts make the coverage explicit; unlisted or uncategorized spending is not assigned a survey value.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
