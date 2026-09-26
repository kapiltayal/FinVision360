import { useMemo, useState } from "react";
import { Calculator, CircleDollarSign, House, Wallet } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";

type MortgageInputs = {
  homePrice: number;
  downPaymentPct: number;
  interestRatePct: number;
  termYears: number;
  extraMonthlyPrincipal: number;
  propertyTaxPct: number;
  annualInsurance: number;
  monthlyHoa: number;
};

type YearlyAmortization = {
  year: number;
  months: number;
  principalPaid: number;
  interestPaid: number;
  endingBalance: number;
};

type BalancePoint = {
  month: number;
  year: number;
  remainingBalance: number;
};

const INITIAL_INPUTS: MortgageInputs = {
  homePrice: 425000,
  downPaymentPct: 20,
  interestRatePct: 6.5,
  termYears: 30,
  extraMonthlyPrincipal: 0,
  propertyTaxPct: 1.1,
  annualInsurance: 1800,
  monthlyHoa: 0,
};

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatRangeValue(value: number, suffix?: string): string {
  if (suffix === "years") {
    return `${value} ${value === 1 ? "year" : "years"}`;
  }
  return `${value.toLocaleString("en-US")}${suffix ?? ""}`;
}

function formatDuration(months: number): string {
  if (months <= 0) return "No mortgage balance";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts = [
    years > 0 ? `${years} ${years === 1 ? "year" : "years"}` : "",
    remainingMonths > 0
      ? `${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`
      : "",
  ].filter(Boolean);
  return parts.join(" ");
}

function AmountField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <FormattedNumberInput
        id={id}
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={onChange}
        className="h-11 rounded-lg bg-background/80"
        data-testid={`input-${id}`}
      />
    </div>
  );
}

function RangeField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label id={`${id}-label`}>{label}</Label>
        <span
          className="shrink-0 rounded-md bg-muted px-2 py-1 text-sm font-semibold tabular-nums"
          data-testid={`value-${id}`}
        >
          {formatRangeValue(value, suffix)}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([nextValue]) => {
          if (nextValue !== undefined) onChange(nextValue);
        }}
        min={min}
        max={max}
        step={step}
        thumbLabels={[label]}
        aria-labelledby={`${id}-label`}
        className="py-1"
        data-testid={`slider-${id}`}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatRangeValue(min, suffix)}</span>
        <span>{formatRangeValue(max, suffix)}</span>
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

