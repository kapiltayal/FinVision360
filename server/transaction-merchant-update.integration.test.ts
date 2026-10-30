import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { requireAuth } from "./auth";
import { pool } from "./db";
import { registerFinanceTrackerRoutes } from "./finance-tracker-routes";

test("merchant-wide category and Need / Want updates succeed together", {
  skip: process.env.RUN_DB_TESTS !== "1",
}, async () => {
  const routes = new Map<string, any[]>();
  const app = Object.fromEntries(["get", "post", "put", "patch", "delete"].map(method => [
    method,
    (path: string, ...handlers: any[]) => routes.set(`${method} ${path}`, handlers),
  ])) as any;
  registerFinanceTrackerRoutes(app);

  const userId = randomUUID();
  const { rows: educationRows } = await pool.query(
    `SELECT parent_category, category, need_vs_want
     FROM transaction_type_list
     WHERE lower(type)='expense' AND lower(category)='education'
     ORDER BY id LIMIT 1`,
  );
  assert.ok(educationRows[0], "the canonical expense Education category is available");
  const education = educationRows[0];
  const needWant = ["need", "want"].includes(String(education.need_vs_want ?? "").toLowerCase())
    ? String(education.need_vs_want).toLowerCase()
    : "na";

  try {
    await pool.query("INSERT INTO users(id) VALUES ($1)", [userId]);
    const { rows: transactions } = await pool.query(
      `INSERT INTO transactions
         (user_id, date, description, merchant, amount, type, subcategory, needs_want)
       VALUES
         ($1, '2026-08-14', 'GLENBROOK 225', 'GLENBROOK 225', 20, 'expense', 'unassigned', 'na'),
         ($1, '2026-07-14', 'GLENBROOK 225', 'GLENBROOK 225', 25, 'expense', 'unassigned', 'na')
       RETURNING id`,
      [userId],
    );

    const handlers = routes.get("patch /api/transactions/:id");
    assert.ok(handlers, "transaction edit route is registered");
    assert.equal(handlers[0], requireAuth, "the route remains authentication-protected");

    const response: any = {
      statusCode: 200,
      body: undefined,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    await handlers.at(-1)({
      user: { id: userId },
      route: { path: "/api/transactions/:id" },
      params: { id: String(transactions[0].id) },
      query: {},
      body: {
        type: "expense",
        subcategory: education.category,
        parentCategory: education.parent_category,
        needsWant: needWant,
        applyToMerchant: true,
        merchantFields: ["subcategory", "needsWant"],
      },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.updatedCount, 2);
    const { rows: updatedRows } = await pool.query(
      `SELECT parent_category, subcategory, needs_want
       FROM transactions
       WHERE user_id=$1
       ORDER BY date`,
      [userId],
    );
    assert.deepEqual(updatedRows, [
      { parent_category: education.parent_category, subcategory: education.category, needs_want: needWant },
      { parent_category: education.parent_category, subcategory: education.category, needs_want: needWant },
    ]);
  } finally {
    await pool.query("DELETE FROM transaction_change_history WHERE user_id=$1", [userId]);
    await pool.query("DELETE FROM transactions WHERE user_id=$1", [userId]);
    await pool.query("DELETE FROM users WHERE id=$1", [userId]);
  }
});
