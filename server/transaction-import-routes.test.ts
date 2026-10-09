import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { registerFinanceTrackerRoutes } from "./finance-tracker-routes";
import { requireAuth } from "./auth";
import { pool } from "./db";

test("file handlers emit real ordered stages, preserve review on failures, scope data and block legacy bypasses", async () => {
  const routes = new Map<string, any[]>();
  const app = Object.fromEntries(["get", "post", "put", "patch", "delete"].map(method =>
    [method, (path: string, ...handlers: any[]) => routes.set(`${method} ${path}`, handlers)]));
  registerFinanceTrackerRoutes(app as any);
  const userId = `import-route-test-${randomUUID()}`;
  const otherUser = `import-route-test-${randomUUID()}`;
  const invoke = async (path: string, extra: any = {}) => {
    const handlers = routes.get(`post ${path}`)!;
    assert.equal(handlers[0], requireAuth, "all import paths retain authentication");
    const events: any[] = [];
    const response = {
      statusCode: 200, body: undefined as any, writableEnded: false,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; this.writableEnded = true; return this; },
      setHeader() {}, flushHeaders() {},
      write(text: string) { events.push(JSON.parse(text.trim())); return true; },
      end() { this.writableEnded = true; return this; },
    };
    // Invoke the handler with an authenticated request fixture; production middleware is unchanged.
    await handlers[handlers.length - 1]({ user: { id: userId }, query: {}, body: {}, ...extra }, response);
    return { ...response, events };
  };
  try {
    const count = async () => Number((await pool.query("SELECT count(*) FROM transactions WHERE user_id=$1", [userId])).rows[0].count);
    const category = (await pool.query("SELECT category,parent_category FROM transaction_type_list WHERE lower(type)='expense' LIMIT 1")).rows[0];
    assert.ok(category);
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = `Date,Description,Amount,Type,Category,Parent Category,Transaction ID,Account ID\n2026-08-01,Route test purchase,23.45,expense,${quote(category.category)},${quote(category.parent_category)},route-stable,checking\n`;
    const file = { originalname: "transactions.csv", mimetype: "text/csv", buffer: Buffer.from(csv) };
    const result = await invoke("/api/transactions/ingest/preview", { file, query: { progress: "1" } });
    assert.deepEqual(result.events.filter(e => e.stage).map(e => e.stage), ["validation", "processing", "duplicates", "review"]);
    const preview = result.events.find(e => e.preview).preview;
    assert.equal(preview.entries[0].subcategory, category.category, "categorization precedes duplicate review");
    assert.equal(preview.entries[0].sourceTransactionId, "route-stable");
    assert.equal(await count(), 0, "preview never persists transactions");

    const jsonPreview = await invoke("/api/transactions/ingest/preview", { file });
    assert.equal(jsonPreview.body.entries.length, 1, "non-streaming preview remains supported");
    const invalid = await invoke("/api/transactions/ingest/preview", {
      file: { ...file, mimetype: "image/png" }, query: { progress: "1" },
    });
    assert.equal(invalid.events[0].stage, "validation");
    assert.ok(invalid.events[1].error);
    assert.equal(invalid.events.length, 2, "validation failure does not pretend later stages ran");
    const corrupt = await invoke("/api/transactions/ingest/preview", {
      file: { ...file, buffer: Buffer.from("Date,Description,Amount\n") }, query: { progress: "1" },
    });
    assert.equal(corrupt.events[1].stage, "processing");
    assert.ok(corrupt.events[2].error);
    assert.equal(await count(), 0);

    const originalQuery = pool.query.bind(pool);
    (pool as any).query = (...args: any[]) => {
      if (String(args[0]).includes('upload_source_id AS "sourceTransactionId"')) throw new Error("simulated duplicate lookup failure");
      return originalQuery(...args as [any, any]);
    };
    const originalError = console.error;
    console.error = () => {};
    try {
      const failedLookup = await invoke("/api/transactions/ingest/preview", { file, query: { progress: "1" } });
      assert.deepEqual(failedLookup.events.filter(e => e.stage).map(e => e.stage), ["validation", "processing", "duplicates"]);
      assert.ok(failedLookup.events[failedLookup.events.length - 1].error);
    } finally {
      pool.query = originalQuery as any;
      console.error = originalError;
    }

    const requestId = randomUUID();
    const entries = preview.entries;
    const saved = await invoke("/api/transactions/import-reviewed", { body: { entries, requestId } });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.inserted, 1);
    const retry = await invoke("/api/transactions/import-reviewed", { body: { entries, requestId } });
    assert.deepEqual(retry.body, saved.body);
    assert.equal(await count(), 1);

    const check = await invoke("/api/transactions/import-reviewed/check", { body: { entries, userId: otherUser } });
    assert.equal(check.body.entries[0].duplicate.kind, "stable", "browser-supplied ownership is ignored");
    assert.equal(check.body.entries[0].include, false);
    const stale = await invoke("/api/transactions/import-reviewed", {
      body: { entries: entries.map((row: any) => ({ ...row, keepDuplicate: true })), requestId: randomUUID() },
    });
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.body.code, "DUPLICATES_CHANGED");
    const badRow = await invoke("/api/transactions/import-reviewed", {
      body: { entries: entries.map((row: any) => ({ ...row, date: "2026-02-30" })), requestId: randomUUID() },
    });
    assert.equal(badRow.statusCode, 422);
    assert.equal(await count(), 1, "finalization validation/conflicts never change the ledger");
    for (const path of ["/api/transactions/ingest", "/api/transactions/bulk"]) {
      const legacy = await invoke(path, { body: { transactions: entries }, file });
      assert.equal(legacy.statusCode, 409);
      assert.equal(legacy.body.code, "REVIEW_REQUIRED");
    }
    const singleBypass = await invoke("/api/transactions", { body: { ...entries[0], source: "upload" } });
    assert.equal(singleBypass.statusCode, 409);
    assert.equal(await count(), 1);
  } finally {
    await pool.query("DELETE FROM transaction_import_receipts WHERE user_id=$1", [userId]);
    await pool.query("DELETE FROM transactions WHERE user_id=$1", [userId]);
    await pool.end();
  }
});
