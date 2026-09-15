import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import {
  ArrowRight,
  CalendarDays,
  Landmark,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type RetirementPlannerSettings } from "@shared/schema";
import { type BookCategory } from "@/lib/book-categories";
import {
  RetirementNetWorthProjection,
  type ProjectionEntryInput,
  type RetirementProjection,
} from "@/components/retirement-net-worth-projection";

const MAX_AGE = 125;

type CashFlowSummary = {
  period: { startMonth: string | null; endMonth: string | null; months: number };
  averages: { income: number; expenses: number; net: number; savingsRate: number };
};

function getCurrentAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;

  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const hadBirthday =
    today.getUTCMonth() > dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() >= dob.getUTCDate());

  if (!hadBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function isValidAge(value: string, currentAge: number): boolean {
  const age = Number(value);
  return Number.isInteger(age) && age > currentAge && age <= MAX_AGE;
}

function getDefaultRetirementAge(currentAge: number): string {
  return String(Math.min(MAX_AGE, Math.max(currentAge + 1, 65)));
}

function getDefaultLifeExpectancy(currentAge: number): string {
  return String(Math.min(MAX_AGE, Math.max(currentAge + 1, 85)));
}

export default function RetirementPlannerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const currentAge = getCurrentAge((user as any)?.dateOfBirth);
  const [retirementAge, setRetirementAge] = useState("");
  const [lifeExpectancy, setLifeExpectancy] = useState("");
  const { data: savedSettings } = useQuery<RetirementPlannerSettings>({
    queryKey: ["/api/retirement/planner-settings"],
  });
  const { data: retirementProjection, isLoading: projectionLoading } = useQuery<RetirementProjection>({
    queryKey: ["/api/retirement/net-worth-projection"],
  });
  const { data: assetCategories = [] } = useQuery<BookCategory[]>({
    queryKey: ["/api/asset-categories"],
  });
  const { data: liabilityCategories = [] } = useQuery<BookCategory[]>({
    queryKey: ["/api/liability-categories"],
  });
  const { data: cashFlowSummary } = useQuery<CashFlowSummary>({
    queryKey: ["/api/transactions/monthly-averages"],
  });
  const saveMutation = useMutation({
    mutationFn: (settings: { retirementAge: number; lifeExpectancy: number }) =>
      apiRequest("PUT", "/api/retirement/planner-settings", settings).then((response) => response.json()),
    onSuccess: (settings: RetirementPlannerSettings) => {
      queryClient.setQueryData(["/api/retirement/planner-settings"], settings);
      queryClient.invalidateQueries({ queryKey: ["/api/retirement/net-worth-projection"] });
    },
    onError: (error: Error) => {
      if (savedSettings) {
        setRetirementAge(String(savedSettings.retirementAge));
        setLifeExpectancy(String(savedSettings.lifeExpectancy));
      }
      toast({ title: "Could not save retirement timeline", description: error.message, variant: "destructive" });
    },
  });
  const assetRateMutation = useMutation({
    mutationFn: ({ assetId, rateOfReturn }: { assetId: number; rateOfReturn: number }) =>
      apiRequest("PUT", `/api/retirement/asset-rate/${assetId}`, { rateOfReturn }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/retirement/net-worth-projection"] }),
    onError: (error: Error) => toast({ title: "Could not save return rate", description: error.message, variant: "destructive" }),
  });
  const resetAssetRateMutation = useMutation({
    mutationFn: (assetId: number) => apiRequest("DELETE", `/api/retirement/asset-rate/${assetId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/retirement/net-worth-projection"] }),
    onError: (error: Error) => toast({ title: "Could not reset return rate", description: error.message, variant: "destructive" }),
  });
  const saveProjectionEntryMutation = useMutation({
    mutationFn: ({ entryId, entry }: { entryId: number | null; entry: ProjectionEntryInput }) =>
      apiRequest(entryId === null ? "POST" : "PATCH", entryId === null
        ? "/api/retirement/projection-entries"
        : `/api/retirement/projection-entries/${entryId}`, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retirement/net-worth-projection"] });
      toast({ title: "Retirement projection saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save projection entry", description: error.message, variant: "destructive" }),
  });
  const deleteProjectionEntryMutation = useMutation({
    mutationFn: (entryId: number) => apiRequest("DELETE", `/api/retirement/projection-entries/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retirement/net-worth-projection"] });
      toast({ title: "Projection entry removed" });
    },
    onError: (error: Error) => toast({ title: "Could not remove projection entry", description: error.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (currentAge === null) {
      setRetirementAge("");
      setLifeExpectancy("");
      return;
    }

    const savedRetirementAge = Number(savedSettings?.retirementAge);
    const savedLifeExpectancy = Number(savedSettings?.lifeExpectancy);
    const nextLifeExpectancy = isValidAge(String(savedLifeExpectancy), currentAge)
      ? savedLifeExpectancy
      : Number(getDefaultLifeExpectancy(currentAge));
    const nextRetirementAge = Math.min(
      isValidAge(String(savedRetirementAge), currentAge)
        ? savedRetirementAge
        : Number(getDefaultRetirementAge(currentAge)),
      nextLifeExpectancy,
    );
    setRetirementAge(String(nextRetirementAge));
    setLifeExpectancy(String(nextLifeExpectancy));
  }, [currentAge, savedSettings?.retirementAge, savedSettings?.lifeExpectancy]);

  const saveTimeline = (nextRetirementAge: number, nextLifeExpectancy: number) => {
    saveMutation.mutate({
      retirementAge: Math.max(currentAgeFloor, Math.min(nextRetirementAge, nextLifeExpectancy)),
      lifeExpectancy: Math.max(nextLifeExpectancy, nextRetirementAge),
    });
  };

  const currentAgeFloor = currentAge === null ? 1 : currentAge + 1;
  const retirementAgeValue = Number(retirementAge) || currentAgeFloor;
  const lifeExpectancyValue = Number(lifeExpectancy) || currentAgeFloor;
  const timelineValues = [
    Math.min(retirementAgeValue, lifeExpectancyValue),
    Math.max(retirementAgeValue, lifeExpectancyValue),
  ];
  const activeThumbRef = useRef<number | null>(null);
  const timelineValuesRef = useRef(timelineValues);
  const timelineSliderRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    timelineValuesRef.current = timelineValues;
  }, [timelineValues[0], timelineValues[1]]);

  const handleTimelineChange = (values: number[]) => {
    if (values.length < 2) return;

    const previousValues = timelineValuesRef.current;
    const activeThumb = activeThumbRef.current;
    let nextValues: [number, number];
    let shouldRestoreFocus = false;

    if (activeThumb === 0) {
      const attemptedValue =
        values[0] === previousValues[1] && values[1] > previousValues[1] ? values[1] : values[0];
      shouldRestoreFocus = values[0] === previousValues[1] && values[1] > previousValues[1];
      nextValues = [Math.max(currentAgeFloor, Math.min(attemptedValue, previousValues[1])), previousValues[1]];
    } else if (activeThumb === 1) {
      const attemptedValue =
        values[1] === previousValues[0] && values[0] < previousValues[0] ? values[0] : values[1];
      shouldRestoreFocus = values[1] === previousValues[0] && values[0] < previousValues[0];
      nextValues = [previousValues[0], Math.max(attemptedValue, previousValues[0])];
    } else {
      nextValues = [
        Math.max(currentAgeFloor, Math.min(values[0], values[1])),
        Math.max(values[0], values[1]),
      ];
    }

    timelineValuesRef.current = nextValues;
    setRetirementAge(String(nextValues[0]));
    setLifeExpectancy(String(nextValues[1]));

    if (shouldRestoreFocus && activeThumb !== null) {
      window.requestAnimationFrame(() => {
        const thumbs = timelineSliderRef.current?.querySelectorAll<HTMLElement>('[role="slider"]');
        thumbs?.[activeThumb]?.focus();
      });
    }
  };
  const lifeExpectancyPercent =
    ((lifeExpectancyValue - currentAgeFloor + 1) / (MAX_AGE - currentAgeFloor + 1)) * 100;
  const decadeMarkers = Array.from(
    { length: Math.floor(MAX_AGE / 10) - Math.ceil(currentAgeFloor / 10) + 1 },
    (_, index) => Math.ceil(currentAgeFloor / 10) * 10 + index * 10,
  ).filter((age) => age <= MAX_AGE);
  const cashFlow = cashFlowSummary?.averages ?? {
    income: 0,
    expenses: 0,
    net: 0,
    savingsRate: 0,
  };
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="page-header-gradient">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-violet-500/10 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Retirement Planner</h1>
            <p className="text-muted-foreground">Project your savings, wealth and income. Plan your path to financial freedom</p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-violet-500/20 shadow-sm">
        <CardHeader className="border-b bg-violet-500/5 px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/10">
              <CalendarDays className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-base">Retirement Timeline</CardTitle>
              <CardDescription className="mt-0.5 text-xs">Set the ages used for your retirement projection.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {currentAge === null ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Add your date of birth to calculate your current age.</span>
              <Link href="/settings" className="shrink-0 font-medium text-primary hover:underline">
                Update profile
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-3">
                <div className="flex min-h-5 items-center gap-2">
                  <Label>Current Age</Label>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-semibold leading-none" data-testid="text-retirement-current-age">
                    {currentAge}
                  </p>
                  <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
                    Update
                  </Link>
                </div>
              </div>

              <div className="space-y-4 md:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="retirement-timeline" className="text-violet-700 dark:text-violet-300">
                      Retirement Age
                    </Label>
                    <span className="text-lg font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                      {retirementAge}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="retirement-timeline" className="text-emerald-700 dark:text-emerald-300">
                      Life Expectancy
                    </Label>
                    <span className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {lifeExpectancy}
                    </span>
                  </div>
                </div>
                <Slider
                  id="retirement-timeline"
                  min={currentAge}
                  max={MAX_AGE}
                  step={1}
                  minStepsBetweenThumbs={0}
                  ref={timelineSliderRef}
                  value={timelineValues}
                  onValueChange={handleTimelineChange}
                  onValueCommit={() => {
                    const [nextRetirementAge, nextLifeExpectancy] = timelineValuesRef.current;
                    saveTimeline(nextRetirementAge, nextLifeExpectancy);
                  }}
                  thumbLabels={["Retirement Age", "Life Expectancy"]}
                  thumbClassNames={[
                    "border-violet-600 bg-violet-100 dark:border-violet-400 dark:bg-violet-950",
                    "border-emerald-600 bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950",
                  ]}
                  onThumbPointerDown={(index) => {
                    activeThumbRef.current = index;
                  }}
                  onThumbKeyDown={(index) => {
                    activeThumbRef.current = index;
                  }}
                  trackFill={{
                    startPercent: 0,
                    endPercent: Math.min(100, Math.max(0, lifeExpectancyPercent)),
                    className: "bg-gradient-to-r from-violet-500 to-emerald-500",
                  }}
                  aria-label="Retirement timeline"
                  data-testid="slider-retirement-timeline"
                />
                <div className="relative h-7 text-[10px] text-muted-foreground">
                  <span className="absolute left-0 -translate-x-1/2 text-center">
                    <span className="mx-auto mb-0.5 block h-1.5 w-px bg-muted-foreground/60" />
                    {currentAge}
                  </span>
                  {decadeMarkers.map((age) => {
                    const markerPercent = ((age - currentAge) / (MAX_AGE - currentAge)) * 100;
                    return (
                      <span
                        key={age}
                        className="absolute -translate-x-1/2 text-center"
                        style={{ left: `${markerPercent}%` }}
                      >
                        <span className="mx-auto mb-0.5 block h-1.5 w-px bg-muted-foreground/60" />
                        {age}
                      </span>
                    );
                  })}
                  <span className="absolute right-0 translate-x-1/2 text-center">
                    <span className="mx-auto mb-0.5 block h-1.5 w-px bg-muted-foreground/60" />
                    {MAX_AGE}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200/70 shadow-sm dark:border-slate-800">
        <Tabs defaultValue="net-worth" className="w-full">
          <div className="border-b bg-slate-50/80 px-4 pt-4 dark:bg-slate-900/40">
            <TabsList className="grid h-auto w-full max-w-xl grid-cols-2 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
              <TabsTrigger
                value="net-worth"
                data-testid="tab-retirement-net-worth"
                className="gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold sm:text-sm data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-violet-300"
              >
                <WalletCards className="h-4 w-4" />
                Net worth at Retirement
              </TabsTrigger>
              <TabsTrigger
                value="income-expenses"
                data-testid="tab-retirement-income-expenses"
                className="gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold sm:text-sm data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-emerald-300"
              >
                <ReceiptText className="h-4 w-4" />
                Income &amp; Expenses at Retirement
              </TabsTrigger>
            </TabsList>
          </div>

          <CardContent className="p-4 sm:p-5">
            <TabsContent value="net-worth" className="mt-0 space-y-5">
              {projectionLoading || !retirementProjection ? (
                <div className="rounded-xl border px-4 py-12 text-center text-sm text-muted-foreground">
                  Calculating your retirement projection...
                </div>
              ) : (
                <RetirementNetWorthProjection
                  projection={retirementProjection}
                  assetCategories={assetCategories}
                  liabilityCategories={liabilityCategories}
                  actions={{
                    onAssetRateChange: (assetId, rateOfReturn) => assetRateMutation.mutateAsync({ assetId, rateOfReturn }),
                    onAssetRateReset: (assetId) => resetAssetRateMutation.mutateAsync(assetId),
                    onSaveEntry: (entryId, entry) => saveProjectionEntryMutation.mutateAsync({ entryId, entry }),
                    onDeleteEntry: (entryId) => {
                      if (window.confirm("Remove this projection-only entry?")) {
                        deleteProjectionEntryMutation.mutate(entryId);
                      }
                    },
                    saving: assetRateMutation.isPending
                      || resetAssetRateMutation.isPending
                      || saveProjectionEntryMutation.isPending
                      || deleteProjectionEntryMutation.isPending,
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="income-expenses" className="mt-0 space-y-5">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-5 text-white shadow-sm">
                <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
                <div className="absolute -bottom-16 right-20 h-36 w-36 rounded-full bg-cyan-300/20" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-emerald-100">
                      <ReceiptText className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.16em]">Your retirement cash flow</span>
                    </div>
                    <h2 className="text-xl font-bold">Income &amp; Expenses at Retirement</h2>
                    <p className="mt-1 max-w-xl text-sm text-emerald-100">
                      See the monthly spending baseline you will need to replace and the retirement income sources you can build.
                    </p>
                  </div>
                  <div className="hidden rounded-xl bg-white/10 px-4 py-3 text-right sm:block">
                    <p className="text-xs text-emerald-100">Starting at age</p>
                    <p className="text-2xl font-bold">{retirementAgeValue}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monthly income</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(cashFlow.income)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Current recorded average</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-300">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monthly expenses</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-orange-700 dark:text-orange-300">{formatCurrency(cashFlow.expenses)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Current spending baseline</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
                    <PiggyBank className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monthly surplus</p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums ${cashFlow.net >= 0 ? "text-blue-700 dark:text-blue-300" : "text-red-700 dark:text-red-300"}`}>
                    {formatCurrency(cashFlow.net)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Available to save or invest</p>
                </div>
              </div>

              <div>
                <div className="mb-3">
                  <p className="font-semibold">Build your retirement income plan</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Connect each income source to see how it can help cover your spending baseline.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Link href="/retirement/social-security" className="group rounded-xl border bg-card p-4 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    <p className="mt-3 font-semibold">Social Security</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Estimate benefits and choose a claiming age.</p>
                  </Link>
                  <Link href="/retirement/pension" className="group rounded-xl border bg-card p-4 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
                        <Landmark className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    <p className="mt-3 font-semibold">Pension income</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Add employer pensions and recurring payments.</p>
                  </Link>
                  <Link href="/retirement/401k" className="group rounded-xl border bg-card p-4 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                        <WalletCards className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    <p className="mt-3 font-semibold">401(k) withdrawals</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Model contributions and future account value.</p>
                  </Link>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
