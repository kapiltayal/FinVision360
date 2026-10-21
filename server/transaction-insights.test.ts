import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { registerFinanceTrackerRoutes } from "./finance-tracker-routes";
import { pool } from "./db";

test("spending insights return per-merchant recurring bill averages, scoped to the requested user and period", async () => {
  const userId = `transaction-insights-${randomUUID()}`;
  const routes = new Map<string, any[]>();
  const app = Object.fromEntries(["get", "post", "put", "patch", "delete"].map(method =>
    [method, (path: string, ...handlers: any[]) => routes.set(`${method} ${path}`, handlers)]));
  registerFinanceTrackerRoutes(app as any);
  try {
    await pool.query(
      `INSERT INTO transactions (user_id,date,description,merchant,amount,type,subcategory,needs_want,is_recurring,recurring_type,source)
       VALUES
       ($1,'2026-03-05','Electric bill','Electric Co',40,'expense','utilities','need',TRUE,'recurring_bill','manual'),
       ($1,'2026-03-20','Electric bill','Electric Co',60,'expense','utilities','need',TRUE,'recurring_bill','manual'),
       ($1,'2026-03-10','Phone','Mobile Co',50,'expense','utilities','want',TRUE,'subscription','manual'),
       ($1,'2026-03-10','Salary','Electric Co',90,'income','salary','na',TRUE,'recurring_bill','manual'),
       ($2,'2026-03-10','Electric bill','Electric Co',300,'expense','utilities','need',TRUE,'recurring_bill','manual')`,
      [userId, `${userId}-other`],
    );
    const response = {
      statusCode: 200,
      body: undefined as any,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; return this; },
    };
    const handlers = routes.get("get /api/transactions/insights")!;
    await handlers[handlers.length - 1]({ user: { id: userId }, query: { startDate: "2026-03-01", endDate: "2026-03-31" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.recurringBills.count, "1");
    assert.equal(Number(response.body.recurringBills.total), 100);
    assert.equal(response.body.recurringBills.items.length, 1);
    assert.equal(response.body.recurringBills.items[0].name, "Electric Co");
    assert.equal(Number(response.body.recurringBills.items[0].charge_count), 2);
    assert.equal(Number(response.body.recurringBills.items[0].average_amount), 50);
    assert.equal(response.body.subscriptions.count, "1", "the existing subscription view remains separate");
  } finally {
    await pool.query("DELETE FROM transactions WHERE user_id=ANY($1::varchar[])", [[userId, `${userId}-other`]]);
  }
});
