import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Express } from "express";
import { requireAuth } from "./auth";
import { registerRoutes } from "./routes";
import { pool } from "./db";

test("financial APIs isolate transaction, budget, asset, and liability reads and writes by authenticated user", {
  skip: process.env.RUN_DB_TESTS !== "1",
}, async () => {
  const handlers = new Map<string, Function[]>();
  const app: any = { use() {}, set() {} };
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    app[method] = (path: string, ...callbacks: Function[]) => handlers.set(`${method} ${path}`, callbacks);
  }
  await registerRoutes(createServer(), app as Express);

  const userA = randomUUID();
  const userB = randomUUID();
  const userIds = [userA, userB];
  const month = new Date().toISOString().slice(0, 7);
  const periodMonth = `${month}-01`;
  const call = async (
    method: string,
    path: string,
    userId: string,
    options: { params?: Record<string, string>; query?: Record<string, string>; body?: Record<string, unknown> } = {},
  ) => {
    const callbacks = handlers.get(`${method} ${path}`);
    assert.ok(callbacks, `registered handler ${method} ${path}`);
    assert.equal(callbacks[0], requireAuth, `${method} ${path} remains authentication-protected`);
    const response: any = {
      code: 200,
      body: undefined,
      status(code: number) { this.code = code; return this; },
      json(body: unknown) { this.body = body; return this; },
      send(body?: unknown) { this.body = body; return this; },
    };
    // Supply the local identity that requireAuth adds after verifying the Supabase token.
    // Invoke only the final route handler so the test isolates ownership authorization.
    await callbacks[callbacks.length - 1]({
      user: { id: userId }, params: options.params ?? {}, query: options.query ?? {}, body: options.body ?? {},
    }, response);
    return response;
  };

  let assetAId: number;
  let assetBId: number;
  let liabilityAId: number;
  let liabilityBId: number;
  let transactionAId: number;
  let transactionBId: number;
  try {
    await pool.query("INSERT INTO users(id) VALUES ($1), ($2)", userIds);
    const { rows: assets } = await pool.query(
      `INSERT INTO assets(user_id, name, category, value) VALUES
       ($1, 'Owner A asset', 'Cash', 1000), ($2, 'Owner B asset', 'Cash', 2000)
       RETURNING id, user_id`,
      userIds,
    );
    assetAId = assets.find((row) => row.user_id === userA)!.id;
    assetBId = assets.find((row) => row.user_id === userB)!.id;

    const { rows: liabilities } = await pool.query(
      `INSERT INTO liabilities(user_id, name, category, balance) VALUES
       ($1, 'Owner A liability', 'Credit Card', 100), ($2, 'Owner B liability', 'Loan', 200)
       RETURNING id, user_id`,
      userIds,
    );
    liabilityAId = liabilities.find((row) => row.user_id === userA)!.id;
    liabilityBId = liabilities.find((row) => row.user_id === userB)!.id;

    const { rows: transactions } = await pool.query(
      `INSERT INTO transactions(user_id, date, description, merchant, amount, type, subcategory, needs_want) VALUES
       ($1, $3::date, 'Owner A transaction', 'Shared ownership merchant', 111, 'expense', 'owner-a-only', 'need'),
       ($2, $3::date, 'Owner B transaction', 'Shared ownership merchant', 222, 'expense', 'owner-b-only', 'need')
       RETURNING id, user_id`,
      [userA, userB, `${month}-10`],
    );
    transactionAId = transactions.find((row) => row.user_id === userA)!.id;
    transactionBId = transactions.find((row) => row.user_id === userB)!.id;

    await pool.query(
      `INSERT INTO budget_plans(user_id, month, plan_key, planned_amount) VALUES
       ($1, $3::date, 'expense:shared', 100), ($2, $3::date, 'expense:shared', 200),
       ($1, $3::date, 'expense:owner-a-only', 50), ($1, $3::date, 'expense:bulk-shared', 10)`,
      [userA, userB, periodMonth],
    );

    for (const [userId, expectedAsset, foreignAsset] of [
      [userA, "Owner A asset", "Owner B asset"],
      [userB, "Owner B asset", "Owner A asset"],
    ]) {
      const response = await call("get", "/api/assets", userId);
      assert.deepEqual(response.body.map((row: any) => row.name), [expectedAsset]);
      assert.equal(response.body.some((row: any) => row.name === foreignAsset), false);
    }
    const refusedAssetEdit = await call("patch", "/api/assets/:id", userB, {
      params: { id: String(assetAId) }, body: { name: "Stolen asset", userId: userA },
    });
    assert.equal(refusedAssetEdit.code, 404);
    const refusedAssetDelete = await call("delete", "/api/assets/:id", userB, { params: { id: String(assetAId) } });
    assert.equal(refusedAssetDelete.code, 404);
    assert.equal((await pool.query("SELECT name FROM assets WHERE id=$1 AND user_id=$2", [assetAId, userA])).rows[0].name, "Owner A asset");
    assert.equal((await call("patch", "/api/assets/:id", userA, {
      params: { id: String(assetAId) }, body: { name: "Owner A updated asset" },
    })).code, 200);
    assert.equal((await call("delete", "/api/assets/:id", userA, { params: { id: String(assetAId) } })).code, 204);
    assert.equal((await pool.query("SELECT id FROM assets WHERE id=$1", [assetAId])).rowCount, 0);
    assert.equal((await pool.query("SELECT id FROM assets WHERE id=$1 AND user_id=$2", [assetBId, userB])).rowCount, 1);

    for (const [userId, expectedLiability] of [
      [userA, "Owner A liability"], [userB, "Owner B liability"],
    ]) {
      const response = await call("get", "/api/liabilities", userId);
      assert.deepEqual(response.body.map((row: any) => row.name), [expectedLiability]);
    }
    assert.equal((await call("patch", "/api/liabilities/:id", userA, {
      params: { id: String(liabilityBId) }, body: { name: "Stolen liability" },
    })).code, 404);
    assert.equal((await call("delete", "/api/liabilities/:id", userA, { params: { id: String(liabilityBId) } })).code, 404);
    assert.equal((await pool.query("SELECT name FROM liabilities WHERE id=$1 AND user_id=$2", [liabilityBId, userB])).rows[0].name, "Owner B liability");
    assert.equal((await call("patch", "/api/liabilities/:id", userB, {
      params: { id: String(liabilityBId) }, body: { name: "Owner B updated liability" },
    })).code, 200);
    assert.equal((await pool.query("SELECT name FROM liabilities WHERE id=$1 AND user_id=$2", [liabilityBId, userB])).rows[0].name, "Owner B updated liability");

    const budgetA = await call("get", "/api/budget-plan", userA, { query: { month } });
    const budgetB = await call("get", "/api/budget-plan", userB, { query: { month } });
    assert.deepEqual(budgetA.body.plans.map((row: any) => row.planKey).sort(), [
      "expense:bulk-shared", "expense:owner-a-only", "expense:shared",
    ]);
    assert.deepEqual(budgetB.body.plans.map((row: any) => row.planKey), ["expense:shared"]);
    assert.deepEqual(budgetA.body.actuals.map((row: any) => row.category), ["owner-a-only"]);
    assert.deepEqual(budgetB.body.actuals.map((row: any) => row.category), ["owner-b-only"]);
    assert.deepEqual(budgetA.body.liabilities.map((row: any) => row.name), ["Owner A liability"]);
    assert.deepEqual(budgetB.body.liabilities.map((row: any) => row.name), ["Owner B updated liability"]);
    assert.equal((await call("delete", "/api/liabilities/:id", userB, { params: { id: String(liabilityBId) } })).code, 204);
    assert.equal((await pool.query("SELECT id FROM liabilities WHERE id=$1", [liabilityBId])).rowCount, 0);
    assert.equal((await pool.query("SELECT id FROM liabilities WHERE id=$1 AND user_id=$2", [liabilityAId, userA])).rowCount, 1);

    assert.equal((await call("delete", "/api/budget-plan", userB, {
      query: { month, planKey: "expense:owner-a-only" },
    })).code, 404);
    assert.equal((await call("put", "/api/budget-plan", userB, {
      body: { month, planKey: "expense:shared", plannedAmount: 250, userId: userA },
    })).code, 200);
    const { rows: sharedPlans } = await pool.query(
      "SELECT user_id, planned_amount FROM budget_plans WHERE month=$1::date AND plan_key='expense:shared' AND user_id=ANY($2::varchar[])",
      [periodMonth, userIds],
    );
    assert.deepEqual(sharedPlans.map((row) => [row.user_id, Number(row.planned_amount)]).sort(), [
      [userA, 100], [userB, 250],
    ].sort(), "an upsert with another user's ID in the request body only changes the authenticated caller's row");

    assert.equal((await call("put", "/api/budget-plan/bulk", userB, {
      body: { month, bulk: true, plans: [{ planKey: "expense:bulk-shared", plannedAmount: 999, userId: userA }] },
    })).code, 200);
    const { rows: bulkPlans } = await pool.query(
      "SELECT user_id, planned_amount FROM budget_plans WHERE month=$1::date AND plan_key='expense:bulk-shared' AND user_id=ANY($2::varchar[])",
      [periodMonth, userIds],
    );
    assert.deepEqual(bulkPlans.map((row) => [row.user_id, Number(row.planned_amount)]).sort(), [
      [userA, 10], [userB, 999],
    ].sort());
    assert.equal((await call("delete", "/api/budget-plan", userB, {
      query: { month, planKey: "expense:bulk-shared" },
    })).code, 204);
    assert.equal((await pool.query(
      "SELECT planned_amount FROM budget_plans WHERE user_id=$1 AND month=$2::date AND plan_key='expense:bulk-shared'",
      [userA, periodMonth],
    )).rows[0].planned_amount, "10.00");

    for (const [userId, expectedDescription, foreignDescription] of [
      [userA, "Owner A transaction", "Owner B transaction"],
      [userB, "Owner B transaction", "Owner A transaction"],
    ]) {
      const response = await call("get", "/api/transactions", userId);
      assert.deepEqual(response.body.map((row: any) => row.description), [expectedDescription]);
      assert.equal(response.body.some((row: any) => row.description === foreignDescription), false);
    }
    const statsA = await call("get", "/api/transactions/stats", userA);
    const statsB = await call("get", "/api/transactions/stats", userB);
    assert.equal(Number(statsA.body.total_expenses), 111);
    assert.equal(Number(statsB.body.total_expenses), 222);
    const refusedTransactionEdit = await call("patch", "/api/transactions/:id", userB, {
      params: { id: String(transactionAId) }, body: { notes: "Cross-user edit", userId: userA },
    });
    assert.equal(refusedTransactionEdit.code, 404);
    assert.equal((await call("delete", "/api/transactions/:id", userB, {
      params: { id: String(transactionAId) },
    })).code, 404);
    assert.equal((await pool.query("SELECT notes FROM transactions WHERE id=$1 AND user_id=$2", [transactionAId, userA])).rows[0].notes, null);

    const { rows: companion } = await pool.query(
      `INSERT INTO transactions(user_id, date, description, merchant, amount, type, subcategory, needs_want)
       VALUES ($1, $2::date, 'Owner A companion', 'Shared ownership merchant', 33, 'expense', 'owner-a-only', 'need')
       RETURNING id`,
      [userA, `${month}-10`],
    );
    const merchantEdit = await call("patch", "/api/transactions/:id", userA, {
      params: { id: String(transactionAId) },
      body: { needsWant: "want", applyToMerchant: true, merchantFields: ["needsWant"], userId: userB },
    });
    assert.equal(merchantEdit.code, 200);
    assert.equal(merchantEdit.body.updatedCount, 2);
    assert.deepEqual((await pool.query(
      "SELECT needs_want FROM transactions WHERE user_id=$1 AND id=ANY($2::int[])",
      [userA, [transactionAId, companion[0].id]],
    )).rows.map((row) => row.needs_want), ["want", "want"]);
    assert.equal((await pool.query(
      "SELECT needs_want FROM transactions WHERE user_id=$1 AND id=$2",
      [userB, transactionBId],
    )).rows[0].needs_want, "need", "merchant-wide edits never touch the same merchant in another user's book");
    assert.equal((await pool.query(
      "SELECT id FROM transaction_change_history WHERE user_id=$1", [userB],
    )).rowCount, 0, "merchant-wide edits do not add another user's audit entries");

    assert.equal((await call("patch", "/api/transactions/:id", userA, {
      params: { id: String(transactionAId) }, body: { notes: "Owner A edit" },
    })).code, 200);
    assert.equal((await pool.query("SELECT notes FROM transactions WHERE id=$1 AND user_id=$2", [transactionAId, userA])).rows[0].notes, "Owner A edit");
    assert.equal((await call("delete", "/api/transactions/:id", userA, {
      params: { id: String(transactionAId) },
    })).code, 204);
    assert.equal((await pool.query("SELECT id FROM transactions WHERE id=$1", [transactionAId])).rowCount, 0);
    assert.equal((await pool.query("SELECT id FROM transactions WHERE id=$1 AND user_id=$2", [transactionBId, userB])).rowCount, 1);

    const ownerBudgetDeleted = await call("delete", "/api/budget-plan", userA, {
      query: { month, planKey: "expense:owner-a-only" },
    });
    assert.equal(ownerBudgetDeleted.code, 204);
    assert.equal((await pool.query(
      "SELECT id FROM budget_plans WHERE user_id=$1 AND month=$2::date AND plan_key='expense:owner-a-only'",
      [userA, periodMonth],
    )).rowCount, 0);
    assert.equal((await call("delete", "/api/budget-plan", userB, {
      query: { month, planKey: "expense:shared" },
    })).code, 204);
    assert.deepEqual((await pool.query(
      "SELECT user_id, planned_amount FROM budget_plans WHERE month=$1::date AND plan_key='expense:shared' AND user_id=ANY($2::varchar[])",
      [periodMonth, userIds],
    )).rows.map((row) => [row.user_id, Number(row.planned_amount)]), [[userA, 100]]);
  } finally {
    await pool.query("DELETE FROM transaction_change_history WHERE user_id=ANY($1::varchar[])", [userIds]);
    await pool.query("DELETE FROM transactions WHERE user_id=ANY($1::varchar[])", [userIds]);
    await pool.query("DELETE FROM budget_plans WHERE user_id=ANY($1::varchar[])", [userIds]);
    await pool.query("DELETE FROM assets WHERE user_id=ANY($1::varchar[])", [userIds]);
    await pool.query("DELETE FROM liabilities WHERE user_id=ANY($1::varchar[])", [userIds]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [userIds]);
    await pool.end();
  }
});
