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

type ProjectionAssumption = {
  kind: "asset" | "liability";
  name: string;
  missingData: string[];
  handling: string[];
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

function retirementDateFromDateOfBirth(dateOfBirth: string | null | undefined, retirementAge: number): Date | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) return null;
  birthDate.setUTCFullYear(birthDate.getUTCFullYear() + retirementAge);
  return birthDate;
}

function daysUntilDate(today: Date, target: Date): number {
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  if (targetUtc <= todayUtc) return 0;
  return Math.round((targetUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

function projectDebt(balance: number, annualRatePercent: number, monthlyPayment: number, days: number): number | null {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0 || days <= 0) return null;

  const monthlyRate = Math.max(annualRatePercent, 0) / 100 / 12;
  const months = days / (365.25 / 12);
  const wholeMonths = Math.floor(months);
  const partialMonth = months - wholeMonths;
  let remaining = balance;
  for (let month = 0; month < wholeMonths && remaining > 0; month += 1) {
    const interest = remaining * monthlyRate;
    if (monthlyPayment >= remaining + interest) return 0;
    remaining = remaining + interest - monthlyPayment;
    if (!Number.isFinite(remaining)) return null;
  }

  if (partialMonth > 0 && remaining > 0) {
    const interest = remaining * monthlyRate * partialMonth;
    const payment = monthlyPayment * partialMonth;
    remaining = Math.max(0, remaining + interest - payment);
    if (!Number.isFinite(remaining)) return null;
  }

  return Math.max(0, remaining);
}

export function buildRetirementNetWorthProjection(input: {
  retirementAge: number;
  currentAge: number | null;
  dateOfBirth?: string | null;
  assets: AssetRow[];
  liabilities: LiabilityRow[];
  assetTypes: AssetTypeRow[];
  liabilityTypes: LiabilityTypeRow[];
  assetOverrides: AssetOverrideRow[];
  projectionEntries: ProjectionEntryRow[];
}) {
  const wholeYearsToRetirement = input.currentAge === null
    ? 0
    : Math.max(0, input.retirementAge - input.currentAge);
  const today = new Date();
  const dateOfBirthRetirementDate = retirementDateFromDateOfBirth(input.dateOfBirth, input.retirementAge);
  const retirementDate = dateOfBirthRetirementDate ?? addUtcYears(today, wholeYearsToRetirement);
  const daysToRetirement = dateOfBirthRetirementDate
    ? daysUntilDate(today, retirementDate)
    : wholeYearsToRetirement * 365.25;
  const yearsToRetirement = daysToRetirement / 365.25;
  const retirementDateIso = retirementDate.toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  const assetTypeByCategory = new Map(input.assetTypes.map((row) => [row.subCategory, row]));
  const liabilityTypeByCategory = new Map(input.liabilityTypes.map((row) => [row.subCategory, row]));
  // Keep legacy overrides inside the slider's supported range. New values are
  // validated by the API, but older rows may have been saved before the range
  // was changed from -20% to 0%.
  const overrideByAsset = new Map(input.assetOverrides.map((row) => [
    row.assetId,
    Math.min(30, Math.max(0, numberValue(row.rateOfReturn))),
  ]));
  const assumptions: ProjectionAssumption[] = [];

  const projectedAssets: ProjectedAsset[] = input.assets.map((asset) => {
    const type = assetTypeByCategory.get(asset.category);
    const accountRate = asset.interestRate === null ? null : numberValue(asset.interestRate);
    const overrideRate = overrideByAsset.get(asset.id);
    const hasOverride = overrideRate !== undefined;
    const hasAccountRate = asset.interestRate !== null
      && asset.interestRate !== ""
      && Number.isFinite(Number(asset.interestRate))
      && accountRate !== 0;
    const typeRate = type ? numberValue(type.rateOfReturn) * 100 : 0;
    const returnRate = Math.min(30, Math.max(0, hasOverride ? overrideRate : hasAccountRate ? accountRate ?? 0 : typeRate));
    const currentValue = numberValue(asset.value);
    const projectedValue = currentValue * Math.pow(1 + returnRate / 100, yearsToRetirement);
    const missingData: string[] = [];
    const handling: string[] = [];

    if (asset.value === null || asset.value === "" || !Number.isFinite(Number(asset.value))) {
      missingData.push("Current account value");
      handling.push("Treats the missing value as $0 before applying the projection rate.");
    }
    if (input.currentAge === null) {
      missingData.push("Date of birth/current age");
      handling.push("Uses 0 years to retirement, so the starting value is not grown.");
    }
    if (!hasOverride && !hasAccountRate) {
      missingData.push("Account return rate");
      handling.push(type
        ? `Uses the ${type.subCategory} default return of ${typeRate.toFixed(1)}%.`
        : "No asset-type default is available, so the projection uses a 0.0% return.");
    }
    if (missingData.length > 0) {
      assumptions.push({ kind: "asset", name: asset.name, missingData, handling });
    }

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
    const interestRateAvailable = liability.interestRate !== null
      && liability.interestRate !== ""
      && Number.isFinite(Number(liability.interestRate));
    const interestRate = interestRateAvailable ? numberValue(liability.interestRate) : 0;
    const minimumPayment = numberValue(liability.minimumPayment);
    const maturityDate = liability.maturityDate;
    const hasCurrentBalance = liability.balance !== null
      && liability.balance !== ""
      && Number.isFinite(Number(liability.balance));
    const hasMinimumPayment = liability.minimumPayment !== null
      && liability.minimumPayment !== ""
      && Number.isFinite(Number(liability.minimumPayment))
      && minimumPayment > 0;
    const missingData: string[] = [];
    const handling: string[] = [];
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
        ? projectDebt(currentBalance, interestRate, minimumPayment, daysToRetirement)
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
          : dateOfBirthRetirementDate
            ? "Projected from the current balance, interest rate, monthly payment, and exact days to retirement."
            : "Projected from the current balance, interest rate, and monthly payment.";
      }
    }

    if (!hasCurrentBalance) {
      missingData.push("Current balance");
      handling.push("Treats the missing balance as $0.");
    }
    if (input.currentAge === null) {
      missingData.push("Date of birth/current age");
      handling.push("Uses 0 years to retirement and carries the current balance forward.");
    }
    if (currentBalance > 0 && !interestRateAvailable) {
      missingData.push("Interest rate");
    }
    if (currentBalance > 0 && !hasMinimumPayment) {
      missingData.push("Minimum monthly payment");
    }
    if (closedEnd && !maturityDate) {
      missingData.push("Maturity date");
      handling.push("No scheduled maturity payoff is applied; the available payment data is used through retirement.");
    }
    if (!type) {
      missingData.push("Recognized liability category");
      handling.push("Uses the Uncategorized/closed-end fallback for payoff logic.");
    }
    if (missingData.length > 0) {
      if (message) handling.push(message);
      assumptions.push({ kind: "liability", name: liability.name, missingData, handling });
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
    assumptions,
  };
}