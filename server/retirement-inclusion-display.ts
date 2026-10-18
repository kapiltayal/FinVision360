import type { buildRetirementNetWorthProjection } from "./retirement-projection";
import type { buildRetirementIncomeExpenseProjection, CashflowItem } from "./retirement-income-expense-projection";
import { retirementItemIncluded, type RetirementAccountInclusionInput, type RetirementItemPreference } from "../shared/retirement-account-inclusion";

type NetWorth = ReturnType<typeof buildRetirementNetWorthProjection>;
type Cashflow = ReturnType<typeof buildRetirementIncomeExpenseProjection>;
type DisplayCashflow = Omit<CashflowItem, "source"> & {
  source: CashflowItem["source"] | "asset-account";
  liabilityId?: number;
  included?: boolean;
  nonContributing?: boolean;
  configuredAmount?: number;
  inclusionKind?: RetirementAccountInclusionInput["kind"];
  inclusionId?: number;
};

/** Keep deselected accounts available to re-check without adding them to calculations. */
export function netWorthWithAccountControls(selected: NetWorth, all: NetWorth) {
  const assets = new Set(selected.assets.filter((row) => !row.isProjectionOnly).map((row) => row.sourceAssetId));
  const debts = new Set(selected.liabilities.filter((row) => !row.isProjectionOnly).map((row) => row.sourceLiabilityId));
  const customAssets = new Set(selected.assets.filter((row) => row.isProjectionOnly).map((row) => row.projectionEntryId));
  const customDebts = new Set(selected.liabilities.filter((row) => row.isProjectionOnly).map((row) => row.projectionEntryId));
  const displayAssets = all.assets.map((row) => {
    const included = row.isProjectionOnly ? customAssets.has(row.projectionEntryId) : assets.has(row.sourceAssetId);
    return { ...row, included, configuredAmount: row.isProjectionOnly ? row.projectedValue : undefined, projectedValue: included ? row.projectedValue : 0 };
  });
  const displayDebts = all.liabilities.map((row) => {
    const included = row.isProjectionOnly ? customDebts.has(row.projectionEntryId) : debts.has(row.sourceLiabilityId);
    return { ...row, included, configuredAmount: row.isProjectionOnly ? row.projectedBalance : undefined, projectedBalance: included ? row.projectedBalance : 0 };
  });
  return { ...selected, assets: displayAssets, liabilities: displayDebts,
    excludedAccountCount: [...displayAssets, ...displayDebts].filter((row) => !row.included).length };
}

export function cashflowWithAccountControls(
  selected: Cashflow, all: Cashflow, allAccounts: NetWorth, selectedAccounts: NetWorth,
  preferences: RetirementItemPreference[] = [],
  pensions: { id: number; name: string; startAge: number }[] = [],
) {
  const assets = new Set(selectedAccounts.assets.filter((row) => !row.isProjectionOnly).map((row) => row.sourceAssetId));
  const debts = new Set(selectedAccounts.liabilities.filter((row) => !row.isProjectionOnly).map((row) => row.sourceLiabilityId));
  const income: DisplayCashflow[] = all.income.map((row) => {
    if (!row.assetId) return row;
    const included = assets.has(row.assetId);
    return { ...row, included, monthlyAmount: included ? row.monthlyAmount : 0 };
  });
  const expenses: DisplayCashflow[] = all.expenses.map((row) => {
    if (row.source !== "debt-payment") return row;
    const liabilityId = Number(row.id.replace("debt-payment-", ""));
    const included = debts.has(liabilityId);
    return { ...row, liabilityId, included, monthlyAmount: included ? row.monthlyAmount : 0 };
  });
  for (const row of allAccounts.assets) {
    if (row.isProjectionOnly || !row.sourceAssetId || income.some((item) => item.assetId === row.sourceAssetId)) continue;
    income.push({
      id: `asset-account-${row.sourceAssetId}`, source: "asset-account", assetId: row.sourceAssetId,
      name: row.name, monthlyAmount: 0, isProjectionOnly: false, included: assets.has(row.sourceAssetId),
      nonContributing: true, details: "No direct retirement cash-flow contribution for this account category.",
    });
  }
  for (const row of allAccounts.liabilities) {
    if (row.isProjectionOnly || !row.sourceLiabilityId || expenses.some((item) => item.liabilityId === row.sourceLiabilityId)) continue;
    expenses.push({
      id: `debt-payment-${row.sourceLiabilityId}`, source: "debt-payment", liabilityId: row.sourceLiabilityId,
      name: `${row.name} payment`, monthlyAmount: 0, isProjectionOnly: false, included: debts.has(row.sourceLiabilityId),
      nonContributing: true, details: "Paid off before retirement; no payment projected.",
    });
  }
  // Keep currently zero/non-contributing benefit rows selectable too.
  if (!income.some((row) => row.source === "social-security")) {
    income.push({ id: "social-security", source: "social-security", name: "Social Security",
      monthlyAmount: 0, isProjectionOnly: false, details: "No usable benefit is currently configured." });
  }
  for (const pension of pensions) {
    if (income.some((row) => row.id === `pension-${pension.id}`)) continue;
    income.push({ id: `pension-${pension.id}`, source: "pension", name: pension.name,
      monthlyAmount: 0, isProjectionOnly: false, nonContributing: true,
      details: `Benefits start at age ${pension.startAge}; no income is projected at retirement.` });
  }
  function decorate(row: DisplayCashflow): DisplayCashflow {
    let kind: RetirementAccountInclusionInput["kind"];
    let id: number;
    if (row.assetId !== undefined) { kind = "asset"; id = row.assetId; }
    else if (row.liabilityId !== undefined) { kind = "liability"; id = row.liabilityId; }
    else if (row.source === "projection-only") { kind = "income-expense-entry"; id = row.projectionEntryId!; }
    else if (row.source === "pension") { kind = "pension"; id = Number(row.id.replace("pension-", "")); }
    else if (row.source === "social-security") { kind = "social-security"; id = 0; }
    else if (row.source === "expected-expenses") { kind = "expected-expenses"; id = 0; }
    else return row;
    const included = kind === "asset" || kind === "liability" ? row.included !== false
      : retirementItemIncluded(preferences, kind, id);
    return { ...row, inclusionKind: kind, inclusionId: id, included,
      configuredAmount: row.monthlyAmount, monthlyAmount: included ? row.monthlyAmount : 0 };
  }
  const displayIncome = income.map(decorate), displayExpenses = expenses.map(decorate);
  return { ...selected, income: displayIncome, expenses: displayExpenses,
    expectedMonthlyExpenses: all.expectedMonthlyExpenses,
    excludedAccountCount: [...displayIncome, ...displayExpenses].filter((row) => row.included === false).length };
}
