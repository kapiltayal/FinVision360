import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Calculator,
  ChevronDown,
  House,
  Info,
  KeyRound,
  Scale,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";

type RentVsBuyInputs = {
  homePrice: number;
  monthlyRent: number;
  downPaymentPct: number;
  mortgageRatePct: number;
  mortgageTermYears: number;
  propertyTaxPct: number;
  annualHomeInsurance: number;
  annualMaintenancePct: number;
  homeAppreciationPct: number;
  annualRentIncreasePct: number;
  investmentReturnPct: number;
  purchaseClosingCostPct: number;
  sellingCostPct: number;
  yearsToCompare: number;
};

type NumericFieldProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
};

const INITIAL_INPUTS: RentVsBuyInputs = {
  homePrice: 425000,
  monthlyRent: 2500,
  downPaymentPct: 20,
  mortgageRatePct: 6.5,
  mortgageTermYears: 30,
  propertyTaxPct: 1.1,
  annualHomeInsurance: 1800,
  annualMaintenancePct: 1,
  homeAppreciationPct: 3,
  annualRentIncreasePct: 3,
  investmentReturnPct: 6,
  purchaseClosingCostPct: 3,
  sellingCostPct: 6,
  yearsToCompare: 10,
};

function NumericField({
  id,
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100,
  suffix,
}: NumericFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const parsed = event.currentTarget.valueAsNumber;
            if (!Number.isFinite(parsed)) return;
            onChange(Math.min(max, Math.max(min, parsed)));
          }}
          className={`h-11 rounded-lg bg-background/80 ${suffix ? "pr-16" : ""}`}
          data-testid={`input-${id}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center whitespace-nowrap text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export default function RentVsBuyCalculator() {
  const [inputs, setInputs] = useState(INITIAL_INPUTS);
  const update = <K extends keyof RentVsBuyInputs>(key: K, value: number) =>
    setInputs((current) => ({ ...current, [key]: value }));

  const projection = useMemo(() => {
    const homePrice = Math.max(0, inputs.homePrice);
    const horizonMonths = Math.max(1, Math.round(inputs.yearsToCompare * 12));
    const mortgageTermMonths = Math.max(1, Math.round(inputs.mortgageTermYears * 12));
    const monthlyRate = Math.max(0, inputs.mortgageRatePct) / 1200;
    const loanAmount = homePrice * (1 - inputs.downPaymentPct / 100);
    const mortgagePayment = monthlyRate === 0
      ? loanAmount / mortgageTermMonths
      : loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -mortgageTermMonths));
    const investmentRate = Math.pow(1 + inputs.investmentReturnPct / 100, 1 / 12) - 1;
    const homeGrowth = 1 + inputs.homeAppreciationPct / 100;
    const rentGrowth = 1 + inputs.annualRentIncreasePct / 100;
    const downPaymentCash = homePrice * inputs.downPaymentPct / 100;
    const purchaseClosingCash = homePrice * inputs.purchaseClosingCostPct / 100;
    const upfrontBuyerCash = downPaymentCash + purchaseClosingCash;

    let remainingMortgage = loanAmount;
    let renterInvestments = upfrontBuyerCash;
    let buyerInvestments = 0;
    let firstMonthOwnerCost = 0;
    let firstMonthMortgagePayment = 0;
    let firstMonthPropertyTax = 0;
    let firstMonthMaintenance = 0;
    let firstMonthInsurance = 0;

    for (let month = 0; month < horizonMonths; month += 1) {
      const yearFraction = month / 12;
      const homeValue = homePrice * Math.pow(homeGrowth, yearFraction);
      const rentPayment = inputs.monthlyRent * Math.pow(rentGrowth, yearFraction);
      let mortgagePaymentThisMonth = 0;

      if (remainingMortgage > 0) {
        const interest = remainingMortgage * monthlyRate;
        mortgagePaymentThisMonth = Math.min(mortgagePayment, remainingMortgage + interest);
        const principalPaid = Math.max(0, mortgagePaymentThisMonth - interest);
        remainingMortgage = Math.max(0, remainingMortgage - principalPaid);
      }

      const propertyTax = homeValue * inputs.propertyTaxPct / 1200;
      const maintenance = homeValue * inputs.annualMaintenancePct / 1200;
      const insurance = inputs.annualHomeInsurance / 12;
      const ownerHousingCost =
        mortgagePaymentThisMonth + propertyTax + maintenance + insurance;

      if (month === 0) {
        firstMonthOwnerCost = ownerHousingCost;
        firstMonthMortgagePayment = mortgagePaymentThisMonth;
        firstMonthPropertyTax = propertyTax;
        firstMonthMaintenance = maintenance;
        firstMonthInsurance = insurance;
      }

      // Each scenario invests its up-front cash or monthly housing-cost savings.
      renterInvestments = renterInvestments * (1 + investmentRate) +
        ownerHousingCost - rentPayment;
      buyerInvestments = buyerInvestments * (1 + investmentRate) +
        rentPayment - ownerHousingCost;
    }

    const futureHomeValue = homePrice * Math.pow(homeGrowth, horizonMonths / 12);
    const homeEquityAfterSelling = futureHomeValue * (1 - inputs.sellingCostPct / 100) -
      remainingMortgage;
    const buyNetWorth = homeEquityAfterSelling - purchaseClosingCash + buyerInvestments;
    const rentNetWorth = renterInvestments;
    const difference = buyNetWorth - rentNetWorth;

    return {
      mortgagePayment,
      firstMonthOwnerCost,
      firstMonthMortgagePayment,
      firstMonthPropertyTax,
      firstMonthMaintenance,
      firstMonthInsurance,
      downPaymentCash,
      purchaseClosingCash,
      upfrontBuyerCash,
      futureHomeValue,
      remainingMortgage,
      homeEquityAfterSelling,
      renterInvestments,
      buyerInvestments,
      buyNetWorth,
      rentNetWorth,
      difference,
      horizonYears: horizonMonths / 12,
    };
  }, [inputs]);

  const winnerLabel =
    projection.difference > 500
      ? "Buying is ahead"
      : projection.difference < -500
        ? "Renting is ahead"
        : "The estimates are close";
  const advantageLabel =
    Math.abs(projection.difference) <= 500
      ? "Estimated difference"
      : projection.difference > 0
        ? "Estimated buy advantage"
        : "Estimated rent advantage";
  const ComparisonIcon =
    projection.difference > 500
      ? House
      : projection.difference < -500
        ? KeyRound
        : Scale;
  const outcomeTone =
    projection.difference > 500
      ? "buy"
      : projection.difference < -500
        ? "rent"
        : "close";
  const outcomeBadgeClass =
    outcomeTone === "buy"
      ? "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
      : outcomeTone === "rent"
        ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
        : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-50 via-background to-emerald-50 p-5 shadow-sm dark:from-sky-950/30 dark:via-background dark:to-emerald-950/20 sm:p-7">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-sky-200/20 blur-3xl dark:bg-sky-500/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-sky-900/15">
              <House className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Home planning
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight" data-testid="text-rent-vs-buy-title">
                Rent vs. Buy Calculator
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Compare the long-term financial impact of buying a home or renting.
              </p>
            </div>
          </div>
          <div className="rounded-xl border bg-background/70 px-4 py-3 text-sm shadow-sm backdrop-blur">
            <p className="text-xs text-muted-foreground">Comparison period</p>
            <p className="mt-0.5 text-lg font-semibold">{projection.horizonYears} years</p>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_16rem] md:items-center sm:p-6">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <Label id="comparison-period-label" className="text-base font-semibold">
                  Comparison period
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  How long do you expect to stay in this home?
                </p>
              </div>
              <span
                className="rounded-lg bg-primary/10 px-3 py-1.5 text-lg font-bold tabular-nums text-primary"
                id="comparison-period-value"
                data-testid="text-comparison-period"
              >
                {inputs.yearsToCompare} years
              </span>
            </div>
            <Slider
              value={[inputs.yearsToCompare]}
              onValueChange={([value]) => update("yearsToCompare", value)}
              min={1}
              max={50}
              step={1}
              aria-labelledby="comparison-period-label comparison-period-value"
              data-testid="slider-comparison-period"
              className="py-1"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 year</span>
              <span>50 years</span>
            </div>
          </div>
          <div className="space-y-2 md:border-l md:pl-6">
            <NumericField
              id="investment-return"
              label="Annual investment return"
              value={inputs.investmentReturnPct}
              suffix="%"
              min={-10}
              max={30}
              step={0.1}
              onChange={(value) => update("investmentReturnPct", value)}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Applied to the down payment and monthly cost difference in each scenario.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden border-sky-200/80 shadow-sm dark:border-sky-900/70">
          <CardHeader className="border-b border-sky-200/70 bg-sky-50/80 px-5 py-4 dark:border-sky-900/60 dark:bg-sky-950/30 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/70 dark:text-sky-200">
                <House className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base">Buy a home</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Purchase, mortgage, and ownership costs
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                Purchase &amp; financing
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumericField
                  id="home-price"
                  label="Home price ($)"
                  value={inputs.homePrice}
                  max={10000000}
                  step={5000}
                  onChange={(value) => update("homePrice", value)}
                />
                <NumericField
                  id="down-payment"
                  label="Down payment"
                  value={inputs.downPaymentPct}
                  suffix="%"
                  max={100}
                  step={1}
                  onChange={(value) => update("downPaymentPct", value)}
                />
                <NumericField
                  id="mortgage-rate"
                  label="Mortgage interest rate"
                  value={inputs.mortgageRatePct}
                  suffix="%"
                  max={25}
                  step={0.1}
                  onChange={(value) => update("mortgageRatePct", value)}
                />
                <NumericField
                  id="mortgage-term"
                  label="Mortgage term"
                  value={inputs.mortgageTermYears}
                  suffix="years"
                  min={1}
                  max={50}
                  step={1}
                  onChange={(value) => update("mortgageTermYears", value)}
                />
              </div>
            </div>

            <div className="border-t border-border/70 pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                Ownership costs &amp; home value
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumericField
                  id="property-tax"
                  label="Property tax rate"
                  value={inputs.propertyTaxPct}
                  suffix="%"
                  max={10}
                  step={0.1}
                  onChange={(value) => update("propertyTaxPct", value)}
                />
                <NumericField
                  id="home-insurance"
                  label="Home insurance per year ($)"
                  value={inputs.annualHomeInsurance}
                  max={100000}
                  step={100}
                  onChange={(value) => update("annualHomeInsurance", value)}
                />
                <NumericField
                  id="maintenance-rate"
                  label="Maintenance allowance"
                  value={inputs.annualMaintenancePct}
                  suffix="% / yr"
                  max={10}
                  step={0.1}
                  onChange={(value) => update("annualMaintenancePct", value)}
                />
                <NumericField
                  id="home-appreciation"
                  label="Home appreciation"
                  value={inputs.homeAppreciationPct}
                  suffix="% / yr"
                  min={-10}
                  max={20}
                  step={0.1}
                  onChange={(value) => update("homeAppreciationPct", value)}
                />
                <NumericField
                  id="closing-cost"
                  label="Buyer closing costs"
                  value={inputs.purchaseClosingCostPct}
                  suffix="%"
                  max={15}
                  step={0.1}
                  onChange={(value) => update("purchaseClosingCostPct", value)}
                />
                <NumericField
                  id="selling-cost"
                  label="Selling costs"
                  value={inputs.sellingCostPct}
                  suffix="%"
                  max={15}
                  step={0.1}
                  onChange={(value) => update("sellingCostPct", value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-emerald-200/80 shadow-sm dark:border-emerald-900/70">
          <CardHeader className="border-b border-emerald-200/70 bg-emerald-50/80 px-5 py-4 dark:border-emerald-900/60 dark:bg-emerald-950/30 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base">Rent a home</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Starting rent and expected increases
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumericField
                id="monthly-rent"
                label="Monthly rent ($)"
                value={inputs.monthlyRent}
                max={100000}
                step={50}
                onChange={(value) => update("monthlyRent", value)}
              />
              <NumericField
                id="rent-increase"
                label="Annual rent increase"
                value={inputs.annualRentIncreasePct}
                suffix="%"
                min={-10}
                max={20}
                step={0.1}
                onChange={(value) => update("annualRentIncreasePct", value)}
              />
            </div>

            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/20">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                How the rent scenario is modeled
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-emerald-900/75 dark:text-emerald-100/70">
                The renter invests the cash that would go toward a down payment and closing costs.
                Monthly housing-cost savings are added to the scenario’s investment balance.
              </p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-emerald-200/70 pt-3 text-sm dark:border-emerald-900/70">
                <span className="text-muted-foreground">Starting cash to invest</span>
                <span className="font-semibold tabular-nums" data-testid="text-renter-initial-investment">
                  {formatCurrency(projection.upfrontBuyerCash)}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-dashed border-emerald-300/80 p-4 dark:border-emerald-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                The investment return and comparison period above apply to both scenarios, so you can compare
                them using the same assumptions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section aria-label="Rent versus buy results" className="space-y-4">
        <Card className={`overflow-hidden shadow-sm ${
          outcomeTone === "buy"
            ? "border-sky-200 dark:border-sky-900"
            : outcomeTone === "rent"
              ? "border-emerald-200 dark:border-emerald-900"
              : "border-border"
        }`}>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                outcomeTone === "buy"
                  ? "bg-sky-100 text-sky-700 dark:bg-sky-900/70 dark:text-sky-200"
                  : outcomeTone === "rent"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200"
                    : "bg-muted text-muted-foreground"
              }`}>
                <ComparisonIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <Badge className={outcomeBadgeClass}>{winnerLabel}</Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  Estimated difference after {projection.horizonYears} years
                </p>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {advantageLabel}
              </p>
              <p className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums" data-testid="text-rent-buy-difference">
                {formatCurrency(Math.abs(projection.difference))}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-sky-200/80 shadow-sm dark:border-sky-900/70">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/70 dark:text-sky-200">
                    <House className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base">Buy scenario</CardTitle>
                </div>
                <Badge variant="outline" className="border-sky-200 text-sky-700 dark:border-sky-800 dark:text-sky-300">
                  Home equity + savings
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-sky-50/80 p-4 dark:bg-sky-950/30">
                <p className="text-sm text-muted-foreground">
                  Estimated position after {projection.horizonYears} years
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-sky-800 dark:text-sky-200" data-testid="text-buy-net-worth">
                  {formatCurrency(projection.buyNetWorth)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Starting monthly cost</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(projection.firstMonthOwnerCost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Equity after sale costs</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(projection.homeEquityAfterSelling)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Projected home value</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(projection.futureHomeValue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mortgage remaining</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(projection.remainingMortgage)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200/80 shadow-sm dark:border-emerald-900/70">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200">
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base">Rent scenario</CardTitle>
                </div>
                <Badge variant="outline" className="border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                  Invested cash + savings
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-emerald-50/80 p-4 dark:bg-emerald-950/30">
                <p className="text-sm text-muted-foreground">
                  Estimated position after {projection.horizonYears} years
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-emerald-800 dark:text-emerald-200" data-testid="text-rent-net-worth">
                  {formatCurrency(projection.rentNetWorth)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Starting monthly rent</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(inputs.monthlyRent)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cash invested up front</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(projection.upfrontBuyerCash)}</p>
                </div>
                <div className="col-span-2 border-t pt-3">
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                    Monthly savings versus the buy scenario are invested at the comparison return above.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="overflow-hidden shadow-sm">
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Calculator className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold">How are these estimates calculated?</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  A live breakdown using your selected assumptions
                </p>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>

          <div className="border-t bg-muted/20 p-4 sm:p-6">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-sky-200/80 bg-background p-4 dark:border-sky-900/70">
                <div>
                  <h4 className="font-semibold text-sky-800 dark:text-sky-200">Buy scenario</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    First, estimate the monthly cost of owning:
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Mortgage payment (principal + interest)</span>
                    <span className="font-medium tabular-nums">{formatCurrency(projection.firstMonthMortgagePayment)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Property tax</span>
                    <span className="font-medium tabular-nums">{formatCurrency(projection.firstMonthPropertyTax)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Maintenance allowance</span>
                    <span className="font-medium tabular-nums">{formatCurrency(projection.firstMonthMaintenance)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Home insurance</span>
                    <span className="font-medium tabular-nums">{formatCurrency(projection.firstMonthInsurance)}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-t pt-2 font-semibold">
                    <span>Starting monthly owner cost</span>
                    <span className="tabular-nums">{formatCurrency(projection.firstMonthOwnerCost)}</span>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4 text-sm">
                  <p className="font-medium">Then estimate the position if you sell:</p>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Home value after {projection.horizonYears} years</span>
                    <span className="font-medium tabular-nums">{formatCurrency(projection.futureHomeValue)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Selling costs ({inputs.sellingCostPct}%)</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(-(projection.futureHomeValue * inputs.sellingCostPct / 100))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Remaining mortgage</span>
                    <span className="font-medium tabular-nums">{formatCurrency(-projection.remainingMortgage)}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-t pt-2 font-medium">
                    <span>Equity after selling costs</span>
                    <span className="tabular-nums">{formatCurrency(projection.homeEquityAfterSelling)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Buyer closing costs</span>
                    <span className="font-medium tabular-nums">{formatCurrency(-projection.purchaseClosingCash)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Investment balance from monthly cost differences</span>
                    <span className="font-medium tabular-nums">{formatCurrency(projection.buyerInvestments)}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-t pt-2 font-semibold text-sky-800 dark:text-sky-200">
                    <span>Estimated buy position</span>
                    <span className="tabular-nums">{formatCurrency(projection.buyNetWorth)}</span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  The down payment is reflected in the lower mortgage balance and resulting home equity; it is not
                  subtracted a second time.
                </p>
              </div>

              <div className="space-y-4 rounded-xl border border-emerald-200/80 bg-background p-4 dark:border-emerald-900/70">
                <div>
                  <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">Rent scenario</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The renter invests the money that would otherwise go toward buying:
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Down payment invested</span>
                    <span className="font-medium tabular-nums">{formatCurrency(projection.downPaymentCash)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Buyer closing costs invested</span>
                    <span className="font-medium tabular-nums">{formatCurrency(projection.purchaseClosingCash)}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-t pt-2 font-semibold">
                    <span>Starting investment balance</span>
                    <span className="tabular-nums">{formatCurrency(projection.upfrontBuyerCash)}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-emerald-50/70 p-3 text-sm leading-relaxed text-emerald-950/80 dark:bg-emerald-950/30 dark:text-emerald-100/80">
                  Each month, the balance grows at the monthly equivalent of the{" "}
                  {inputs.investmentReturnPct}% annual return, then adds the owner’s housing cost minus that month’s
                  rent. Rent and home-related costs rise according to their annual increase assumptions.
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">First-month owner cost minus rent</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(projection.firstMonthOwnerCost - inputs.monthlyRent)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    A positive amount is added to the renter’s investments; if renting costs more, the amount is
                    withdrawn instead. The buy scenario tracks the opposite monthly difference.
                  </p>
                  <div className="flex justify-between gap-3 border-t pt-3 font-semibold text-emerald-800 dark:text-emerald-200">
                    <span>Estimated rent-side investment balance</span>
                    <span className="tabular-nums">{formatCurrency(projection.rentNetWorth)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1 rounded-xl border bg-background px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                Difference between the two estimated positions after {projection.horizonYears} years
              </span>
              <span className="font-semibold tabular-nums">
                {winnerLabel}: {formatCurrency(Math.abs(projection.difference))}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              The projection compounds investments monthly and uses unrounded amounts internally; displayed dollars
              are rounded. It excludes taxes, HOA fees, renter insurance, and costs beyond the maintenance allowance.
            </p>
          </div>
        </details>
      </Card>

      <p className="flex gap-2 rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Estimates exclude taxes, HOA fees, renter insurance, and costs beyond the maintenance allowance.
        Property tax and maintenance rise with the home value; insurance stays flat. A negative investment
        balance represents housing costs paid from savings outside this comparison.
      </p>
    </div>
  );
}