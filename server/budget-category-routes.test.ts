import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { budgetCurrentMonth, previousBudgetMonth } from "../shared/budget-period";

test("budget API uses catalog IDs across averages, future plans, edits, bulk copying and deletion", {
  skip: process.env.RUN_DB_TESTS !== "1",
}, async () => {
  const { pool } = await import("./db");
  const { registerFinanceTrackerRoutes } = await import("./finance-tracker-routes");
  const handlers = new Map<string, Function>();
  const app: any = {};
  for (const method of ["get", "put", "delete", "post", "patch"]) {
    app[method] = (path: string, ...callbacks: Function[]) => handlers.set(`${method} ${path}`, callbacks.at(-1)!);
  }
  registerFinanceTrackerRoutes(app);
  const user = randomUUID();
  const other = randomUUID();
  const client = await pool.connect();
  const originalQuery = pool.query;
  const month = budgetCurrentMonth();
  const prior = previousBudgetMonth();
  const now = new Date();
  const future = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
  async function invoke(method: string, path: string, body: any = {}, query: any = {}, id = user) {
    const res: any = {
      code: 200, body: undefined,
      status(code: number) { this.code = code; return this; },
      json(body: any) { this.body = body; return this; },
      send() { return this; },
    };
    await handlers.get(`${method} ${path}`)!({ user: { id }, body, query }, res);
    return res;
  }
  try {
    await client.query("BEGIN");
    pool.query = client.query.bind(client) as any;
    await client.query("INSERT INTO users(id) VALUES ($1),($2)", [user, other]);
    const id = Number((await client.query("SELECT budget_resolve_category_id('expense','groceries') AS id")).rows[0].id);
    assert.ok(id > 0);
    const key = `expense:category:${id}`;
    await client.query(
      `INSERT INTO transactions(user_id,date,description,type,subcategory,amount) VALUES
       ($1,$2,'Fixture lower','expense','groceries',10),
       ($1,$2,'Fixture title','expense','Groceries',20),
       ($3,$2,'Other user','expense','Groceries',9999)`,
      [user, `${prior}-10`, other],
    );
    await client.query(
      `INSERT INTO transactions(user_id,date,description,type,subcategory,amount) VALUES
       ($1,$2,'Selected month','expense','Groceries',7)`, [user, `${month}-01`],
    );
    const summary = await invoke("get", "/api/transactions/monthly-averages");
    assert.equal(summary.code, 200);
    const groceries = summary.body.categories.find((c: any) => c.categoryId === id);
    assert.equal(groceries.average, 30);
    assert.equal(groceries.history.length, 1);
    assert.equal(groceries.history[0].amount, 30, "current-month and other-user transactions excluded");
    const current = await invoke("get", "/api/budget-plan", {}, { month });
    assert.equal(current.body.actuals.find((a: any) => a.categoryId === id).amount, 7);
    const next = await invoke("get", "/api/budget-plan", {}, { month: future });
    assert.ok(next.body.categories.some((c: any) => c.name === "Donations"));
    assert.ok(next.body.categories.every((c: any) => Number.isInteger(c.id) && ["income", "expense"].includes(c.type)));
    assert.equal((await client.query("SELECT count(*) FROM budget_plans WHERE user_id=$1", [user])).rows[0].count, "0",
      "reading a month does not persist defaults");
    await client.query("INSERT INTO budget_plans(user_id,month,plan_key,planned_amount) VALUES ($1,$2,'expense:groceries',55)", [user, `${future}-01`]);
    const migrated = await invoke("get", "/api/budget-plan", {}, { month: future });
    assert.equal(migrated.body.plans.find((p: any) => p.planKey === key).plannedAmount, 55);
    const saved = await invoke("put", "/api/budget-plan", { month: future, planKey: key, plannedAmount: 0 });
    assert.equal(saved.code, 200);
    const persisted = (await client.query("SELECT plan_key,transaction_type_id,planned_amount FROM budget_plans WHERE user_id=$1", [user])).rows;
    assert.equal(persisted.length, 1, "numeric save replaces, rather than duplicates, legacy aliases");
    assert.equal(persisted[0].transaction_type_id, id);
    assert.equal(Number(persisted[0].planned_amount), 0);
    const reloaded = await invoke("get", "/api/budget-plan", {}, { month: future });
    assert.equal(reloaded.body.plans[0].plannedAmount, 0);
    assert.equal((await invoke("put", "/api/budget-plan", { month: future, planKey: `income:category:${id}`, plannedAmount: 1 })).code, 400);
    assert.equal((await invoke("put", "/api/budget-plan", { month: future, planKey: "expense:category:2147483647", plannedAmount: 1 })).code, 400);
    assert.equal((await invoke("put", "/api/budget-plan", { month: future, planKey: "expense:new_arbitrary_name", plannedAmount: 1 })).code, 400);
    const bulk = await invoke("put", "/api/budget-plan/bulk", { month: future, plans: [{ planKey: key, plannedAmount: 30 }] });
    assert.equal(bulk.code, 200);
    const removed = await invoke("delete", "/api/budget-plan", {}, { month: future, planKey: key });
    assert.equal(removed.code, 204);
    assert.equal((await client.query("SELECT count(*) FROM budget_plans WHERE user_id=$1", [user])).rows[0].count, "0");
    // A deleted catalog entry has a retained key/label but a NULL FK.
    const orphanKey = "expense:category:2147483647";
    await client.query(
      `INSERT INTO budget_plans(user_id,month,plan_key,planned_amount,entity_metadata)
       VALUES ($1,$2,$3,44,'{"name":"Archived category","category":"Old"}')`, [user, `${future}-01`, orphanKey],
    );
    assert.equal((await invoke("put", "/api/budget-plan", { month: future, planKey: orphanKey, plannedAmount: 45 })).code, 200);
    assert.equal((await invoke("delete", "/api/budget-plan", {}, { month: future, planKey: orphanKey })).code, 204);
    assert.equal((await invoke("put", "/api/budget-plan", { month: future, planKey: "expense:category:99999999999999999", plannedAmount: 1 })).code, 400);
  } finally {
    pool.query = originalQuery;
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
