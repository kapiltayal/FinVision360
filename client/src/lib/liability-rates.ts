export type LiabilityRateInput = {
  balance: string | null;
  interestRate: string | null;
};

export type LiabilityRateSummary = {
  annualInterest: number;
  weightedRate: number | null;
  unknownRateCount: number;
};

export function getKnownLiabilityApr(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

/** Summarize known APRs without silently treating missing rates as zero. */
export function summarizeLiabilityRates(items: LiabilityRateInput[]): LiabilityRateSummary {
  let knownRateBalance = 0;
  let weightedRateTotal = 0;
  let annualInterest = 0;
  let unknownRateCount = 0;

  for (const item of items) {
    const balance = Number(item.balance ?? 0);
    if (!Number.isFinite(balance) || balance < 0) continue;
    const rate = getKnownLiabilityApr(item.interestRate);
    if (rate === null) {
      if (balance > 0) unknownRateCount++;
      continue;
    }
    knownRateBalance += balance;
    weightedRateTotal += balance * rate;
    annualInterest += balance * rate / 100;
  }

  return {
    annualInterest,
    weightedRate: knownRateBalance > 0 ? weightedRateTotal / knownRateBalance : null,
    unknownRateCount,
  };
}