export default function HomeMortgageCalculator() {
  const [inputs, setInputs] = useState(INITIAL_INPUTS);
  const update = <K extends keyof MortgageInputs>(key: K, value: number) =>
    setInputs((current) => ({ ...current, [key]: value }));

  const estimate = useMemo(() => {
    const downPayment = inputs.homePrice * inputs.downPaymentPct / 100;
    const loanAmount = Math.max(0, inputs.homePrice - downPayment);
    const scheduledMonths = Math.max(1, Math.round(inputs.termYears * 12));
    const monthlyRate = inputs.interestRatePct / 1200;
    const scheduledMonthlyPrincipalAndInterest = loanAmount <= 0
      ? 0
      : monthlyRate === 0
        ? loanAmount / scheduledMonths
        : loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -scheduledMonths));
    const monthlyPropertyTax = inputs.homePrice * inputs.propertyTaxPct / 1200;
    const monthlyInsurance = inputs.annualInsurance / 12;

    const yearlyAmortization: YearlyAmortization[] = [];
    const balanceChartData: BalancePoint[] = [
      { month: 0, year: 0, remainingBalance: loanAmount },
    ];
    let remainingBalance = loanAmount;
    let totalInterestPaid = 0;
    let totalLoanPayments = 0;
    let payoffMonths = 0;
    let yearPrincipalPaid = 0;
    let yearInterestPaid = 0;

    for (let month = 1; month <= scheduledMonths && remainingBalance > 0.005; month += 1) {
      const interestPaid = remainingBalance * monthlyRate;
      const payment = Math.min(
        remainingBalance + interestPaid,
        scheduledMonthlyPrincipalAndInterest + inputs.extraMonthlyPrincipal,
      );
      const principalPaid = Math.max(0, payment - interestPaid);
      remainingBalance = Math.max(0, remainingBalance - principalPaid);
      if (remainingBalance < 0.005) remainingBalance = 0;

      totalInterestPaid += interestPaid;
      totalLoanPayments += payment;
      yearPrincipalPaid += principalPaid;
      yearInterestPaid += interestPaid;
      payoffMonths = month;

      if (month % 12 === 0 || remainingBalance === 0) {
        const year = Math.ceil(month / 12);
        yearlyAmortization.push({
          year,
          months: month - (year - 1) * 12,
          principalPaid: yearPrincipalPaid,
          interestPaid: yearInterestPaid,
          endingBalance: remainingBalance,
        });
        balanceChartData.push({
          month,
          year: month / 12,
          remainingBalance,
        });
        yearPrincipalPaid = 0;
        yearInterestPaid = 0;
      }
    }

    const firstMonthLoanPayment = loanAmount <= 0
      ? 0
      : Math.min(
        loanAmount + loanAmount * monthlyRate,
        scheduledMonthlyPrincipalAndInterest + inputs.extraMonthlyPrincipal,
      );
    const monthlyHousingCosts = scheduledMonthlyPrincipalAndInterest +
      monthlyPropertyTax +
      monthlyInsurance +
      inputs.monthlyHoa;
    const firstMonthOutflow = firstMonthLoanPayment +
      monthlyPropertyTax +
      monthlyInsurance +
      inputs.monthlyHoa;

    return {
      downPayment,
      loanAmount,
      scheduledMonths,
      scheduledMonthlyPrincipalAndInterest,
      monthlyPropertyTax,
      monthlyInsurance,
      monthlyHousingCosts,
      firstMonthOutflow,
      totalInterestPaid,
      totalLoanPayments,
      payoffMonths,
      monthsSaved: Math.max(0, scheduledMonths - payoffMonths),
      yearlyAmortization,
      balanceChartData,
    };
  }, [inputs]);

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-50 via-background to-indigo-50 p-5 shadow-sm dark:from-sky-950/30 dark:via-background dark:to-indigo-950/20 sm:p-7">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-sky-900/15">
            <House className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Home planning</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight" data-testid="text-home-mortgage-title">
              Home Mortgage &amp; Amortization Calculator
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Estimate monthly housing costs, total interest, and how extra principal payments change your payoff timeline.
            </p>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)]">
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b bg-muted/20 px-5 py-4 sm:px-6">
            <CardTitle className="text-base">Mortgage details</CardTitle>
            <p className="text-sm text-muted-foreground">
              Change the loan assumptions to update the payment and amortization.
            </p>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <AmountField
              id="home-mortgage-price"
              label="Home purchase price ($)"
              value={inputs.homePrice}
              min={0}
              max={10000000}
              step={1000}
              onChange={(value) => update("homePrice", value)}
            />
            <RangeField
              id="home-mortgage-down-payment"
              label="Down payment"
              value={inputs.downPaymentPct}
              min={0}
              max={100}
              step={1}
              suffix="%"
              onChange={(value) => update("downPaymentPct", value)}
            />
            <RangeField
              id="home-mortgage-interest-rate"
              label="Mortgage interest rate"
              value={inputs.interestRatePct}
              min={0}
              max={20}
              step={0.1}
              suffix="%"
              onChange={(value) => update("interestRatePct", value)}
            />
            <RangeField
              id="home-mortgage-term"
              label="Loan term"
              value={inputs.termYears}
              min={1}
              max={50}
              step={1}
              suffix="years"
              onChange={(value) => update("termYears", value)}
            />
            <AmountField
              id="home-mortgage-extra-payment"
              label="Extra principal per month ($)"
              value={inputs.extraMonthlyPrincipal}
              min={0}
              max={100000}
              step={50}
              onChange={(value) => update("extraMonthlyPrincipal", value)}
            />
            <RangeField
              id="home-mortgage-property-tax"
              label="Property tax rate"
              value={inputs.propertyTaxPct}
              min={0}
              max={10}
              step={0.1}
              suffix="%"
              onChange={(value) => update("propertyTaxPct", value)}
            />
            <AmountField
              id="home-mortgage-insurance"
              label="Home insurance per year ($)"
              value={inputs.annualInsurance}
              min={0}
              max={100000}
              step={100}
              onChange={(value) => update("annualInsurance", value)}
            />
            <AmountField
              id="home-mortgage-hoa"
              label="Monthly HOA fees ($)"
              value={inputs.monthlyHoa}
              min={0}
              max={100000}
              step={25}
              onChange={(value) => update("monthlyHoa", value)}
            />
            <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
              Extra principal is modeled as a monthly payment with no prepayment penalty. Taxes, insurance, and HOA are estimates outside the loan.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <CircleDollarSign className="h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Loan amount</p>
                  <p className="truncate font-semibold tabular-nums" data-testid="text-home-mortgage-loan-amount">
                    {formatCurrency(estimate.loanAmount)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatCurrency(inputs.homePrice)} home · {formatCurrency(estimate.downPayment)} down
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <Calculator className="h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Scheduled monthly P&amp;I</p>
                  <p className="truncate font-semibold tabular-nums" data-testid="text-home-mortgage-monthly-pi">
                    {formatCurrency(estimate.scheduledMonthlyPrincipalAndInterest)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <Wallet className="h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total interest</p>
                  <p className="truncate font-semibold tabular-nums" data-testid="text-home-mortgage-total-interest">
                    {formatCurrency(estimate.totalInterestPaid)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <House className="h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Time to pay off</p>
                  <p className="truncate font-semibold tabular-nums" data-testid="text-home-mortgage-payoff-time">
                    {formatDuration(estimate.payoffMonths)}
                  </p>
                  {estimate.loanAmount > 0 &&
                    estimate.monthsSaved > 0 &&
                    inputs.extraMonthlyPrincipal > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {estimate.monthsSaved} months sooner
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b bg-muted/20 px-5 py-4 sm:px-6">
              <CardTitle className="text-base">Estimated monthly housing cost</CardTitle>
              <p className="text-sm text-muted-foreground">
                First-month estimate, including any extra principal payment.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 p-5 sm:p-6">
              <ResultLine
                label="Scheduled mortgage (principal & interest)"
                value={formatCurrency(estimate.scheduledMonthlyPrincipalAndInterest)}
              />
              <ResultLine label="Estimated property tax" value={formatCurrency(estimate.monthlyPropertyTax)} />
              <ResultLine label="Home insurance" value={formatCurrency(estimate.monthlyInsurance)} />
              <ResultLine label="HOA fees" value={formatCurrency(inputs.monthlyHoa)} />
              {estimate.loanAmount > 0 && inputs.extraMonthlyPrincipal > 0 && (
                <ResultLine
                  label="Extra principal payment"
                  value={formatCurrency(Math.max(0, estimate.firstMonthOutflow - estimate.monthlyHousingCosts))}
                />
              )}
              <ResultLine
                label="First-month total"
                value={formatCurrency(estimate.firstMonthOutflow)}
                emphasis
              />
              <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                Taxes, insurance, and HOA fees are estimates outside the mortgage loan. Actual costs and lender escrow amounts may differ.
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b bg-muted/20 px-5 py-4 sm:px-6">
              <CardTitle className="text-base">Amortization chart</CardTitle>
              <p className="text-sm text-muted-foreground">
                Remaining mortgage balance over time
              </p>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              {estimate.loanAmount > 0 ? (
                <div className="h-[320px]" data-testid="chart-home-mortgage-amortization">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={estimate.balanceChartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                      <defs>
                        <linearGradient id="mortgage-balance-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="year"
                        type="number"
                        domain={[0, "dataMax"]}
                        tickCount={6}
                        tickFormatter={(value) => `${Number(value)}y`}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        label={{
                          value: "Years into loan",
                          position: "insideBottom",
                          offset: -4,
                          fontSize: 11,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                      />
                      <YAxis
                        domain={[0, estimate.loanAmount]}
                        tickFormatter={(value) => compactCurrency.format(Number(value))}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        width={72}
                      />
                      <Tooltip
                        labelFormatter={(value) =>
                          Number(value) === 0 ? "At start" : `${Number(value).toFixed(1)} years`
                        }
                        formatter={(value) => [formatCurrency(Number(value)), "Remaining balance"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          color: "hsl(var(--popover-foreground))",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="remainingBalance"
                        name="Remaining balance"
                        stroke="hsl(var(--chart-1))"
                        fill="url(#mortgage-balance-gradient)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div
                  className="flex h-[220px] items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground"
                  data-testid="empty-home-mortgage-amortization"
                >
                  There is no mortgage balance to chart with a 100% down payment.
                </div>
              )}
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {inputs.extraMonthlyPrincipal > 0
                  ? `The scheduled mortgage payment stays the same; extra principal shortens the payoff to ${formatDuration(estimate.payoffMonths)}.`
                  : "The chart assumes the scheduled principal-and-interest payment is made each month."}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b bg-muted/20 px-5 py-4 sm:px-6">
              <CardTitle className="text-base">Yearly amortization schedule</CardTitle>
              <p className="text-sm text-muted-foreground">
                Principal and interest paid each year, with the ending balance.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {estimate.yearlyAmortization.length > 0 ? (
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full min-w-[38rem] text-sm" data-testid="table-home-mortgage-amortization">
                    <thead className="sticky top-0 bg-muted/95 text-xs text-muted-foreground backdrop-blur">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Year</th>
                        <th className="px-4 py-3 text-right font-medium">Months</th>
                        <th className="px-4 py-3 text-right font-medium">Principal paid</th>
                        <th className="px-4 py-3 text-right font-medium">Interest paid</th>
                        <th className="px-4 py-3 text-right font-medium">Ending balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimate.yearlyAmortization.map((row) => (
                        <tr key={row.year} className="border-t">
                          <td className="px-4 py-3 font-medium">Year {row.year}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.months}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.principalPaid)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.interestPaid)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.endingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-5 text-sm text-muted-foreground">
                  A schedule appears when the down payment is less than the home price.
                </p>
              )}
              <div className="flex flex-wrap justify-between gap-3 border-t bg-muted/20 px-5 py-4 text-sm">
                <span className="text-muted-foreground">Total loan payments</span>
                <span className="font-semibold tabular-nums" data-testid="text-home-mortgage-total-paid">
                  {formatCurrency(estimate.totalLoanPayments)}
                </span>
              </div>
              <p className="px-5 pb-4 text-xs leading-relaxed text-muted-foreground">
                Fixed-rate estimate. Excludes closing costs, mortgage insurance, and any lender fees.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}