import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { registerFinanceTrackerRoutes } from "./finance-tracker-routes";
import { pool } from "./db";
import { requireAuth } from "./auth";

test("transaction category filter options are user-scoped and category filters include type and parent", async () => {
  const routes = new Map<string, any[]>();
  registerFinanceTrackerRoutes(Object.fromEntries(["get", "post", "put", "patch", "delete"].map(method =>
    [method, (path: string, ...handlers: any[]) => routes.set(`${method} ${path}`, handlers)])) as any);
  const userId = `transaction-filter-${randomUUID()}`;
  const otherUserId = `transaction-filter-other-${randomUUID()}`;
  const query = pool.query.bind(pool);

  const invoke = async (method: string, path: string, extra: any = {}) => {
    const handlers = routes.get(`${method} ${path}`)!;
    assert.equal(handlers[0], requireAuth);
    const response = {
      statusCode: 200,
      body: undefined as any,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; return this; },
    };
    await handlers.at(-1)({ user: { id: userId }, params: {}, body: {}, query: {}, ...extra }, response);
    return response;
  };

  try {
    const fixtures = [
      [userId, "income", "Earnings", "Salary / Wages", "income row"],
      [userId, "expense", "Food", "Shared Category", "food row"],
      [userId, "expense", "Personal", "Shared Category", "personal row"],
      [otherUserId, "expense", "Other", "Private Category", "other user's row"],
    ];
    for (const [owner, type, parent, category, description] of fixtures) {
      await query(
        `INSERT INTO transactions(user_id,date,description,amount,type,parent_category,subcategory,source)
         VALUES ($1,'2026-10-01',$2,10,$3,$4,$5,'manual')`,
        [owner, description, type, parent, category],
      );
    }

    const options = await invoke("get", "/api/transactions/filter-categories");
    assert.equal(options.statusCode, 200);
    assert.deepEqual(options.body.map((row: any) => row.type), ["income", "expense", "expense"]);
    assert.deepEqual(options.body.map((row: any) => row.parent_category), ["Earnings", "Food", "Personal"]);
    assert.ok(options.body.every((row: any) => row.subcategory !== "Private Category"),
      "another user's category must not appear");

    const filtered = await invoke("get", "/api/transactions", {
      query: {
        categoryType: "expense",
        categoryParent: "Food",
        categoryName: "Shared Category",
      },
    });
    assert.equal(filtered.statusCode, 200);
    assert.deepEqual(filtered.body.map((row: any) => row.description), ["food row"]);
  } finally {
    await query("DELETE FROM transactions WHERE user_id=ANY($1::text[])", [[userId, otherUserId]]);
  }
});
