import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, House, Info, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          className={suffix ? "pr-14" : undefined}
          data-testid={`input-${id}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
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

      if (month === 0) firstMonthOwnerCost = ownerHousingCost;

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
  const comparisonIcon =
    projection.difference > 500
      ? ArrowUpRight
      : projection.difference < -500
        ? ArrowDownRight
        : House;
  const ComparisonIcon = comparisonIcon;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold" data-testid="text-rent-vs-buy-title">
          Rent vs. Buy Calculator
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare estimated housing costs and net worth over your chosen time period.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Home, rent &amp; mortgage</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumericField
                id="home-price"
                label="Home price ($)"
                value={inputs.homePrice}
                max={10000000}
                step={5000}
                onChange={(value) => update("homePrice", value)}
              />
              <NumericField
                id="monthly-rent"
                label="Monthly rent ($)"
                value={inputs.monthlyRent}
                max={100000}
                step={50}
                onChange={(value) => update("monthlyRent", value)}
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
              <NumericField
                id="comparison-period"
                label="Years in the home"
                value={inputs.yearsToCompare}
                suffix="years"
                min={1}
                max={50}
                step={1}
                onChange={(value) => update("yearsToCompare", value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ongoing costs &amp; assumptions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
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
                id="rent-increase"
                label="Annual rent increase"
                value={inputs.annualRentIncreasePct}
                suffix="%"
                min={-10}
                max={20}
                step={0.1}
                onChange={(value) => update("annualRentIncreasePct", value)}
              />
              <NumericField
                id="investment-return"
                label="Investment return"
                value={inputs.investmentReturnPct}
                suffix="% / yr"
                min={-10}
                max={30}
                step={0.1}
                onChange={(value) => update("investmentReturnPct", value)}
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
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="border-primary/20">
            <CardHeader className="space-y-3">
              <Badge variant="secondary" className="w-fit gap-1.5">
                <ComparisonIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {winnerLabel}
              </Badge>
              <CardTitle className="text-base">
                Estimated position after {projection.horizonYears} years
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">Buy scenario</p>
                  <p className="mt-1 text-lg font-semibold" data-testid="text-buy-net-worth">
                    {formatCurrency(projection.buyNetWorth)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">Rent scenario</p>
                  <p className="mt-1 text-lg font-semibold" data-testid="text-rent-net-worth">
                    {formatCurrency(projection.rentNetWorth)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
                <span className="text-muted-foreground">{advantageLabel}</span>
                <span className="font-semibold" data-testid="text-rent-buy-difference">
                  {formatCurrency(Math.abs(projection.difference))}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly housing cost (starting estimate)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Buy: mortgage, tax, insurance &amp; maintenance</span>
                <span className="font-medium">{formatCurrency(projection.firstMonthOwnerCost)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Rent</span>
                <span className="font-medium">{formatCurrency(inputs.monthlyRent)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t pt-3">
                <span className="text-muted-foreground">Mortgage payment (principal &amp; interest)</span>
                <span className="font-medium">{formatCurrency(projection.mortgagePayment)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buy scenario at sale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Projected home value</span>
                <span className="font-medium">{formatCurrency(projection.futureHomeValue)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Mortgage balance</span>
                <span className="font-medium">{formatCurrency(projection.remainingMortgage)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t pt-3">
                <span className="text-muted-foreground">Equity after selling costs</span>
                <span className="font-semibold">{formatCurrency(projection.homeEquityAfterSelling)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Up-front cash invested by renter</span>
                <span className="font-medium">{formatCurrency(projection.upfrontBuyerCash)}</span>
              </div>
            </CardContent>
          </Card>

          <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Estimates exclude taxes, HOA fees, renter insurance, and costs beyond the maintenance allowance.
            Property tax and maintenance rise with the home value; insurance stays flat. A negative investment
            balance represents housing costs paid from savings outside this comparison.
          </p>
        </aside>
      </div>
    </div>
  );
}