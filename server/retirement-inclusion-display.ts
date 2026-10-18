import type { buildRetirementNetWorthProjection } from "./retirement-projection";
import type { buildRetirementIncomeExpenseProjection, CashflowItem } from "./retirement-income-expense-projection";

type NetWorth = ReturnType<typeof buildRetirementNetWorthProjection>;
type Cashflow = ReturnType<typeof buildRetirementIncomeExpenseProjection>;
type DisplayCashflow = Omit<CashflowItem, "source"> & {
  source: CashflowItem["source"] | "asset-account";
  liabilityId?: number;
  included?: boolean;
  nonContributing?: boolean;
};

/** Keep deselected accounts available to re-check without adding them to calculations. */
export function netWorthWithAccountControls(selected: NetWorth, all: NetWorth) {
  const assets = new Set(selected.assets.filter((row) => !row.isProjectionOnly).map((row) => row.sourceAssetId));
  const debts = new Set(selected.liabilities.filter((row) => !row.isProjectionOnly).map((row) => row.sourceLiabilityId));
  const excludedAccountCount = all.assets.filter((row) => !row.isProjectionOnly && !assets.has(row.sourceAssetId)).length
    + all.liabilities.filter((row) => !row.isProjectionOnly && !debts.has(row.sourceLiabilityId)).length;
  return {
    ...selected,
    assets: all.assets.map((row) => {
      if (row.isProjectionOnly) return row;
      const included = assets.has(row.sourceAssetId);
      return { ...row, included, projectedValue: included ? row.projectedValue : 0 };
    }),
    liabilities: all.liabilities.map((row) => {
      if (row.isProjectionOnly) return row;
      const included = debts.has(row.sourceLiabilityId);
      return { ...row, included, projectedBalance: included ? row.projectedBalance : 0 };
    }),
    excludedAccountCount,
  };
}

export function cashflowWithAccountControls(
  selected: Cashflow, all: Cashflow, allAccounts: NetWorth, selectedAccounts: NetWorth,
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
  return {
    ...selected, income, expenses,
    excludedAccountCount: [...income, ...expenses].filter((row) => row.included === false).length,
  };
}
