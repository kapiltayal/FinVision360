import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Express } from "express";
import { budgetCurrentMonth, previousBudgetMonth } from "../shared/budget-period";
import { monthlyBackupTransaction } from "./monthly-backup";
import { monthlySavingsRequired } from "../shared/goal-monthly-savings";

test("month close, historical API, orphan values and current/future editing", {
  skip: process.env.RUN_DB_TESTS !== "1",
}, async () => {
  const { pool } = await import("./db");
  const { registerFinanceTrackerRoutes } = await import("./finance-tracker-routes");
  const handlers = new Map<string, Function>();
  const app: any = {};
  for (const method of ["get", "put", "delete", "post", "patch"]) {
    app[method] = (path: string, ...callbacks: Function[]) => handlers.set(`${method} ${path}`, callbacks[callbacks.length - 1]);
  }
  registerFinanceTrackerRoutes(app as Express);
  const client = await pool.connect();
  const query = pool.query;
  const now = new Date();
  const captured = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 5));
  const period = previousBudgetMonth(captured);
  const current = budgetCurrentMonth(now);
  const before = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1)).toISOString().slice(0, 10);
  const future = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
  const target = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const user = randomUUID();
  const emptyUser = randomUUID();
  const missingUser = randomUUID();
  async function invoke(method: string, id: string, body: any = {}, query: any = {}) {
    const res: any = {
      code: 200, body: null,
      status(code: number) { this.code = code; return this; },
      json(body: any) { this.body = body; return this; },
      send() { return this; },
    };
    await handlers.get(`${method} /api/budget-plan${body.bulk ? "/bulk" : ""}`)!({ user: { id }, body, query }, res);
    return res;
  }
  try {
    await client.query("BEGIN");
    // Tests are isolated by rollback, including any global snapshots and pruning.
    await client.query("DELETE FROM budget_close_runs WHERE period_month=$1", [`${period}-01`]);
    await client.query("DELETE FROM budget_month_closes WHERE period_month=$1", [`${period}-01`]);
    await client.query("INSERT INTO users(id) VALUES ($1),($2)", [user, emptyUser]);
    const { rows: debts } = await client.query(
      "INSERT INTO liabilities(user_id,name,category,balance,minimum_payment) VALUES ($1,'Closing loan','Loan',10000,100) RETURNING id", [user],
    );
    const { rows: goals } = await client.query(
      "INSERT INTO user_goals(user_id,title,category,target_amount,current_amount,target_date) VALUES ($1,'Closing goal','savings',12000,1000,$2) RETURNING id", [user, target],
    );
    const debtKey = `debt:${debts[0].id}`;
    const goalKey = `goal:${goals[0].id}`;
    const { rows: retention } = await client.query(
      `INSERT INTO liability_history(user_id,liability_id,name,category,balance,snapshot_at) VALUES
       ($1,$2,'Expired','Loan',1,$3::timestamptz-INTERVAL '25 months'),
       ($1,$2,'Retained','Loan',1,$3::timestamptz-INTERVAL '23 months') RETURNING id`,
      [user, debts[0].id, captured],
    );
    await client.query(
      `INSERT INTO transactions(user_id,date,description,amount,type,subcategory) VALUES
       ($1,$2,'Old income',6000,'income','salary'), ($1,$2,'Utilities',100,'expense','utilities'),
       ($1,$3,'New expense',10,'expense','new_category')`, [user, before, `${period}-15`],
    );
    await client.query(
      `INSERT INTO budget_plans(user_id,month,plan_key,planned_amount) VALUES
       ($1,$2,'income:salary',0),($1,$2,$3,150.25),($1,$2,$4,200.99)`,
      [user, `${period}-01`, debtKey, goalKey],
    );
    const old = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    await client.query(
      `INSERT INTO transactions(user_id,date,description,amount,type,subcategory) VALUES
       ($1,$2,'Old transaction',1,'expense','utilities'),($1,$3,'Recent transaction',120,'expense','utilities')`,
      [emptyUser, old, before],
    );
    const result = await monthlyBackupTransaction(client, captured);
    assert.equal(result.periodMonth, period);
    assert.equal((await client.query("SELECT id FROM liability_history WHERE id=$1", [retention[0].id])).rows.length, 0);
    assert.equal((await client.query("SELECT id FROM liability_history WHERE id=$1", [retention[1].id])).rows.length, 1);
    const { rows: snapshotRows } = await client.query("SELECT payload FROM budget_month_closes WHERE user_id=$1", [user]);
    const frozen = snapshotRows[0].payload;
    const amounts = new Map(frozen.plans.map((row: any) => [row.planKey, row.plannedAmount]));
    assert.equal(amounts.get("income:salary"), 0, "intentional zero overrides suggestion");
    assert.equal(amounts.get("expense:utilities"), 50, "average divides by the complete month window");
    assert.equal(amounts.get("expense:new_category"), 0, "new actual category has captured default");
    assert.equal(amounts.get(debtKey), 150.25);
    assert.equal(amounts.get(goalKey), 200.99);
    assert.equal(frozen.liabilities[0].minimumPayment, 100);
    assert.equal(frozen.goals[0].monthlySavingsNeeded, Number(monthlySavingsRequired(12000, 1000, target, captured)!.toFixed(2)));
    const longHistory = await client.query("SELECT payload FROM budget_month_closes WHERE user_id=$1", [emptyUser]);
    assert.equal(longHistory.rows[0].payload.plans.find((row: any) => row.planKey === "expense:utilities").plannedAmount, 10,
      "an older account keeps the full 12-month denominator even when recent months are empty");
    await client.query("DELETE FROM liabilities WHERE user_id=$1", [user]);
    await client.query("DELETE FROM user_goals WHERE user_id=$1", [user]);
    await client.query("UPDATE budget_plans SET planned_amount=999 WHERE user_id=$1", [user]);
    const countsBefore = await client.query("SELECT COUNT(*)::int AS count FROM liability_history");
    const retry = await monthlyBackupTransaction(client, captured);
    assert.equal(retry.alreadyCompleted, true);
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM liability_history")).rows[0].count, countsBefore.rows[0].count);
    // Execute the authorized route handlers using the rollback-only connection;
    // this does not bypass or alter authentication in the running application.
    pool.query = client.query.bind(client) as any;
    const historical = await invoke("get", user, {}, { month: period });
    assert.equal(historical.body.readOnly, true);
    assert.equal(historical.body.snapshot.status, "complete");
    assert.equal(historical.body.snapshot.periodMonth, period);
    assert.equal(new Date(historical.body.snapshot.capturedAt).toISOString(), captured.toISOString());
    assert.deepEqual(historical.body.plans, frozen.plans);
    assert.equal(historical.body.liabilities[0].balance, 10000);
    const empty = await invoke("get", emptyUser, {}, { month: period });
    assert.equal(empty.body.snapshot.status, "complete");
    assert.equal(empty.body.goals.length, 0, "valid empty close is distinct from missing close");
    // A user without a close keeps saved rows even with no live entities.
    await client.query("INSERT INTO users(id) VALUES ($1)", [missingUser]);
    await client.query("INSERT INTO liabilities(user_id,name,category,balance,minimum_payment) VALUES ($1,'Wrong live debt','Loan',999999,9999)", [missingUser]);
    await client.query("INSERT INTO user_goals(user_id,title,category,target_amount,current_amount,target_date) VALUES ($1,'Wrong live goal','savings',999999,0,$2)", [missingUser, target]);
    await client.query(
      `INSERT INTO budget_plans(user_id,month,plan_key,planned_amount,entity_metadata) VALUES
       ($1,$2,'debt:90001',45.67,'{"name":"Retained debt","category":"Loan"}'),
       ($1,$2,'goal:90002',89.12,'{"name":"Retained goal","category":"Savings"}')`,
      [missingUser, `${period}-01`],
    );
    const missing = await invoke("get", missingUser, {}, { month: period });
    assert.equal(missing.body.snapshot.status, "unavailable");
    assert.equal(missing.body.liabilities.length, 1, "no live debt fallback when close is missing");
    assert.equal(missing.body.goals.length, 1, "no live goal fallback when close is missing");
    assert.equal(missing.body.liabilities[0].name, "Retained debt");
    assert.equal(missing.body.liabilities[0].balance, null);
    assert.equal(missing.body.goals[0].monthlySavingsNeeded, null);
    assert.equal(Math.round(missing.body.plans.reduce((sum: number, row: any) => sum + row.plannedAmount, 0) * 100), 13479);
    assert.equal((await invoke("put", missingUser, { month: period, planKey: "debt:90001", plannedAmount: 999 })).code, 403);
    assert.equal((await invoke("put", missingUser, { bulk: true, month: period, plans: [{ planKey: "debt:90001", plannedAmount: 999 }] })).code, 403);
    assert.equal((await invoke("delete", missingUser, {}, { month: period, planKey: "goal:90002" })).code, 403);
    assert.equal((await invoke("put", missingUser, { month: current, planKey: "income:salary", plannedAmount: 10.12 })).code, 200);
    assert.equal((await invoke("put", missingUser, { bulk: true, month: current, plans: [{ planKey: "income:salary", plannedAmount: 0 }] })).code, 200);
    assert.equal((await invoke("get", missingUser, {}, { month: current })).body.plans[0].plannedAmount, 0);
    assert.equal((await invoke("delete", missingUser, {}, { month: current, planKey: "income:salary" })).code, 204);
    assert.equal((await invoke("put", missingUser, { month: future, planKey: "expense:utilities", plannedAmount: 100.12 })).code, 200);
    const { rows: metadataDebt } = await client.query(
      "INSERT INTO liabilities(user_id,name,category,balance,minimum_payment) VALUES ($1,'Saved identity','Loan',10,1) RETURNING id", [missingUser],
    );
    const metadataKey = `debt:${metadataDebt[0].id}`;
    assert.equal((await invoke("put", missingUser, { month: current, planKey: metadataKey, plannedAmount: 99.99 })).code, 200);
    await client.query("DELETE FROM liabilities WHERE user_id=$1", [missingUser]);
    assert.equal((await invoke("put", missingUser, { bulk: true, month: current, plans: [{ planKey: metadataKey, plannedAmount: 100.12 }] })).code, 200);
    const { rows: metadataPlans } = await client.query(
      "SELECT entity_metadata FROM budget_plans WHERE user_id=$1 AND month=$2 AND plan_key=$3", [missingUser, `${current}-01`, metadataKey],
    );
    assert.equal(metadataPlans[0].entity_metadata.name, "Saved identity", "retain saved label even after live source is deleted");
    const historyCount = (await client.query("SELECT COUNT(*)::int AS count FROM asset_history")).rows[0].count;
    await client.query("SAVEPOINT failed_close");
    await client.query("DELETE FROM budget_close_runs WHERE period_month=$1", [`${period}-01`]);
    await client.query("DELETE FROM budget_month_closes WHERE period_month=$1", [`${period}-01`]);
    const failingClient = {
      query: async (sql: string, args?: any[]) => {
        if (sql.startsWith("INSERT INTO budget_month_closes")) throw new Error("Injected failure after legacy snapshots");
        return client.query(sql, args);
      },
    };
    await assert.rejects(monthlyBackupTransaction(failingClient as any, captured), /Injected failure/);
    await client.query("ROLLBACK TO SAVEPOINT failed_close");
    assert.equal((await client.query("SELECT COUNT(*)::int AS count FROM asset_history")).rows[0].count, historyCount);
    assert.equal((await client.query("SELECT period_month FROM budget_close_runs WHERE period_month=$1", [`${period}-01`])).rows.length, 1);
  } finally {
    pool.query = query;
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
