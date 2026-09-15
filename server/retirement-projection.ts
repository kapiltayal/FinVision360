type AssetRow = {
  id: number;
  name: string;
  category: string;
  value: string | null;
  interestRate: string | null;
  institution: string | null;
  notes: string | null;
};

type LiabilityRow = {
  id: number;
  name: string;
  category: string;
  balance: string | null;
  interestRate: string | null;
  minimumPayment: string | null;
  maturityDate: string | null;
  institution: string | null;
};

type AssetTypeRow = {
  parentCategory: string;
  subCategory: string;
  rateOfReturn: string;
};

type LiabilityTypeRow = {
  parentCategory: string;
  subCategory: string;
};

type AssetOverrideRow = {
  assetId: number;
  rateOfReturn: string;
};

type ProjectionEntryRow = {
  id: number;
  kind: string;
  name: string;
  parentCategory: string;
  category: string;
  amount: string;
  notes: string | null;
};

type ProjectedAsset = {
  id: string | number;
  sourceAssetId: number | null;
  projectionEntryId?: number;
  name: string;
  parentCategory: string;
  category: string;
  currentValue: number;
  projectedValue: number;
  returnRate: number;
  rateSource: "override" | "account" | "asset-type-default" | "projection-only";
  institution: string | null;
  details: string | null;
  isProjectionOnly: boolean;
};

type ProjectedLiability = {
  id: string | number;
  sourceLiabilityId: number | null;
  projectionEntryId?: number;
  name: string;
  parentCategory: string;
  category: string;
  currentBalance: number;
  projectedBalance: number;
  interestRate: number;
  minimumPayment: number;
  maturityDate: string | null;
  status: "paid-off" | "remaining" | "unknown";
  message: string | null;
  institution: string | null;
  isProjectionOnly: boolean;
};

function numberValue(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addUtcYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function projectDebt(balance: number, annualRatePercent: number, monthlyPayment: number, months: number): number | null {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0 || months <= 0) return null;

  const monthlyRate = Math.max(annualRatePercent, 0) / 100 / 12;
  let remaining = balance;
  for (let month = 0; month < months && remaining > 0; month += 1) {
    const interest = remaining * monthlyRate;
    if (monthlyPayment >= remaining + interest) return 0;
    remaining = remaining + interest - monthlyPayment;
    if (!Number.isFinite(remaining)) return null;
  }
  return Math.max(0, remaining);
}

