import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { pool } from "./db";
import { ensureTransactionImportSchema } from "./transaction-import-schema";
import { checkUserTransactionDuplicates, saveDuplicateSafeImport } from "./transaction-duplicates";
import { validateReviewedTransactionEntries } from "./transaction-import";
import type { TransactionImportEntry } from "../shared/transaction-import";

test("normal bootstrap upgrades an existing legacy database without losing rows; preview and reviewed save then work", async () => {
  const client = await pool.connect();
  const schema = `import_schema_test_${randomUUID().replace(/-/g, "")}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY, user_id VARCHAR NOT NULL, date DATE NOT NULL,
        description TEXT NOT NULL, merchant TEXT, amount NUMERIC(12,2) NOT NULL,
        type TEXT NOT NULL, parent_category TEXT, subcategory TEXT NOT NULL DEFAULT 'unassigned',
        needs_want TEXT, is_recurring BOOLEAN DEFAULT FALSE, recurring_type TEXT, source TEXT NOT NULL,
        notes TEXT
      );
      INSERT INTO transactions (user_id,date,description,merchant,amount,type,source)
        VALUES ('legacy-user','2026-08-01','Legacy shop','Legacy shop',1.00,'expense','upload');
    `);
    const entry: TransactionImportEntry = {
      id: 1, date: "2026-08-02", description: "New shop", merchant: "New shop", amount: "2.01",
      type: "expense", parentCategory: "", subcategory: "", needsWant: "na",
      isRecurring: false, recurringType: "", notes: "", sourceTransactionId: "source-1", include: true,
    };
    await assert.rejects(checkUserTransactionDuplicates(client, "legacy-user", [entry]),
      (error: any) => error.code === "42703", "legacy preview needs the additive schema");
    const database = { connect: async () => ({ query: client.query.bind(client), release() {} }) };
    await ensureTransactionImportSchema(database);
    await ensureTransactionImportSchema(database); // An already upgraded database is also safe.
    assert.equal((await client.query("SELECT count(*)::int AS count FROM transactions")).rows[0].count, 1);
    const preview = await checkUserTransactionDuplicates(client, "legacy-user", [entry]);
    assert.equal(preview[0].duplicate, undefined);
    const validation = validateReviewedTransactionEntries(preview, []);
    assert.deepEqual(validation.errors, []);
    const requestId = randomUUID();
    const saved = await saveDuplicateSafeImport(client, "legacy-user", requestId, preview, validation.transactions);
    assert.equal(saved.inserted, 1);
    assert.deepEqual(await saveDuplicateSafeImport(client, "legacy-user", requestId, preview, validation.transactions), saved);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM transactions")).rows[0].count, 2);
    assert.equal((await checkUserTransactionDuplicates(client, "legacy-user", [entry]))[0].duplicate?.kind, "stable");
    assert.equal((await client.query("SELECT count(*)::int AS count FROM transaction_import_receipts")).rows[0].count, 1);
  } finally {
    await client.query("ROLLBACK");
    await client.query("RESET search_path");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release();
    await pool.end();
  }
});
