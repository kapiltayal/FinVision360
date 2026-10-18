import assert from "node:assert/strict";
import test from "node:test";
import { buildRetirementNetWorthProjection } from "./retirement-projection";
import { buildRetirementIncomeExpenseProjection } from "./retirement-income-expense-projection";
import { cashflowWithAccountControls, netWorthWithAccountControls } from "./retirement-inclusion-display";

const inputs: Parameters<typeof buildRetirementNetWorthProjection>[0] = {
  retirementAge: 65, currentAge: 64,
  assets: [
    { id: 1, name: "IRA", category: "Employer Retirement", value: "100000", interestRate: "5", institution: null, notes: null },
    { id: 2, name: "Savings", category: "Savings Account", value: "1000", interestRate: "2", institution: null, notes: null },
  ],
  liabilities: [
    { id: 1, name: "Remaining debt", category: "Loan", balance: "1000", interestRate: "6", minimumPayment: "10", maturityDate: null, institution: null },
    { id: 2, name: "Paid debt", category: "Loan", balance: "10", interestRate: "0", minimumPayment: "100", maturityDate: null, institution: null },
  ],
  assetTypes: [{ parentCategory: "Retirement", subCategory: "Employer Retirement", rateOfReturn: "0.05" }],
  liabilityTypes: [], assetOverrides: [],
  projectionEntries: [{ id: 1, kind: "asset", name: "Future gift", parentCategory: "Cash", category: "Cash", amount: "500", notes: null }],
};
function cashflow(accounts: ReturnType<typeof buildRetirementNetWorthProjection>) {
  return buildRetirementIncomeExpenseProjection({
    retirementAge: 65, projectedAssets: accounts.assets, projectedLiabilities: accounts.liabilities,
    socialSecurity: null, pensions: [], withdrawalRates: [], expectedMonthlyExpenses: "50",
    projectionEntries: [{ id: 1, kind: "income", name: "Other income", amount: "100", notes: null }],
  });
}

test("excluded display rows stay present but cannot change Net Worth totals or assumptions", () => {
  const all = buildRetirementNetWorthProjection(inputs);
  const selected = buildRetirementNetWorthProjection({ ...inputs, assets: [], liabilities: [] });
  const response = netWorthWithAccountControls(selected, all);
  assert.equal(response.assets.length, all.assets.length);
  assert.equal(response.liabilities.length, all.liabilities.length);
  assert.equal(response.excludedAccountCount, 4);
  assert.equal(response.projectedNetWorth, 500, "projection-only entries remain unchanged");
  assert.deepEqual(response.assumptions, selected.assumptions);
  assert.equal(response.assets.reduce((sum, row) => sum + row.projectedValue, 0), response.projectedAssetTotal);
  assert.equal(response.liabilities.reduce((sum, row) => sum + row.projectedBalance, 0), response.projectedLiabilityTotal);
  assert.ok(response.assets.some((row) => row.sourceAssetId === 1 && row.currentValue === 100000));
  assert.equal(netWorthWithAccountControls(all, all).excludedAccountCount, 0);
});

test("cashflow controls cover ordinary savings and paid-off debts without inventing income/payments", () => {
  const allAccounts = buildRetirementNetWorthProjection(inputs);
  const selectedAccounts = buildRetirementNetWorthProjection({ ...inputs, assets: [], liabilities: [] });
  const selected = cashflow(selectedAccounts);
  const full = cashflow(allAccounts);
  const response = cashflowWithAccountControls(selected, full, allAccounts, selectedAccounts);
  assert.equal(response.excludedAccountCount, 4);
  const savings = response.income.find((row) => row.assetId === 2)!;
  assert.equal(savings.source, "asset-account");
  assert.equal(savings.nonContributing, true);
  assert.equal(savings.included, false);
  const paidDebt = response.expenses.find((row) => row.liabilityId === 2)!;
  assert.equal(paidDebt.included, false);
  assert.equal(paidDebt.nonContributing, true);
  assert.equal(response.totalMonthlyIncome, 100);
  assert.equal(response.totalMonthlyExpenses, 50);
  assert.equal(response.income.reduce((sum, row) => sum + row.monthlyAmount, 0), response.totalMonthlyIncome);
  assert.equal(response.expenses.reduce((sum, row) => sum + row.monthlyAmount, 0), response.totalMonthlyExpenses);
  assert.deepEqual(response.assumptions, selected.assumptions);
  const restored = cashflowWithAccountControls(full, full, allAccounts, allAccounts);
  assert.equal(restored.excludedAccountCount, 0);
  assert.equal(restored.income.find((row) => row.assetId === 2)?.monthlyAmount, 0);
  assert.equal(restored.expenses.find((row) => row.liabilityId === 2)?.monthlyAmount, 0);
  assert.equal(restored.totalMonthlyIncome, full.totalMonthlyIncome);
  assert.equal(restored.totalMonthlyExpenses, full.totalMonthlyExpenses);
});

