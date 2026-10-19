import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { allocationAccounts, ensureGoalAllocationSchema, saveAllocation } from "./goal-allocation";
import { buildBudgetClose } from "./budget-history";
import { monthlySavingsRequired } from "../shared/goal-monthly-savings";
import { deletePlaidConnection } from "./plaid-disconnect";

test("allocation ownership, concurrency, limits, legacy mapping, deficits and immutable closes", {
  skip: process.env.RUN_DB_TESTS !== "1",
}, async () => {
  const { pool } = await import("./db");
  const { registerRoutes } = await import("./routes");
  const { requireAuth } = await import("./auth");
  const handlers = new Map<string, Function[]>();
  const app: any = { use() {}, set() {} };
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    app[method] = (path: string, ...callbacks: Function[]) => handlers.set(`${method} ${path}`, callbacks);
  }
  await registerRoutes(createServer(), app);
  async function call(method: string, path: string, userId: string, body: any = {}, params: any = {}, query: any = {}) {
    const callbacks = handlers.get(`${method} ${path}`)!;
    assert.equal(callbacks[0], requireAuth, "allocation-related APIs require authentication");
    const response: any = {
      code: 200, body: undefined,
      status(code: number) { this.code = code; return this; },
      json(body: any) { this.body = body; return this; },
      send() { return this; },
    };
    // Test authorization after identity verification, not Supabase token validation.
    await callbacks[callbacks.length - 1]({ user: { id: userId }, body, params, query }, response);
    return response;
  }
  const owner = randomUUID(), other = randomUUID();
  try {
    await ensureGoalAllocationSchema(pool);
    await pool.query("INSERT INTO users(id) VALUES($1),($2)", [owner, other]);
    const { rows: [account] } = await pool.query("INSERT INTO assets(user_id,name,category,value) VALUES($1,'Cash','Checking Account',1000) RETURNING id", [owner]);
    const { rows: [investment] } = await pool.query("INSERT INTO assets(user_id,name,category,value) VALUES($1,'Investment','investment',1000) RETURNING id", [owner]);
    const { rows: [goal] } = await pool.query("INSERT INTO user_goals(user_id,title,target_amount,current_amount,target_date) VALUES($1,'Travel',1500,300,'2028-01-01') RETURNING id", [owner]);
    const { rows: [goal2] } = await pool.query("INSERT INTO user_goals(user_id,title,target_amount) VALUES($1,'Home',2000) RETURNING id", [owner]);
    const funding = async () => (await pool.query("SELECT * FROM goal_funding WHERE id=$1 AND user_id=$2", [goal.id, owner])).rows[0];
    assert.equal((await funding()).legacy_amount, "300.00", "migration preserves progress without guessing source");
    await assert.rejects(saveAllocation(pool, other, { assetId: account.id, goalId: goal.id, amount: 10 }), /not found/);
    await assert.rejects(saveAllocation(pool, owner, { assetId: investment.id, goalId: goal.id, amount: 10 }), /Only checking/);
    await saveAllocation(pool, owner, { assetId: account.id, goalId: goal.id, amount: 200 });
    assert.equal((await funding()).current_amount, "500.00");
    const privateData = await call("get", "/api/goal-allocations", other);
    assert.deepEqual(privateData.body, { accounts: [], goals: [], allocations: [], accountOrder: [], activeGoalOrder: [] });
    const ownerData = await call("get", "/api/goal-allocations", owner);
    assert.equal(ownerData.body.accounts.length, 1, "each eligible asset appears exactly once");
    assert.equal(ownerData.body.goals.find((g: any) => g.id === goal.id).legacyAmount, "300.00");
    assert.deepEqual(ownerData.body.accountOrder, []);
    assert.deepEqual(ownerData.body.activeGoalOrder, []);
    const savedOrder = await call("put", "/api/goal-allocations/order", owner, {
      accountOrder: [account.id],
      activeGoalOrder: [goal2.id, goal.id],
    });
    assert.equal(savedOrder.code, 200);
    assert.deepEqual(savedOrder.body, { accountOrder: [account.id], activeGoalOrder: [goal2.id, goal.id] });
    assert.equal((await call("get", "/api/goal-allocations", owner)).body.activeGoalOrder[0], goal2.id, "the order persists for its owner");
    assert.deepEqual((await call("get", "/api/goal-allocations", other)).body.accountOrder, [], "another user cannot see the saved order");
    assert.equal((await call("put", "/api/goal-allocations/order", owner, {
      accountOrder: ["not-an-id"], activeGoalOrder: [],
    })).code, 422);
    const linkId = ownerData.body.allocations[0].id;
    assert.equal((await call("delete", "/api/goal-allocations/:id", other, {}, { id: linkId })).code, 404);
    assert.equal((await call("post", "/api/goal-allocations", other, { assetId: account.id, goalId: goal.id, amount: 10 })).code, 404);
    assert.equal((await call("patch", "/api/goals/:id", owner, { currentAmount: 100 }, { id: goal.id })).code, 422);
    assert.equal((await call("patch", "/api/goals/:id", owner, { targetAmount: 100 }, { id: goal.id })).code, 422);
    const month = new Date().toISOString().slice(0, 7);
    const budget = await call("get", "/api/budget-plan", owner, {}, {}, { month });
    assert.equal(budget.code, 200);
    assert.equal(budget.body.goals.find((g: any) => g.id === goal.id).currentAmount, 500);
    assert.equal((await pool.query("SELECT id FROM budget_plans WHERE user_id=$1", [owner])).rowCount, 0, "reading budget never persists suggestions");
    assert.equal((await pool.query("SELECT id FROM transactions WHERE user_id=$1", [owner])).rowCount, 0, "earmarks are not cash flow");
    await saveAllocation(pool, owner, { assetId: account.id, goalId: goal.id, amount: 350, legacyAmount: 150 });
    assert.equal((await funding()).current_amount, "500.00", "mapping does not double count");
    assert.equal((await funding()).legacy_amount, "150.00");
    await assert.rejects(saveAllocation(pool, owner, { assetId: account.id, goalId: goal.id, amount: 360, legacyAmount: 20 }), /Mapping/);
    const concurrent = await Promise.allSettled([
      saveAllocation(pool, owner, { assetId: account.id, goalId: goal.id, amount: 900 }),
      saveAllocation(pool, owner, { assetId: account.id, goalId: goal2.id, amount: 650 }),
    ]);
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1, "concurrent changes cannot over-allocate");
    await pool.query("UPDATE assets SET value=100 WHERE id=$1 AND user_id=$2", [account.id, owner]);
    const [deficit] = await allocationAccounts(pool, owner);
    assert.ok(Number(deficit.deficitAmount) > 0);
    await assert.rejects(saveAllocation(pool, owner, { assetId: account.id, goalId: goal2.id, amount: 700 }), /unallocated/);
    await saveAllocation(pool, owner, { assetId: account.id, goalId: goal.id, amount: 50 });
    await pool.query("UPDATE assets SET value=10000 WHERE id=$1 AND user_id=$2", [account.id, owner]);
    await assert.rejects(saveAllocation(pool, owner, { assetId: account.id, goalId: goal.id, amount: 1400 }), /remaining target/);
    const client = await pool.connect();
    try {
      const period = "2026-10", captured = new Date("2026-11-01T00:00:00Z");
      await client.query("INSERT INTO budget_plans(user_id,month,plan_key,planned_amount) VALUES($1,'2026-10-01',$2,0)", [owner, `goal:${goal.id}`]);
      const snapshot = await buildBudgetClose(client, owner, period, captured);
      const row = snapshot.goals.find((g) => g.id === goal.id)!;
      assert.equal(row.currentAmount, 200);
      assert.equal(row.monthlySavingsNeeded, Number(monthlySavingsRequired(1500, 200, "2028-01-01", captured)!.toFixed(2)));
      assert.equal(snapshot.plans.find((p) => p.planKey === `goal:${goal.id}`)?.plannedAmount, 0, "saved zero overrides suggested amount");
      await client.query("INSERT INTO budget_month_closes(user_id,period_month,payload) VALUES($1,'2026-10-01',$2)", [owner, JSON.stringify(snapshot)]);
      await saveAllocation(pool, owner, { assetId: account.id, goalId: goal.id, amount: 100 });
      const { rows: [history] } = await client.query("SELECT payload FROM budget_month_closes WHERE user_id=$1", [owner]);
      assert.deepEqual(history.payload, snapshot, "live allocation changes do not rewrite history");
      assert.equal((await call("delete", "/api/assets/:id", owner, {}, { id: account.id })).code, 409);
      assert.equal((await call("delete", "/api/assets/:id", other, {}, { id: account.id }, { confirmAllocations: "true" })).code, 404);
      assert.equal((await call("delete", "/api/assets/:id", owner, {}, { id: account.id }, { confirmAllocations: "true" })).code, 204);
      assert.equal((await funding()).current_amount, "150.00", "account deletion releases linked funding only");
      assert.deepEqual((await client.query("SELECT payload FROM budget_month_closes WHERE user_id=$1", [owner])).rows[0].payload, snapshot);
      const { rows: [cash] } = await client.query("INSERT INTO assets(user_id,name,category,value) VALUES($1,'Savings','Savings Account',1000) RETURNING id", [owner]);
      await saveAllocation(pool, owner, { assetId: cash.id, goalId: goal.id, amount: 100 });
      assert.equal((await call("delete", "/api/goals/:id", owner, {}, { id: goal.id })).code, 409);
      assert.equal((await call("delete", "/api/goals/:id", owner, {}, { id: goal.id }, { confirmAllocations: "true" })).code, 204);
      assert.equal((await client.query("SELECT id FROM goal_allocations WHERE user_id=$1 AND goal_id=$2", [owner, goal.id])).rowCount, 0);
      const { rows: [bank] } = await client.query("INSERT INTO plaid_items(user_id,access_token,item_id) VALUES($1,'fixture-not-a-real-token',$2) RETURNING id", [owner, randomUUID()]);
      await client.query(`INSERT INTO plaid_accounts(user_id,plaid_item_id,plaid_account_id,name,type,linked_asset_id)
        VALUES($1,$2,$3,'Linked savings','depository',$4)`, [owner, bank.id, randomUUID(), cash.id]);
      await saveAllocation(pool, owner, { assetId: cash.id, goalId: goal2.id, amount: 200 });
      const refused = await call("delete", "/api/plaid/items/:id", owner, {}, { id: bank.id });
      assert.equal(refused.code, 409, "disconnect requires confirmation before deleting allocations or contacting Plaid");
      assert.match(refused.body.message, /reducing goal funding/);
      assert.equal((await client.query("SELECT id FROM assets WHERE user_id=$1 AND id=$2", [owner, cash.id])).rowCount, 1);
      assert.equal((await call("delete", "/api/plaid/items/:id", other, {}, { id: bank.id }, { confirmAllocations: "true" })).code, 404);
      // Exercise the confirmed local transaction without sending a test token to Plaid.
      await deletePlaidConnection(pool, owner, bank.id, true);
      assert.equal((await client.query("SELECT id FROM assets WHERE user_id=$1 AND id=$2", [owner, cash.id])).rowCount, 0);
      assert.equal((await client.query("SELECT id FROM goal_allocations WHERE user_id=$1 AND asset_id=$2", [owner, cash.id])).rowCount, 0);
      assert.equal((await client.query("SELECT id FROM plaid_items WHERE user_id=$1 AND id=$2", [owner, bank.id])).rowCount, 0);
      assert.equal((await client.query("SELECT current_amount FROM goal_funding WHERE user_id=$1 AND id=$2", [owner, goal2.id])).rows[0].current_amount, "0.00");
      assert.deepEqual((await client.query("SELECT payload FROM budget_month_closes WHERE user_id=$1", [owner])).rows[0].payload, snapshot);
    } finally { client.release(); }
  } finally {
    await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[owner, other]]);
    await pool.end();
  }
});
