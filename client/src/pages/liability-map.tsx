import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, ArrowRight, CreditCard, RotateCcw, Waves } from "lucide-react";
import { type Liability } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatCurrencyFull, formatPercent } from "@/lib/format";
import { buildExposure, estimateRemainingInterest, getBarHeight, getTimelineTicks, sortExposure, type ExposureItem, type ExposureSort } from "@/lib/liability-map";

const sortOptions: { value: ExposureSort; label: string }[] = [
  { value: "avalanche", label: "Highest APR First" },
  { value: "snowball", label: "Smallest Balance First" },
  { value: "duration", label: "Longest Duration First" },
];

function aprTone(apr: number | null) {
  if (apr === null) return "neutral";
  if (apr > 15) return "high";
  if (apr >= 6) return "medium";
  return "low";
}

function toneClasses(apr: number | null) {
  const tone = aprTone(apr);
  if (tone === "high") return "border-red-300 bg-red-500/85 text-white dark:border-red-400/50 dark:bg-red-600";
  if (tone === "medium") return "border-yellow-300 bg-yellow-400/90 text-yellow-950 dark:border-yellow-300/50 dark:bg-yellow-500";
  if (tone === "low") return "border-emerald-300 bg-emerald-500/85 text-white dark:border-emerald-400/50 dark:bg-emerald-600";
  return "border-border bg-muted text-foreground";
}

function monthDurationLabel(months: number | null) {
  if (months === null) return "Duration needed";
  if (months <= 0) return "Paid off";
  return `${months} ${months === 1 ? "month" : "months"}`;
}

