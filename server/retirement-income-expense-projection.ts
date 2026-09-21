export type CashflowItem = {
  id: string;
  projectionEntryId?: number;
  source: "social-security" | "pension" | "expected-expenses" | "debt-payment" | "projection-only";
  name: string;
  monthlyAmount: number;
  details: string | null;
  isProjectionOnly: boolean;
};

export type Assumption = {
  kind: "income" | "expense";
  name: string;
  messages: string[];
};

type SocialSecurityInput = {
  fraMonthlyBenefit: string | number | null | undefined;
  dateOfBirth: string | null | undefined;
};

type PensionInput = {
  id: number;
  name: string;
  amount: string | number | null | undefined;
  frequency: string;
  startAge: number;
  notes: string | null;
};

type ProjectedLiabilityInput = {
  id: string | number;
  name: string;
  projectedBalance: number;
  minimumPayment: number;
  isProjectionOnly: boolean;
};

type ProjectionEntryInput = {
  id: number;
  kind: string;
  name: string;
  amount: string | number | null | undefined;
  notes: string | null;
};

function numberValue(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getSocialSecurityFullRetirementAge(birthYear: number): number {
  if (birthYear <= 1937) return 65;
  if (birthYear === 1938) return 65 + 2 / 12;
  if (birthYear === 1939) return 65 + 4 / 12;
  if (birthYear === 1940) return 65 + 6 / 12;
  if (birthYear === 1941) return 65 + 8 / 12;
  if (birthYear === 1942) return 65 + 10 / 12;
  if (birthYear <= 1954) return 66;
  if (birthYear === 1955) return 66 + 2 / 12;
  if (birthYear === 1956) return 66 + 4 / 12;
  if (birthYear === 1957) return 66 + 6 / 12;
  if (birthYear === 1958) return 66 + 8 / 12;
  if (birthYear === 1959) return 66 + 10 / 12;
  return 67;
}

export function getSocialSecurityDelayedRetirementCreditRate(birthYear: number): number {
  if (birthYear <= 1924) return 3;
  if (birthYear <= 1926) return 3.5;
  if (birthYear <= 1928) return 4;
  if (birthYear <= 1930) return 4.5;
  if (birthYear <= 1932) return 5;
  if (birthYear <= 1934) return 5.5;
  if (birthYear <= 1936) return 6;
  if (birthYear <= 1938) return 6.5;
  if (birthYear <= 1940) return 7;
  if (birthYear <= 1942) return 7.5;
  return 8;
}

export function getSocialSecurityBenefitAtClaimingAge(
  fraMonthlyBenefit: number,
  fullRetirementAge: number,
  claimingAge: number,
  birthYear = 1960,
): number {
  if (fraMonthlyBenefit <= 0 || claimingAge < 62) return 0;
  if (claimingAge < fullRetirementAge) {
    const monthsEarly = (fullRetirementAge - claimingAge) * 12;
    const first36 = Math.min(36, monthsEarly);
    const beyond36 = Math.max(0, monthsEarly - 36);
    const reduction = first36 * (5 / 9 / 100) + beyond36 * (5 / 12 / 100);
    return Math.max(0, fraMonthlyBenefit * (1 - reduction));
  }

  const ageForCredits = Math.min(claimingAge, 70);
  const delayedCreditRate = getSocialSecurityDelayedRetirementCreditRate(birthYear);
  return fraMonthlyBenefit * (1 + (ageForCredits - fullRetirementAge) * delayedCreditRate / 100);
}

function birthYearFromDateOfBirth(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const birthYear = Number(dateOfBirth.slice(0, 4));
  return Number.isInteger(birthYear) ? birthYear : null;
}

function monthlyPensionAmount(amount: number, frequency: string): number {
  return frequency === "annual" ? amount / 12 : amount;
}

export function buildRetirementIncomeExpenseProjection(input: {
  retirementAge: number;
  socialSecurity: SocialSecurityInput | null | undefined;
  pensions: PensionInput[];
  projectedLiabilities: ProjectedLiabilityInput[];
  expectedMonthlyExpenses: string | number | null | undefined;
  projectionEntries: ProjectionEntryInput[];
}): {
  retirementAge: number;
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  monthlySurplus: number;
  expectedMonthlyExpenses: number;
  income: CashflowItem[];
  expenses: CashflowItem[];
  assumptions: Assumption[];
} {
  const income: CashflowItem[] = [];
  const expenses: CashflowItem[] = [];
  const assumptions: Assumption[] = [];
  const retirementAge = Number.isFinite(input.retirementAge) ? input.retirementAge : 65;

  const fraBenefit = numberValue(input.socialSecurity?.fraMonthlyBenefit);
  const birthYear = birthYearFromDateOfBirth(input.socialSecurity?.dateOfBirth);
  if (!input.socialSecurity || fraBenefit <= 0) {
    assumptions.push({
      kind: "income",
      name: "Social Security",
      messages: [
        "No saved FRA monthly benefit was found, so Social Security contributes $0 at retirement.",
        "Enter the benefit on the Social Security tab to include it in this projection.",
      ],
    });
  } else if (birthYear === null) {
    assumptions.push({
      kind: "income",
      name: "Social Security",
      messages: [
        "Date of birth is missing or invalid, so the saved FRA benefit is not adjusted for claiming age and contributes $0.",
        "The projection assumes claiming at the planner retirement age once a valid date of birth is available.",
      ],
    });
  } else {
    const fullRetirementAge = getSocialSecurityFullRetirementAge(birthYear);
    const delayedCreditRate = getSocialSecurityDelayedRetirementCreditRate(birthYear);
    const monthlyBenefit = getSocialSecurityBenefitAtClaimingAge(
      fraBenefit,
      fullRetirementAge,
      retirementAge,
      birthYear,
    );
    income.push({
      id: "social-security",
      source: "social-security",
      name: "Social Security",
      monthlyAmount: monthlyBenefit,
      details: `Claimed at age ${retirementAge}; FRA benefit is ${fraBenefit.toFixed(2)} per month.`,
      isProjectionOnly: false,
    });
    assumptions.push({
      kind: "income",
      name: "Social Security",
      messages: [
        `Uses the saved FRA benefit and assumes claiming at age ${retirementAge}. Full retirement age is ${fullRetirementAge.toFixed(1)}.`,
        retirementAge < 62
          ? "Retirement occurs before age 62, so Social Security is $0 at retirement."
          : retirementAge > 70
            ? "Delayed credits are capped at age 70."
            : "Early claiming reductions or delayed credits are applied using the standard SSA schedule.",
        `Delayed retirement credits use the ${delayedCreditRate.toFixed(1)}% annual rate for birth year ${birthYear}.`,
        "Amounts are treated as gross monthly benefits with no tax or cost-of-living adjustment.",
      ],
    });
  }

  for (const pension of input.pensions) {
    const amount = numberValue(pension.amount);
    if (pension.startAge > retirementAge) {
      assumptions.push({
        kind: "income",
        name: pension.name,
        messages: [`Excluded at retirement because this pension starts at age ${pension.startAge}.`],
      });
      continue;
    }
    const monthlyAmount = monthlyPensionAmount(amount, pension.frequency);
    income.push({
      id: `pension-${pension.id}`,
      source: "pension",
      name: pension.name,
      monthlyAmount,
      details: `${pension.frequency === "annual" ? "Annual amount divided by 12" : "Monthly amount"}${pension.notes ? ` · ${pension.notes}` : ""}.`,
      isProjectionOnly: false,
    });
    assumptions.push({
      kind: "income",
      name: pension.name,
      messages: [
        `${pension.frequency === "annual" ? "Annual amount is divided by 12" : "Monthly amount is used"} at retirement age ${retirementAge}.`,
        "Pension income is treated as gross with no tax or inflation adjustment.",
      ],
    });
  }

  const expectedMonthlyExpenses = Math.max(0, numberValue(input.expectedMonthlyExpenses));
  expenses.push({
    id: "expected-expenses",
    source: "expected-expenses",
    name: "Expected lifestyle expenses",
    monthlyAmount: expectedMonthlyExpenses,
    details: "Monthly amount entered for retirement.",
    isProjectionOnly: false,
  });
  assumptions.push({
    kind: "expense",
    name: "Expected lifestyle expenses",
    messages: [
      "Uses the saved monthly amount as the retirement spending baseline.",
      "No inflation adjustment is applied.",
    ],
  });

  for (const liability of input.projectedLiabilities) {
    if (liability.isProjectionOnly || liability.projectedBalance <= 0) continue;
    const payment = Math.max(0, numberValue(liability.minimumPayment));
    expenses.push({
      id: `debt-payment-${liability.id}`,
      source: "debt-payment",
      name: `${liability.name} payment`,
      monthlyAmount: payment,
      details: payment > 0
        ? "Minimum payment from the debt account, shown because a balance remains at retirement."
        : "No minimum monthly payment is saved for this remaining debt.",
      isProjectionOnly: false,
    });
    assumptions.push({
      kind: "expense",
      name: `${liability.name} payment`,
      messages: payment > 0
        ? [
            "Included because the projected balance remains above $0 at retirement.",
            "The saved minimum payment is assumed unchanged and continuing while the balance remains.",
          ]
        : [
            "Included at $0 because the projected balance remains above $0 but no positive minimum payment is saved.",
            "Add a minimum payment to the debt account to include it in the monthly requirement.",
          ],
    });
  }

  for (const entry of input.projectionEntries) {
    if (entry.kind !== "income" && entry.kind !== "expense") continue;
    const item: CashflowItem = {
      id: `projection-${entry.kind}-${entry.id}`,
      projectionEntryId: entry.id,
      source: "projection-only",
      name: entry.name,
      monthlyAmount: Math.max(0, numberValue(entry.amount)),
      details: entry.notes || null,
      isProjectionOnly: true,
    };
    (entry.kind === "income" ? income : expenses).push(item);
    assumptions.push({
      kind: entry.kind,
      name: entry.name,
      messages: ["User-entered projection-only monthly amount at retirement; no inflation adjustment is applied."],
    });
  }

  const totalMonthlyIncome = income.reduce((sum, item) => sum + item.monthlyAmount, 0);
  const totalMonthlyExpenses = expenses.reduce((sum, item) => sum + item.monthlyAmount, 0);

  return {
    retirementAge,
    totalMonthlyIncome,
    totalMonthlyExpenses,
    monthlySurplus: totalMonthlyIncome - totalMonthlyExpenses,
    expectedMonthlyExpenses,
    income,
    expenses,
    assumptions,
  };
}