import { useMemo, useState } from "react";
import { Calculator, CircleDollarSign, House, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";

type HomeAffordabilityInputs = {
  annualIncome: number;
  monthlyDebts: number;
  availableCash: number;
  housingDtiPct: number;
  totalDtiPct: number;
  downPaymentPct: number;
  mortgageRatePct: number;
  mortgageTermYears: number;
  propertyTaxPct: number;
  annualInsurance: number;
  monthlyHoa: number;
  closingCostPct: number;
};

type NumberFieldProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
};

const INITIAL_INPUTS: HomeAffordabilityInputs = {
  annualIncome: 150000,
  monthlyDebts: 600,
  availableCash: 90000,
  housingDtiPct: 28,
  totalDtiPct: 36,
  downPaymentPct: 20,
  mortgageRatePct: 6.5,
  mortgageTermYears: 30,
  propertyTaxPct: 1.1,
  annualInsurance: 1800,
  monthlyHoa: 0,
  closingCostPct: 3,
};

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <FormattedNumberInput
          id={id}
          value={value}
          min={min}
          max={max}
          step={step}
          onValueChange={onChange}
          className={`h-11 rounded-lg bg-background/80 ${suffix ? "pr-20" : ""}`}
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

function ResultLine({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 text-sm ${emphasis ? "border-t pt-3 font-semibold" : ""}`}>
      <span className={emphasis ? "" : "text-muted-foreground"}>{label}</span>
      <span className="shrink-0 text-right tabular-nums">{value}</span>
    </div>
  );
}

export default function HomeAffordabilityCalculator() {
  const [inputs, setInputs] = useState(INITIAL_INPUTS);
  const update = <K extends keyof HomeAffordabilityInputs>(key: K, value: number) =>
    setInputs((current) => ({ ...current, [key]: value }));

  const estimate = useMemo(() => {
    const monthlyIncome = inputs.annualIncome / 12;
    const frontEndLimit = monthlyIncome * inputs.housingDtiPct / 100;
    const backEndLimit = Math.max(0, monthlyIncome * inputs.totalDtiPct / 100 - inputs.monthlyDebts);
    const monthlyHousingBudget = Math.max(0, Math.min(frontEndLimit, backEndLimit));

    const termMonths = Math.max(1, Math.round(inputs.mortgageTermYears * 12));
    const monthlyRate = inputs.mortgageRatePct / 1200;
    const mortgagePaymentPerDollar = monthlyRate === 0
      ? 1 / termMonths
      : monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths));
    const downPaymentFraction = inputs.downPaymentPct / 100;
    const closingCostFraction = inputs.closingCostPct / 100;
    const propertyTaxPerDollar = inputs.propertyTaxPct / 1200;
    const monthlyCostPerDollarOfPrice =
      (1 - downPaymentFraction) * mortgagePaymentPerDollar + propertyTaxPerDollar;
    const fixedMonthlyCosts = inputs.annualInsurance / 12 + inputs.monthlyHoa;
    const monthlyBudgetForPriceBasedCosts = monthlyHousingBudget - fixedMonthlyCosts;
    const priceLimitFromMonthlyBudget = monthlyCostPerDollarOfPrice > 0
      ? Math.max(0, monthlyBudgetForPriceBasedCosts / monthlyCostPerDollarOfPrice)
      : Number.POSITIVE_INFINITY;

    const cashNeededPerDollarOfPrice = downPaymentFraction + closingCostFraction;
    const priceLimitFromAvailableCash = cashNeededPerDollarOfPrice > 0
      ? inputs.availableCash / cashNeededPerDollarOfPrice
      : Number.POSITIVE_INFINITY;
    const maxHomePrice = Math.max(
      0,
      Math.min(priceLimitFromMonthlyBudget, priceLimitFromAvailableCash),
    );

    const downPayment = maxHomePrice * downPaymentFraction;
    const closingCosts = maxHomePrice * closingCostFraction;
    const loanAmount = maxHomePrice - downPayment;
    const mortgagePayment = loanAmount * mortgagePaymentPerDollar;
    const propertyTax = maxHomePrice * propertyTaxPerDollar;
    const monthlyInsurance = inputs.annualInsurance / 12;
    const monthlyHousingCost = mortgagePayment + propertyTax + monthlyInsurance + inputs.monthlyHoa;
    const housingDti = monthlyIncome > 0 ? monthlyHousingCost / monthlyIncome * 100 : 0;
    const totalDti = monthlyIncome > 0
      ? (monthlyHousingCost + inputs.monthlyDebts) / monthlyIncome * 100
      : 0;
    const cashRemaining = inputs.availableCash - downPayment - closingCosts;

    const limitingFactor = Math.abs(priceLimitFromMonthlyBudget - priceLimitFromAvailableCash) <=
      Math.max(1000, maxHomePrice * 0.01)
      ? "both"
      : priceLimitFromMonthlyBudget < priceLimitFromAvailableCash
        ? "monthly-budget"
        : "available-cash";

    return {
      monthlyIncome,
      frontEndLimit,
      backEndLimit,
      monthlyHousingBudget,
      fixedMonthlyCosts,
      maxHomePrice,
      priceLimitFromMonthlyBudget,
      priceLimitFromAvailableCash,
      downPayment,
      closingCosts,
      loanAmount,
      mortgagePayment,
      propertyTax,
      monthlyInsurance,
      monthlyHousingCost,
      housingDti,
      totalDti,
      cashRemaining,
      limitingFactor,
      monthlyBudgetForPriceBasedCosts,
    };
  }, [inputs]);

  const limitLabel = estimate.limitingFactor === "monthly-budget"
    ? "Monthly budget is the tighter limit"
    : estimate.limitingFactor === "available-cash"
      ? "Available cash is the tighter limit"
      : "Monthly budget and cash are both limiting";
  const noMonthlyRoom = estimate.monthlyHousingBudget < estimate.fixedMonthlyCosts;

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-50 via-background to-indigo-50 p-5 shadow-sm dark:from-sky-950/30 dark:via-background dark:to-indigo-950/20 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-sky-900/15">
              <House className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Home planning</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight" data-testid="text-home-affordability-title">
                Home Affordability Calculator
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Estimate a purchase-price range that fits your monthly budget and cash available.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-background/70 px-3 py-1.5 text-xs">
            Planning estimate
          </Badge>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b bg-muted/20 px-5 py-4 sm:px-6">
              <CardTitle className="text-base">Income &amp; monthly budget</CardTitle>
              <p className="text-sm text-muted-foreground">
                Debt-to-income limits estimate how much can go toward housing.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <NumberField
                id="home-affordability-income"
                label="Gross household income per year ($)"
                value={inputs.annualIncome}
                min={0}
                max={10000000}
                step={1000}
                onChange={(value) => update("annualIncome", value)}
              />
              <NumberField
                id="home-affordability-debts"
                label="Monthly debt payments ($)"
                value={inputs.monthlyDebts}
                min={0}
                max={100000}
                step={50}
                onChange={(value) => update("monthlyDebts", value)}
              />
              <NumberField
                id="home-affordability-housing-dti"
                label="Housing share of gross income"
                value={inputs.housingDtiPct}
                suffix="%"
                min={0}
                max={70}
                step={0.5}
                onChange={(value) => update("housingDtiPct", value)}
              />
              <NumberField
                id="home-affordability-total-dti"
                label="Maximum total debt-to-income"
                value={inputs.totalDtiPct}
                suffix="%"
                min={0}
                max={70}
                step={0.5}
                onChange={(value) => update("totalDtiPct", value)}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b bg-muted/20 px-5 py-4 sm:px-6">
              <CardTitle className="text-base">Cash, loan &amp; home costs</CardTitle>
              <p className="text-sm text-muted-foreground">
                Include upfront funds and recurring expenses beyond the mortgage.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <NumberField
                id="home-affordability-cash"
                label="Cash available for down payment & closing ($)"
                value={inputs.availableCash}
                min={0}
                max={10000000}
                step={1000}
                onChange={(value) => update("availableCash", value)}
              />
              <NumberField
                id="home-affordability-down-payment"
                label="Down payment"
                value={inputs.downPaymentPct}
                suffix="%"
                min={0}
                max={100}
                step={1}
                onChange={(value) => update("downPaymentPct", value)}
              />
              <NumberField
                id="home-affordability-rate"
                label="Mortgage interest rate"
                value={inputs.mortgageRatePct}
                suffix="%"
                min={0}
                max={25}
                step={0.1}
                onChange={(value) => update("mortgageRatePct", value)}
              />
              <NumberField
                id="home-affordability-term"
                label="Mortgage term"
                value={inputs.mortgageTermYears}
                suffix="years"
                min={1}
                max={50}
                step={1}
                onChange={(value) => update("mortgageTermYears", value)}
              />
              <NumberField
                id="home-affordability-tax"
                label="Property tax rate"
                value={inputs.propertyTaxPct}
                suffix="%"
                min={0}
                max={10}
                step={0.1}
                onChange={(value) => update("propertyTaxPct", value)}
              />
              <NumberField
                id="home-affordability-insurance"
                label="Home insurance per year ($)"
                value={inputs.annualInsurance}
                min={0}
                max={100000}
                step={100}
                onChange={(value) => update("annualInsurance", value)}
              />
              <NumberField
                id="home-affordability-hoa"
                label="Monthly HOA fees ($)"
                value={inputs.monthlyHoa}
                min={0}
                max={100000}
                step={25}
                onChange={(value) => update("monthlyHoa", value)}
              />
              <NumberField
                id="home-affordability-closing-cost"
                label="Buyer closing costs"
                value={inputs.closingCostPct}
                suffix="%"
                min={0}
                max={20}
                step={0.1}
                onChange={(value) => update("closingCostPct", value)}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="overflow-hidden border-sky-200/80 shadow-sm dark:border-sky-900/70">
            <CardHeader className="border-b border-sky-200/70 bg-sky-50/80 px-5 py-4 dark:border-sky-900/60 dark:bg-sky-950/30 sm:px-6">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden="true" />
                <CardTitle className="text-base">Estimated maximum home price</CardTitle>
              </div>
              <Badge variant="outline" className="mt-2 w-fit border-sky-200 bg-background/70 text-sky-800 dark:border-sky-800 dark:text-sky-200">
                {limitLabel}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="rounded-xl bg-sky-50/80 p-4 dark:bg-sky-950/30">
                <p className="text-sm text-muted-foreground">Estimated purchase price</p>
                <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-sky-800 dark:text-sky-200" data-testid="text-home-affordability-max-price">
                  {formatCurrency(estimate.maxHomePrice)}
                </p>
              </div>

              {noMonthlyRoom && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  Monthly insurance and HOA costs already exceed the estimated housing budget. Adjust the budget or costs to see an affordable price.
                </p>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span>Cash needed at closing</span>
                </div>
                <div className="space-y-2">
                  <ResultLine label="Down payment" value={formatCurrency(estimate.downPayment)} />
                  <ResultLine label="Estimated buyer closing costs" value={formatCurrency(estimate.closingCosts)} />
                  <ResultLine label="Total cash used" value={formatCurrency(estimate.downPayment + estimate.closingCosts)} emphasis />
                  <ResultLine label="Cash remaining" value={formatCurrency(estimate.cashRemaining)} />
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Calculator className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span>Estimated monthly housing cost</span>
                </div>
                <div className="space-y-2">
                  <ResultLine label="Mortgage (principal & interest)" value={formatCurrency(estimate.mortgagePayment)} />
                  <ResultLine label="Property tax" value={formatCurrency(estimate.propertyTax)} />
                  <ResultLine label="Home insurance" value={formatCurrency(estimate.monthlyInsurance)} />
                  <ResultLine label="HOA fees" value={formatCurrency(inputs.monthlyHoa)} />
                  <ResultLine label="Total monthly housing cost" value={formatCurrency(estimate.monthlyHousingCost)} emphasis />
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Housing DTI</p>
                    <p className="mt-0.5 font-semibold tabular-nums">{estimate.housingDti.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total DTI with debts</p>
                    <p className="mt-0.5 font-semibold tabular-nums">{estimate.totalDti.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">How the estimate is limited</p>
              <p>
                The monthly housing budget is the lower of {inputs.housingDtiPct}% of gross monthly income, or{" "}
                {inputs.totalDtiPct}% less existing monthly debt payments. The estimated price is then capped by
                whichever is lower: that monthly budget or the cash available for the down payment and closing costs.
              </p>
              <p>
                This is a planning estimate, not a loan approval. Lenders may use different debt limits, rates, fees,
                credit requirements, and property costs.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}