function endingDateLabel(item: ExposureItem, draft: string | undefined, now: Date) {
  if (item.durationSource === "paid") return "Paid off";
  if (draft !== undefined) {
    const draftMonths = Number(draft);
    if (draft.trim() === "" || !Number.isSafeInteger(draftMonths) || draftMonths < 1 || draftMonths > 12_000) {
      return "Enter valid months";
    }
    const date = new Date(now.getFullYear(), now.getMonth() + draftMonths, 1);
    return `Est. end ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  }
  if (item.durationSource === "maturity" && item.maturityDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.maturityDate);
    if (match) {
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return `Ends ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
  }
  if (item.monthsRemaining === null || item.monthsRemaining < 1) return "Add months for date";
  const date = new Date(now.getFullYear(), now.getMonth() + item.monthsRemaining, 1);
  return `Est. end ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

export default function LiabilityMapPage() {
  const [now] = useState(() => new Date());
  const [sort, setSort] = useState<ExposureSort>("avalanche");
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  const [durationDrafts, setDurationDrafts] = useState<Record<number, string>>({});
  const {
    data: liabilities = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<Liability[]>({ queryKey: ["/api/liabilities"] });

  const exposure = useMemo(
    () => buildExposure(liabilities, now, overrides),
    [liabilities, now, overrides],
  );
  const sortedExposure = useMemo(() => sortExposure(exposure, sort), [exposure, sort]);
  const totalBalance = exposure.reduce((total, item) => total + item.balance, 0);
  const interestEstimates = exposure.map(estimateRemainingInterest);
  const totalInterestOwed = interestEstimates.reduce((total, item) => total + (item ?? 0), 0);
  const excludedInterestCount = exposure.filter((item, index) => item.balance > 0 && interestEstimates[index] === null).length;
  const maxBalance = Math.max(0, ...exposure.map((item) => item.balance));
  const maxMonths = Math.max(1, ...exposure.map((item) => item.monthsRemaining ?? 0));
  const ticks = getTimelineTicks(maxMonths, now);

  const updateDuration = (id: number, value: string) => {
    setDurationDrafts(current => ({ ...current, [id]: value }));
    setOverrides((current) => {
      const months = Number(value);
      if (value.trim() === "" || !Number.isSafeInteger(months) || months < 1 || months > 12_000) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: months };
    });
  };
  const resetDuration = (id: number) => {
    setOverrides(current => { const next = { ...current }; delete next[id]; return next; });
    setDurationDrafts(current => { const next = { ...current }; delete next[id]; return next; });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="space-y-2"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <Card className="border-destructive/25 bg-destructive/[0.025]">
          <CardContent className="flex flex-col items-start gap-4 p-7 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><AlertCircle className="h-5 w-5" /></div>
            <div className="flex-1">
              <h1 className="font-semibold">Your liability map could not load</h1>
              <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Check your connection, then try again."}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-10 sm:p-6">
      <header className="page-header-gradient relative min-h-[110px] overflow-hidden">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[32px] border-primary/[0.04]" />
        <div className="relative flex min-h-[76px] flex-col justify-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Your liabilities, on a timeline.</h1>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/70 px-3 py-1 text-xs font-medium tracking-wide text-primary">
              <Waves className="h-3.5 w-3.5" /> DEBT EXPOSURE
              </div>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              See how each balance extends across time. Adjust a planning duration to compare scenarios—your saved accounts stay untouched.
            </p>
          </div>
          <Link href="/liabilities" className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-border bg-background/80 px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/30 hover:text-primary sm:self-auto">
            Manage liabilities <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {liabilities.length === 0 ? (
        <Card className="overflow-hidden border-dashed">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CreditCard className="h-6 w-6" /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">A clear horizon</p>
            <h2 className="mt-2 text-xl font-semibold">No liabilities to map yet</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Once you add debts, their balances and payoff horizons will appear here for a side-by-side view.</p>
            <Link href="/liabilities" className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Add a liability <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border-border/75 shadow-sm">
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b bg-background px-4 py-3 sm:px-5" aria-label="Liability totals">
              <p className="flex items-baseline gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current balance</span>
                <span className="text-lg font-semibold tracking-tight">{formatCurrency(totalBalance)}</span>
              </p>
              <p className="flex items-baseline gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total interest owed</span>
                <span className="text-lg font-semibold tracking-tight">{formatCurrency(totalInterestOwed)}</span>
              </p>
              <p className="basis-full text-xs text-muted-foreground">
                Estimated over the displayed duration at the current APR; excludes {excludedInterestCount} {excludedInterestCount === 1 ? "debt" : "debts"} without a usable APR or duration.
              </p>
            </div>
            <div className="flex flex-col gap-4 border-b bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="font-semibold">Exposure matrix</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Each bar shares one calendar scale; height reflects balance.</p>
              </div>
              <div className="flex flex-wrap gap-1 rounded-lg border bg-background p-1" role="group" aria-label="Sort liabilities">
                {sortOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={sort === option.value ? "secondary" : "ghost"}
                    aria-pressed={sort === option.value}
                    title={option.value === "avalanche" ? "Avalanche: prioritize the highest interest rates" : option.value === "snowball" ? "Snowball: prioritize the smallest balances" : "Prioritize the longest remaining durations"}
                    onClick={() => setSort(option.value)}
                    className={`h-8 px-2.5 text-xs ${sort === option.value ? "shadow-sm" : "text-muted-foreground"}`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" aria-label="APR color legend">
                <span className="font-medium text-muted-foreground">APR</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-red-500" /> &gt;15%</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-yellow-400" /> 6–15%</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> &lt;6%</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border bg-muted" /> Unknown</span>
              </div>
            </div>

            <div className="overflow-x-auto overscroll-x-contain" tabIndex={0} aria-label="Horizontally scrollable liability exposure timeline">
              <div className="min-w-[1000px]" style={{ width: "100%" }}>
                <div className="grid grid-cols-[280px_minmax(720px,1fr)] border-b bg-muted/15">
                  <div className="flex items-end justify-between px-5 pb-3 pt-4 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                    <span>Liability</span>
                    <span className="w-[96px] text-center">Months left</span>
                  </div>
                  <div className="relative h-[66px]">
                    <div className="absolute inset-x-0 bottom-0 top-0">
                      {ticks.map((tick, index) => {
                        const position = (tick.month / maxMonths) * 100;
                        const isTerminal = index === ticks.length - 1 || tick.month >= maxMonths;
                        return (
                          <div key={`${tick.month}-${tick.label}`} className="absolute bottom-0 top-0" style={{ left: `${position}%` }}>
                            <span className={`absolute bottom-[13px] whitespace-nowrap text-[11px] font-medium text-muted-foreground ${isTerminal ? "-translate-x-full" : tick.month === 0 ? "" : "-translate-x-1/2"}`}>
                              {tick.label}
                            </span>
                            <span className="absolute bottom-0 h-2.5 w-px bg-border" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {sortedExposure.map((item, index) => {
                  const isOverride = Object.prototype.hasOwnProperty.call(overrides, item.id);
                  const duration = item.monthsRemaining;
                  const draft = durationDrafts[item.id];
                  const invalidDraft = draft !== undefined && draft !== "" &&
                    (!Number.isSafeInteger(Number(draft)) || Number(draft) < 1 || Number(draft) > 12_000);
                  const hasBar = item.durationSource !== "unknown" && item.durationSource !== "paid" && duration !== null && duration > 0;
                  const widthPercent = hasBar ? (duration / maxMonths) * 100 : 0;
                  const barHeight = hasBar ? getBarHeight(item.balance, maxBalance) : 0;
                  const rowInterest = estimateRemainingInterest(item);
                  const rowHeight = Math.max(48, barHeight + 12);
                  return (
                    <div key={item.id} data-testid={`liability-map-row-${item.id}`} className={`grid grid-cols-[280px_minmax(720px,1fr)] border-b last:border-b-0 ${index % 2 ? "bg-muted/[0.08]" : "bg-background"}`} style={{ height: `${rowHeight}px` }}>
                      <div className="flex min-w-0 items-center gap-2 px-4 py-1 sm:px-5">
                        <div className="min-w-0 flex-1" title={item.issue ?? `Duration source: ${item.durationSource}`}>
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-xs font-semibold leading-4" title={item.name}>{item.name}</span>
                          {item.durationSource === "paid" && <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">Paid</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5 whitespace-nowrap text-[10px] leading-3 text-muted-foreground">
                          <span className="font-medium text-foreground/80">{formatCurrency(item.balance)}</span>
                          <span aria-hidden="true">·</span>
                          <span className={item.apr === null ? "" : item.apr > 15 ? "text-red-600 dark:text-red-400" : item.apr >= 6 ? "text-yellow-700 dark:text-yellow-400" : "text-emerald-700 dark:text-emerald-400"}>
                            {item.apr === null ? "APR unknown" : formatPercent(item.apr)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 whitespace-nowrap text-[10px] leading-3 text-muted-foreground">
                          <span>Total interest:</span>
                          <span
                            className="font-medium text-foreground/80"
                            title={rowInterest === null ? "Estimate unavailable without a usable APR and payoff duration" : "Estimated over the remaining duration at the current APR"}
                          >
                            {rowInterest === null ? "Unavailable" : formatCurrencyFull(rowInterest)}
                          </span>
                        </div>
                        </div>
                        <div className="flex w-[96px] shrink-0 flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1">
                            <label htmlFor={`duration-${item.id}`} className="sr-only">Months left</label>
                            <Input
                              id={`duration-${item.id}`}
                              type="number"
                              min="1"
                              max="12000"
                              step="1"
                              inputMode="numeric"
                              value={draft ?? (duration === null ? "" : String(duration))}
                              disabled={item.durationSource === "paid"}
                              aria-invalid={invalidDraft}
                              aria-describedby={`duration-help-${item.id}`}
                              onChange={(event) => updateDuration(item.id, event.target.value)}
                              onBlur={() => { if (draft === "") resetDuration(item.id); }}
                              placeholder="—"
                              aria-label={`Planning duration in months for ${item.name}`}
                              title={invalidDraft ? "Enter a whole number from 1 to 12,000." : item.issue ?? "Planning duration in months"}
                              className={`h-6 w-[68px] px-1.5 text-[11px] ${invalidDraft ? "border-destructive" : ""}`}
                            />
                            {isOverride && (
                              <button
                                type="button"
                                onClick={() => resetDuration(item.id)}
                                className="inline-flex h-6 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Reset ${item.name} duration to saved date or payment estimate`}
                                title="Restore saved-date/payment-derived duration"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <span
                            data-testid={`duration-end-date-${item.id}`}
                            className="whitespace-nowrap text-[9px] leading-3 text-muted-foreground"
                            aria-label={`Debt ending date for ${item.name}`}
                          >
                            {endingDateLabel(item, draft, now)}
                          </span>
                        </div>
                        <span id={`duration-help-${item.id}`} className="sr-only" aria-live="polite">
                          {invalidDraft ? "Enter a whole number from 1 to 12,000." : item.issue ??
                            (item.durationSource === "paid" ? "No balance remaining" : item.durationSource === "override" ? "Planning adjustment" :
                              item.durationSource === "maturity" ? "From saved maturity date" : "Estimated from APR and monthly payment")}
                        </span>
                      </div>

                      <div className="relative flex items-center">
                        <div className="absolute inset-x-0 inset-y-0 pointer-events-none">
                          {ticks.map((tick) => (
                            <span key={`${tick.month}-${tick.label}`} className="absolute bottom-0 top-0 border-l border-dashed border-border/60" style={{ left: `${(tick.month / maxMonths) * 100}%` }} />
                          ))}
                        </div>
                        {hasBar ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className={`relative z-[1] block shrink-0 rounded-r-md rounded-l-[3px] border before:absolute before:inset-x-0 before:top-1/2 before:h-full before:min-h-6 before:-translate-y-1/2 before:content-[''] transition-[filter,transform] duration-150 hover:brightness-105 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${toneClasses(item.apr)}`}
                                style={{ width: `${widthPercent}%`, height: `${barHeight}px` }}
                                aria-label={`${item.name}, balance ${formatCurrencyFull(item.balance)}, total interest ${rowInterest === null ? "unavailable" : formatCurrencyFull(rowInterest)}, APR ${item.apr === null ? "unknown" : formatPercent(item.apr)}, ${monthDurationLabel(duration)}, source ${item.durationSource}`}
                                data-testid={`liability-map-bar-${item.id}`}
                              >
                                <span className="sr-only">Debt exposure duration: {monthDurationLabel(duration)}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start" className="max-w-xs space-y-1 text-xs">
                              <p className="font-semibold">{item.name}</p>
                              <p>Balance: {formatCurrencyFull(item.balance)}</p>
                              <p>Total interest: {rowInterest === null ? "Unavailable" : formatCurrencyFull(rowInterest)}</p>
                              <p>APR: {item.apr === null ? "Unknown" : formatPercent(item.apr)}</p>
                              <p>Months remaining: {monthDurationLabel(duration)}</p>
                              <p>Source: {item.durationSource}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <div className={`relative z-[1] inline-flex items-center rounded-md border px-3 py-1.5 text-xs ${item.durationSource === "paid" ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-300" : "border-amber-500/25 bg-amber-500/[0.07] text-amber-900 dark:text-amber-200"}`}>
                            {item.durationSource === "paid" ? "No balance remaining" : "Add a duration to place on timeline"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="grid grid-cols-[280px_minmax(720px,1fr)] border-t bg-muted/20">
                  <div className="px-5 py-3 text-xs font-medium text-muted-foreground">Shared horizon</div>
                  <div className="relative h-8 px-2">
                    <span className="absolute left-2 top-2 text-[11px] text-muted-foreground">Now</span>
                    <span className="absolute right-2 top-2 text-[11px] text-muted-foreground">{ticks[ticks.length - 1]?.label}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t bg-muted/[0.12] px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p>Duration overrides live only in this session. They do not edit saved account details.</p>
              <p>Source follows saved maturity date or payment estimate unless overridden.</p>
            </div>
            <p className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5">
              Payoff estimates assume constant APR and monthly payments, with no new borrowing or fees. Bar length shows time, not total interest paid.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
