import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";

test("retirement inclusion persists, protects ownership, and changes only its selected projection", {
  skip: process.env.RUN_DB_TESTS !== "1",
}, async () => {
  const { pool } = await import("./db");
  const { registerRoutes } = await import("./routes");
  const { requireAuth } = await import("./auth");
  const { ensureRetirementAccountInclusionSchema } = await import("./retirement-account-inclusion");
  const owner = randomUUID(), other = randomUUID();
  const handlers = new Map<string, Function[]>();
  const app: any = { use() {}, set() {} };
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    app[method] = (path: string, ...callbacks: Function[]) => handlers.set(`${method} ${path}`, callbacks);
  }
  await registerRoutes(createServer(), app);
  async function call(method: string, path: string, userId = owner, body: any = {}, params: Record<string, string> = {}) {
    const callbacks = handlers.get(`${method} ${path}`)!;
    assert.ok(callbacks);
    assert.equal(callbacks[0], requireAuth, "projection/account preferences require authentication");
    const response: any = {
      code: 200, body: undefined,
      status(code: number) { this.code = code; return this; },
      json(body: unknown) { this.body = body; return this; },
      send() { return this; },
    };
    // Handler ownership verification after identity validation; not a JWT/sign-in test.
    await callbacks[callbacks.length - 1]({ user: { id: userId, dateOfBirth: "1980-01-01" }, body, query: {}, params }, response);
    return response;
  }
  try {
    await ensureRetirementAccountInclusionSchema(pool);
    await ensureRetirementAccountInclusionSchema(pool);
    await pool.query("INSERT INTO users(id) VALUES($1),($2)", [owner, other]);
    const { rows: [asset] } = await pool.query(
      "INSERT INTO assets(user_id,name,category,value,interest_rate) VALUES($1,'Test retirement account','Employer Retirement',100000,5) RETURNING id", [owner]);
    const { rows: [debt] } = await pool.query(
      "INSERT INTO liabilities(user_id,name,category,balance,interest_rate,minimum_payment) VALUES($1,'Test long-term debt','Mortgage',50000,6,300) RETURNING id", [owner]);
    const { rows: [foreign] } = await pool.query(
      "INSERT INTO assets(user_id,name,category,value) VALUES($1,'Other test account','Savings Account',1000) RETURNING id", [other]);
    const base = "/api/retirement/";
    const choice = (accountId: number, kind: string, projection: string, included: boolean) =>
      call("put", `${base}account-inclusion`, owner, { accountId, kind, projection, included });
    const accounts = async () => (await call("get", `${base}account-inclusion`)).body.accounts as any[];
    const netWorth = async () => (await call("get", `${base}net-worth-projection`)).body;
    const cashflow = async () => (await call("get", `${base}income-expense-projection`)).body;
    assert.equal((await accounts()).length, 2);
    assert.ok((await accounts()).every((row) => row.netWorthIncluded && row.incomeExpenseIncluded));
    const beforeNetWorth = await netWorth();
    const beforeCashflow = await cashflow();
    assert.ok(beforeCashflow.totalMonthlyIncome > 0);
    assert.ok(beforeCashflow.totalMonthlyExpenses > 0);
    assert.equal((await choice(foreign.id, "asset", "net-worth", false)).code, 404);
    assert.equal((await call("put", `${base}account-inclusion`, other, {
      accountId: asset.id, kind: "asset", projection: "net-worth", included: false,
    })).code, 404);
    for (const body of [
      { accountId: asset.id, kind: "asset", projection: "net-worth", included: "false" },
      { accountId: asset.id, kind: "asset", projection: "bogus", included: false },
      { accountId: -1, kind: "asset", projection: "net-worth", included: false },
    ]) assert.equal((await call("put", `${base}account-inclusion`, owner, body)).code, 400);

    assert.equal((await choice(asset.id, "asset", "net-worth", false)).code, 200);
    const withoutAsset = await netWorth();
    assert.equal(withoutAsset.assets.length, 1, "excluded accounts remain visible for re-inclusion");
    assert.equal(withoutAsset.assets[0].included, false);
    assert.equal(withoutAsset.assets[0].projectedValue, 0);
    assert.equal(withoutAsset.excludedAccountCount, 1);
    assert.ok(withoutAsset.projectedNetWorth < beforeNetWorth.projectedNetWorth);
    assert.equal((await cashflow()).totalMonthlyIncome, beforeCashflow.totalMonthlyIncome);
    assert.equal((await choice(asset.id, "asset", "income-expense", false)).code, 200);
    const withoutIncome = await cashflow();
    assert.equal(withoutIncome.totalMonthlyIncome, 0);
    assert.equal(withoutIncome.income.find((row: any) => row.assetId === asset.id).included, false);
    assert.equal(withoutIncome.excludedAccountCount, 1);
    await choice(asset.id, "asset", "net-worth", true);
    assert.equal((await netWorth()).assets.length, 1);
    const saved = (await accounts()).find((row) => row.kind === "asset");
    assert.equal(saved.netWorthIncluded, true);
    assert.equal(saved.incomeExpenseIncluded, false, "a save only changes its own projection flag");

    await choice(debt.id, "liability", "income-expense", false);
    const withoutExpenses = await cashflow();
    assert.equal(withoutExpenses.totalMonthlyExpenses, 0);
    assert.equal(withoutExpenses.expenses.find((row: any) => row.liabilityId === debt.id).included, false);
    assert.equal(withoutExpenses.excludedAccountCount, 2);
    assert.equal((await netWorth()).liabilities.length, 1);
    await choice(debt.id, "liability", "net-worth", false);
    const withoutDebt = await netWorth();
    assert.equal(withoutDebt.liabilities.length, 1);
    assert.equal(withoutDebt.liabilities[0].included, false);
    assert.equal(withoutDebt.liabilities[0].projectedBalance, 0);
    assert.equal(withoutDebt.excludedAccountCount, 1);
    await choice(asset.id, "asset", "income-expense", true);
    await Promise.all([
      choice(asset.id, "asset", "net-worth", false),
      choice(asset.id, "asset", "income-expense", false),
    ]);
    const concurrent = (await accounts()).find((row) => row.kind === "asset");
    assert.equal(concurrent.netWorthIncluded, false);
    assert.equal(concurrent.incomeExpenseIncluded, false);
    await choice(asset.id, "asset", "net-worth", true);
    await choice(asset.id, "asset", "income-expense", true);
    assert.equal((await cashflow()).totalMonthlyIncome, beforeCashflow.totalMonthlyIncome);
    assert.equal((await netWorth()).assets.length, 1);
    assert.equal((await netWorth()).assets[0].included, true);
    const otherView = (await call("get", `${base}account-inclusion`, other)).body.accounts;
    assert.equal(otherView.length, 1);
    assert.equal(otherView[0].id, foreign.id);
    assert.ok(otherView[0].netWorthIncluded);
    const { rows: [unchanged] } = await pool.query("SELECT value FROM assets WHERE id=$1", [asset.id]);
    assert.equal(Number(unchanged.value), 100000, "projection switches never edit account balances");
    await pool.query("DELETE FROM liabilities WHERE user_id=$1", [owner]);
    assert.equal((await accounts()).length, 1);
    const { rows: [count] } = await pool.query(
      "SELECT count(*) FROM retirement_account_projection_preferences WHERE user_id=$1 AND liability_id IS NOT NULL", [owner]);
    assert.equal(Number(count.count), 0, "deleting an account cleans up its preferences");

    const { rows: customNetWorth } = await pool.query(
      `INSERT INTO retirement_projection_entries(user_id,kind,name,parent_category,category,amount)
       VALUES($1,'asset','Custom asset','Cash','Cash',10000),($1,'liability','Custom debt','Debt','Loan',2000) RETURNING id,kind`, [owner]);
    const { rows: customCashflow } = await pool.query(
      `INSERT INTO retirement_income_expense_entries(user_id,kind,name,amount)
       VALUES($1,'income','Custom income',500),($1,'expense','Custom expense',200) RETURNING id,kind`, [owner]);
    const { rows: pensionRows } = await pool.query(
      `INSERT INTO retirement_pensions(user_id,name,amount,start_age)
       VALUES($1,'Test pension',100,60),($1,'Later pension',200,75) RETURNING id,name`, [owner]);
    await pool.query("INSERT INTO social_security_settings(user_id,fra_monthly_benefit) VALUES($1,1000)", [owner]);
    await pool.query("INSERT INTO retirement_income_expense_settings(user_id,expected_monthly_expenses) VALUES($1,400)", [owner]);
    const customBaseline = await netWorth(), cashflowBaseline = await cashflow();
    assert.equal(customBaseline.excludedAccountCount, 0);
    assert.equal(cashflowBaseline.excludedAccountCount, 0);
    assert.ok(cashflowBaseline.income.some((row: any) => row.inclusionKind === "pension" && row.name === "Later pension" && row.monthlyAmount === 0));
    for (const entry of customNetWorth) {
      assert.equal((await choice(entry.id, "net-worth-entry", "net-worth", false)).code, 200);
      const view = await netWorth();
      const row = [...view.assets, ...view.liabilities].find((row: any) => row.projectionEntryId === entry.id);
      assert.equal(row.included, false);
      assert.equal(row.configuredAmount, entry.kind === "asset" ? 10000 : 2000);
    }
    const excludedCustom = await netWorth();
    assert.equal(excludedCustom.projectedNetWorth, customBaseline.projectedNetWorth - 10000 + 2000);
    assert.equal(excludedCustom.excludedAccountCount, 2);
    assert.equal((await cashflow()).totalMonthlyIncome, cashflowBaseline.totalMonthlyIncome, "custom Net Worth selections do not change cash flow");
    for (const entry of customCashflow) {
      assert.equal((await choice(entry.id, "income-expense-entry", "income-expense", false)).code, 200);
    }
    for (const pension of pensionRows) await choice(pension.id, "pension", "income-expense", false);
    await choice(0, "social-security", "income-expense", false);
    await choice(0, "expected-expenses", "income-expense", false);
    const excludedCashflow = await cashflow();
    assert.equal(excludedCashflow.excludedAccountCount, 6);
    assert.equal(excludedCashflow.totalMonthlyIncome, beforeCashflow.totalMonthlyIncome);
    assert.equal(excludedCashflow.totalMonthlyExpenses, 0);
    assert.equal(excludedCashflow.expectedMonthlyExpenses, 400, "excluding the baseline never erases its saved value");
    assert.equal(excludedCashflow.income.find((row: any) => row.inclusionKind === "income-expense-entry").configuredAmount, 500);
    assert.equal(excludedCashflow.expenses.find((row: any) => row.inclusionKind === "income-expense-entry").configuredAmount, 200);
    assert.ok(!excludedCashflow.assumptions.some((row: any) => ["Social Security", "Expected lifestyle expenses", "Test pension", "Custom income", "Custom expense"].includes(row.name)));
    const savedItems = (await call("get", `${base}account-inclusion`)).body.items;
    assert.equal(savedItems.filter((row: any) => !row.included).length, 8);
    assert.equal((await call("get", `${base}account-inclusion`, other)).body.items.length, 0);
    const cases = [
      ...customNetWorth.map((row) => ({ id: row.id, kind: "net-worth-entry", projection: "net-worth" })),
      ...customCashflow.map((row) => ({ id: row.id, kind: "income-expense-entry", projection: "income-expense" })),
      ...pensionRows.map((row) => ({ id: row.id, kind: "pension", projection: "income-expense" })),
    ];
    for (const item of cases) {
      assert.equal((await call("put", `${base}account-inclusion`, other, {
        accountId: item.id, kind: item.kind, projection: item.projection, included: true,
      })).code, 404, "another user cannot change a custom item or pension");
    }
    assert.equal((await choice(customNetWorth[0].id, "net-worth-entry", "income-expense", true)).code, 400);
    assert.equal((await choice(1, "social-security", "income-expense", false)).code, 400);
    assert.equal((await choice(0, "pension", "income-expense", false)).code, 400);
    const customAsset = customNetWorth.find((row) => row.kind === "asset")!;
    const [validCategory] = (await call("get", "/api/asset-categories")).body;
    assert.ok(validCategory, "use an actual category accepted by the existing entry editor");
    assert.equal((await call("patch", `${base}projection-entries/:id`, owner, {
      kind: "asset", name: "Edited custom asset", parentCategory: validCategory.parentCategory, category: validCategory.category, amount: "12000", notes: "",
    }, { id: String(customAsset.id) })).code, 200);
    const edited = (await netWorth()).assets.find((row: any) => row.projectionEntryId === customAsset.id);
    assert.equal(edited.included, false, "editing a custom account preserves its exclusion");
    assert.equal(edited.configuredAmount, 12000);
    for (const item of cases) await choice(item.id, item.kind, item.projection, true);
    await choice(0, "social-security", "income-expense", true);
    await choice(0, "expected-expenses", "income-expense", true);
    assert.equal((await cashflow()).totalMonthlyIncome, cashflowBaseline.totalMonthlyIncome);
    assert.equal((await cashflow()).totalMonthlyExpenses, cashflowBaseline.totalMonthlyExpenses);
    assert.equal((await netWorth()).projectedNetWorth, customBaseline.projectedNetWorth + 2000);
    // Excluded custom-item preferences are removed with the deleted source item.
    await choice(customAsset.id, "net-worth-entry", "net-worth", false);
    assert.equal((await call("delete", `${base}projection-entries/:id`, owner, {}, { id: String(customAsset.id) })).code, 204);
    assert.ok(!(await call("get", `${base}account-inclusion`)).body.items.some(
      (row: any) => row.kind === "net-worth-entry" && row.itemId === customAsset.id,
    ));
  } finally {
    await pool.query("DELETE FROM users WHERE id = ANY($1::varchar[])", [[owner, other]]);
    await pool.end();
  }
});