test("custom Net Worth assets and liabilities can be excluded without losing their editable amounts", () => {
  const all = buildRetirementNetWorthProjection({
    ...inputs, projectionEntries: [...inputs.projectionEntries,
      { id: 2, kind: "liability", name: "Custom future debt", parentCategory: "Debt", category: "Loan", amount: "200", notes: null }],
  });
  const selected = buildRetirementNetWorthProjection({ ...inputs, projectionEntries: [] });
  const response = netWorthWithAccountControls(selected, all);
  assert.equal(response.excludedAccountCount, 2);
  const asset = response.assets.find((row) => row.isProjectionOnly)!;
  const debt = response.liabilities.find((row) => row.isProjectionOnly)!;
  assert.equal(asset.included, false);
  assert.equal(asset.configuredAmount, 500);
  assert.equal(asset.projectedValue, 0);
  assert.equal(debt.included, false);
  assert.equal(debt.configuredAmount, 200);
  assert.equal(debt.projectedBalance, 0);
  assert.equal(response.projectedNetWorth, selected.projectedNetWorth);
  assert.equal(response.assets.reduce((sum, row) => sum + row.projectedValue, 0), selected.projectedAssetTotal);
});

test("all custom cashflow and benefit sources retain checkboxes and saved values when excluded", () => {
  const accounts = buildRetirementNetWorthProjection(inputs);
  const source: Parameters<typeof buildRetirementIncomeExpenseProjection>[0] = {
    retirementAge: 65, projectedAssets: accounts.assets, projectedLiabilities: accounts.liabilities,
    socialSecurity: { fraMonthlyBenefit: "1000", dateOfBirth: "1980-01-01" },
    pensions: [{ id: 1, name: "Pension", amount: "200", frequency: "monthly", startAge: 60, notes: null }],
    withdrawalRates: [], expectedMonthlyExpenses: "50",
    projectionEntries: [
      { id: 1, kind: "income", name: "Rent", amount: "500", notes: null },
      { id: 2, kind: "expense", name: "Travel", amount: "100", notes: null },
    ],
  };
  const all = buildRetirementIncomeExpenseProjection(source);
  const selected = buildRetirementIncomeExpenseProjection({
    ...source, projectionEntries: [], pensions: [], includeSocialSecurity: false, includeExpectedExpenses: false,
  });
  const preferences = [
    { kind: "income-expense-entry", itemId: 1, included: false },
    { kind: "income-expense-entry", itemId: 2, included: false },
    { kind: "pension", itemId: 1, included: false },
    { kind: "social-security", itemId: 0, included: false },
    { kind: "expected-expenses", itemId: 0, included: false },
  ];
  const response = cashflowWithAccountControls(selected, all, accounts, accounts, preferences);
  assert.equal(response.excludedAccountCount, 5);
  assert.equal(response.expectedMonthlyExpenses, 50);
  const rows = [...response.income, ...response.expenses];
  for (const preference of preferences) {
    const row = rows.find((row) => row.inclusionKind === preference.kind && row.inclusionId === preference.itemId)!;
    assert.ok(row, `${preference.kind} must remain selectable`);
    assert.equal(row.included, false);
    assert.equal(row.monthlyAmount, 0);
    assert.ok(row.configuredAmount! > 0);
  }
  assert.equal(response.income.reduce((sum, row) => sum + row.monthlyAmount, 0), selected.totalMonthlyIncome);
  assert.equal(response.expenses.reduce((sum, row) => sum + row.monthlyAmount, 0), selected.totalMonthlyExpenses);
  assert.deepEqual(response.assumptions, selected.assumptions);
});
