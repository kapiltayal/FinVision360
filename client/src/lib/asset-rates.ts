export function getKnownAssetRate(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const rate = Number(value);
  return Number.isFinite(rate) ? rate : null;
}

/** Missing returns do not count as 0% in estimated returns or weighted averages. */
export function summarizeAssetRates(items: { value: string | null; interestRate: string | null }[]) {
  let knownRateValue = 0;
  let weightedRateTotal = 0;
  let unknownRateCount = 0;
  for (const item of items) {
    const value = Number(item.value ?? 0);
    if (!Number.isFinite(value) || value < 0) continue;
    const rate = getKnownAssetRate(item.interestRate);
    if (rate === null) {
      if (value > 0) unknownRateCount++;
      continue;
    }
    knownRateValue += value;
    weightedRateTotal += value * rate;
  }
  return {
    annualReturn: weightedRateTotal / 100,
    weightedRate: knownRateValue > 0 ? weightedRateTotal / knownRateValue : null,
    unknownRateCount,
  };
}
