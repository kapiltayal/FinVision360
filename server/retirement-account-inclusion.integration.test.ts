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
  async function call(method: string, path: string, userId = owner, body: any = {}) {
    const callbacks = handlers.get(`${method} ${path}`)!;
    assert.ok(callbacks);
    assert.equal(callbacks[0], requireAuth, "projection/account preferences require authentication");
    const response: any = {
      code: 200, body: undefined,
      status(code: number) { this.code = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    // Handler ownership verification after identity validation; not a JWT/sign-in test.
    await callbacks[callbacks.length - 1]({ user: { id: userId, dateOfBirth: "1980-01-01" }, body, query: {} }, response);
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
  } finally {
    await pool.query("DELETE FROM users WHERE id = ANY($1::varchar[])", [[owner, other]]);
    await pool.end();
  }
});