export function buildRetirementNetWorthProjection(input: {
  retirementAge: number;
  currentAge: number | null;
  assets: AssetRow[];
  liabilities: LiabilityRow[];
  assetTypes: AssetTypeRow[];
  liabilityTypes: LiabilityTypeRow[];
  assetOverrides: AssetOverrideRow[];
  projectionEntries: ProjectionEntryRow[];
}) {
  const yearsToRetirement = input.currentAge === null
    ? 0
    : Math.max(0, input.retirementAge - input.currentAge);
  const monthsToRetirement = yearsToRetirement * 12;
  const retirementDate = addUtcYears(new Date(), yearsToRetirement);
  const retirementDateIso = retirementDate.toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);

  const assetTypeByCategory = new Map(input.assetTypes.map((row) => [row.subCategory, row]));
  const liabilityTypeByCategory = new Map(input.liabilityTypes.map((row) => [row.subCategory, row]));
  // Keep legacy overrides inside the slider's supported range. New values are
  // validated by the API, but older rows may have been saved before the range
  // was changed from -20% to 0%.
  const overrideByAsset = new Map(input.assetOverrides.map((row) => [
    row.assetId,
    Math.min(30, Math.max(0, numberValue(row.rateOfReturn))),
  ]));

  const projectedAssets: ProjectedAsset[] = input.assets.map((asset) => {
    const type = assetTypeByCategory.get(asset.category);
    const accountRate = asset.interestRate === null ? null : numberValue(asset.interestRate);
    const overrideRate = overrideByAsset.get(asset.id);
    const hasOverride = overrideRate !== undefined;
    const hasAccountRate = accountRate !== null && accountRate !== 0;
    const typeRate = type ? numberValue(type.rateOfReturn) * 100 : 0;
    const returnRate = Math.min(30, Math.max(0, hasOverride ? overrideRate : hasAccountRate ? accountRate : typeRate));
    const currentValue = numberValue(asset.value);
    const projectedValue = currentValue * Math.pow(1 + returnRate / 100, yearsToRetirement);

    return {
      id: asset.id,
      sourceAssetId: asset.id,
      name: asset.name,
      parentCategory: type?.parentCategory || "Uncategorized",
      category: asset.category,
      currentValue,
      projectedValue: Number.isFinite(projectedValue) ? projectedValue : currentValue,
      returnRate,
      rateSource: hasOverride ? "override" as const : hasAccountRate ? "account" as const : "asset-type-default" as const,
      institution: asset.institution,
      details: asset.notes,
      isProjectionOnly: false,
    };
  });

  const projectedLiabilities: ProjectedLiability[] = input.liabilities.map((liability) => {
    const type = liabilityTypeByCategory.get(liability.category);
    const parentCategory = type?.parentCategory || "Uncategorized";
    const closedEnd = parentCategory !== "Revolving Credit";
    const currentBalance = numberValue(liability.balance);
    const interestRateAvailable = liability.interestRate !== null && Number.isFinite(Number(liability.interestRate));
    const interestRate = interestRateAvailable ? numberValue(liability.interestRate) : 0;
    const minimumPayment = numberValue(liability.minimumPayment);
    const maturityDate = liability.maturityDate;
    let projectedBalance = currentBalance;
    let status: "paid-off" | "remaining" | "unknown" = currentBalance <= 0 ? "paid-off" : "remaining";
    let message: string | null = null;

    if (currentBalance <= 0) {
      projectedBalance = 0;
      message = "Already paid off.";
    } else if (input.currentAge === null) {
      status = "unknown";
      message = "Add your date of birth to calculate a payoff projection; current balance is carried forward.";
    } else if (closedEnd && maturityDate && maturityDate <= todayIso) {
      status = "unknown";
      message = "The maturity date has passed while a balance remains; current balance is carried to retirement.";
    } else if (closedEnd && maturityDate && maturityDate <= retirementDateIso) {
      projectedBalance = 0;
      status = "paid-off";
      message = `Paid off by ${maturityDate}.`;
    } else {
      const amortizedBalance = interestRateAvailable
        ? projectDebt(currentBalance, interestRate, minimumPayment, monthsToRetirement)
        : null;
      if (amortizedBalance === null) {
        status = "unknown";
        message = !interestRateAvailable
          ? "Interest rate is missing; current balance is carried to retirement."
          : closedEnd
            ? "Not enough payment or maturity information; current balance is carried to retirement."
            : "Not enough payment information; current balance is carried to retirement.";
      } else {
        projectedBalance = amortizedBalance;
        status = projectedBalance <= 0 ? "paid-off" : "remaining";
        message = status === "paid-off"
          ? "Expected to be paid off before retirement."
          : "Projected from the current balance, interest rate, and monthly payment.";
      }
    }

    return {
      id: liability.id,
      sourceLiabilityId: liability.id,
      name: liability.name,
      parentCategory,
      category: liability.category,
      currentBalance,
      projectedBalance,
      interestRate,
      minimumPayment,
      maturityDate,
      status,
      message,
      institution: liability.institution,
      isProjectionOnly: false,
    };
  });

  for (const entry of input.projectionEntries) {
    const amount = numberValue(entry.amount);
    if (entry.kind === "asset") {
      projectedAssets.push({
        id: `projection-asset-${entry.id}`,
        sourceAssetId: null,
        projectionEntryId: entry.id,
        name: entry.name,
        parentCategory: entry.parentCategory,
        category: entry.category,
        currentValue: 0,
        projectedValue: amount,
        returnRate: 0,
        rateSource: "projection-only",
        institution: null,
        details: entry.notes,
        isProjectionOnly: true,
      });
    } else if (entry.kind === "liability") {
      projectedLiabilities.push({
        id: `projection-liability-${entry.id}`,
        sourceLiabilityId: null,
        projectionEntryId: entry.id,
        name: entry.name,
        parentCategory: entry.parentCategory,
        category: entry.category,
        currentBalance: 0,
        projectedBalance: amount,
        interestRate: 0,
        minimumPayment: 0,
        maturityDate: null,
        status: amount <= 0 ? "paid-off" as const : "remaining" as const,
        message: entry.notes || "Projection-only liability at retirement.",
        institution: null,
        isProjectionOnly: true,
      });
    }
  }

  const projectedAssetTotal = projectedAssets.reduce((sum, asset) => sum + asset.projectedValue, 0);
  const projectedLiabilityTotal = projectedLiabilities.reduce((sum, liability) => sum + liability.projectedBalance, 0);

  return {
    retirementAge: input.retirementAge,
    yearsToRetirement,
    projectedNetWorth: projectedAssetTotal - projectedLiabilityTotal,
    projectedAssetTotal,
    projectedLiabilityTotal,
    assets: projectedAssets,
    liabilities: projectedLiabilities,
  };
}