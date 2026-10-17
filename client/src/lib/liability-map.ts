import type { Liability } from "@shared/schema";

export type ExposureSort = "avalanche" | "snowball" | "duration";
export interface ExposureItem {
  id: number;
  name: string;
  balance: number;
  apr: number | null;
  monthlyPayment: number | null;
  maturityDate: string | null;
  monthsRemaining: number | null;
  durationSource: "override" | "maturity" | "payment" | "unknown" | "paid";
  issue: string | null;
}

function nonNegativeNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Month-aligned projection inputs; no source account values are changed. */
export function buildExposure(
  liabilities: Liability[],
  now: Date,
  overrides: Record<number, number> = {},
): ExposureItem[] {
  return liabilities.map(liability => {
    const rawBalance = nonNegativeNumber(liability.balance);
    const item: ExposureItem = {
      id: liability.id,
      name: liability.name,
      balance: rawBalance ?? 0,
      apr: nonNegativeNumber(liability.interestRate),
      monthlyPayment: nonNegativeNumber(liability.minimumPayment),
      maturityDate: liability.maturityDate,
      monthsRemaining: null,
      durationSource: "unknown",
      issue: null,
    };
    if (rawBalance == null) {
      return { ...item, issue: "Balance is missing or invalid. Update this liability." };
    }
    if (item.balance === 0) {
      return { ...item, monthsRemaining: 0, durationSource: "paid" };
    }
    const override = overrides[liability.id];
    if (Number.isSafeInteger(override) && override > 0 && override <= 12_000) {
      return { ...item, monthsRemaining: override, durationSource: "override" };
    }
    if (liability.maturityDate) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(liability.maturityDate);
      const maturity = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : null;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // Reject normalized impossible dates as well as stale maturities.
      if (!maturity || !Number.isFinite(maturity.getTime()) ||
          maturity.getFullYear() !== Number(match![1]) ||
          maturity.getMonth() !== Number(match![2]) - 1 ||
          maturity.getDate() !== Number(match![3]) || maturity <= today) {
        return { ...item, issue: "Maturity date is invalid or has passed with a balance remaining. Enter months remaining." };
      }
      const months = (maturity.getFullYear() - now.getFullYear()) * 12 +
        maturity.getMonth() - now.getMonth() + (maturity.getDate() > now.getDate() ? 1 : 0);
      return { ...item, monthsRemaining: Math.max(1, months), durationSource: "maturity" };
    }
    if (item.apr == null || !item.monthlyPayment) {
      return { ...item, issue: "Add a maturity date or APR and monthly payment, or enter months remaining." };
    }
    const monthlyRate = item.apr / 1_200;
    if (monthlyRate * item.balance >= item.monthlyPayment) {
      return { ...item, issue: "The monthly payment does not cover interest. Enter a planned duration or update the payment." };
    }
    const months = monthlyRate === 0
      ? Math.ceil(item.balance / item.monthlyPayment)
      : Math.ceil(-Math.log1p(-monthlyRate * item.balance / item.monthlyPayment) / Math.log1p(monthlyRate));
    if (!Number.isSafeInteger(months) || months <= 0 || months > 12_000) {
      return { ...item, issue: "A reliable payoff duration could not be calculated. Enter months remaining." };
    }
    return { ...item, monthsRemaining: months, durationSource: "payment" };
  });
}

export function sortExposure(items: ExposureItem[], sort: ExposureSort): ExposureItem[] {
  return [...items].sort((a, b) => {
    let comparison: number;
    if (sort === "snowball") comparison = a.balance - b.balance;
    else if (sort === "duration") comparison = (b.monthsRemaining ?? -1) - (a.monthsRemaining ?? -1);
    else comparison = (b.apr ?? -1) - (a.apr ?? -1);
    return comparison || a.name.localeCompare(b.name) || a.id - b.id;
  });
}

/** Estimates interest from the current balance through the selected remaining term. */
export function estimateRemainingInterest(item: ExposureItem): number | null {
  if (item.balance === 0) return 0;
  if (!Number.isFinite(item.balance) || item.balance < 0 ||
      item.apr === null || !Number.isFinite(item.apr) || item.apr < 0) {
    return null;
  }
  if (item.apr === 0) return 0;
  if (item.monthsRemaining === null || !Number.isSafeInteger(item.monthsRemaining) || item.monthsRemaining <= 0) return null;

  const monthlyRate = item.apr / 1_200;
  const denominator = -Math.expm1(-item.monthsRemaining * Math.log1p(monthlyRate));
  const estimatedPayment = item.balance * monthlyRate / denominator;
  const estimatedInterest = estimatedPayment * item.monthsRemaining - item.balance;
  return Number.isFinite(estimatedInterest) ? Math.max(0, estimatedInterest) : null;
}

export function getBarHeight(balance: number, maxBalance: number): number {
  if (!Number.isFinite(balance) || !Number.isFinite(maxBalance) || maxBalance <= 0) return 5;
  return Math.max(5, Math.min(100, balance / maxBalance * 100));
}

export function getTimelineTicks(maxMonths: number, now: Date): { month: number; label: string }[] {
  const end = Math.max(1, Math.ceil(Number.isFinite(maxMonths) ? maxMonths : 1));
  const step = Math.max(1, Math.ceil(end / 6));
  const months: number[] = [0];
  // Reserve space for the final label rather than placing two labels together.
  for (let month = step; month < end; month += step) {
    if (end - month >= step * 0.6) months.push(month);
  }
  months.push(end);
  return months.map(month => ({
    month,
    label: new Date(now.getFullYear(), now.getMonth() + month, 1)
      .toLocaleDateString("en-US", { month: "short", year: "numeric" }),
  }));
}
