import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "./db";
import { detectAndMarkRecurring, detectPreviewRecurrence } from "./recurrence-ingestion";
import { transactionEntryFromSource, validateReviewedTransactionEntries, saveReviewedTransactionBatch } from "./transaction-import";

test("preview is read-only, merges owned history, excludes duplicates, and saved review overrides remain authoritative", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE merchants (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL,
        is_known_subscription BOOLEAN DEFAULT FALSE, is_known_recurring BOOLEAN DEFAULT FALSE
      ) ON COMMIT DROP;
      CREATE TEMP TABLE transactions (
        id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, date DATE NOT NULL,
        description TEXT NOT NULL, merchant TEXT, amount NUMERIC NOT NULL, type TEXT NOT NULL,
        parent_category TEXT, subcategory TEXT, needs_want TEXT, notes TEXT,
        upload_source_id TEXT, upload_source_account TEXT, upload_identity TEXT,
        source TEXT DEFAULT 'upload', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
        is_user_modified BOOLEAN NOT NULL DEFAULT FALSE,
        is_recurring BOOLEAN DEFAULT FALSE, recurring_type TEXT, recurring_freq TEXT DEFAULT NULL
      ) ON COMMIT DROP;
      CREATE TEMP TABLE transaction_change_history (
        id SERIAL PRIMARY KEY, user_id TEXT, transaction_id INTEGER, field TEXT,
        old_value TEXT, new_value TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      ) ON COMMIT DROP;
      INSERT INTO merchants (id,name,is_known_subscription) VALUES (1,'Spotify',TRUE);
      INSERT INTO transactions (user_id,date,description,merchant,amount,type) VALUES
        ('alice','2026-01-01','Acme','Acme',100,'expense'),
        ('alice','2026-02-01','Acme','Acme',100,'expense'),
        ('bob','2026-03-01','Acme','Acme',500,'expense'),
        ('alice','2026-01-01','Sparse','Sparse',100,'expense');
    `);
    const entry = (id: number, merchant: string, date: string) =>
      transactionEntryFromSource({ date, merchant, description: merchant, amount: 100, type: "expense" }, id);
    const preview = await detectPreviewRecurrence(client, "alice", [
      entry(1, "Acme", "2026-03-01"),
      entry(2, "Sparse", "2026-02-01"),
      { ...entry(3, "Sparse", "2026-03-01"), include: false },
      entry(4, "Spotify", "2026-01-01"),
    ]);
    assert.equal(preview[0].recurringType, "subscription");
    assert.equal(preview[0].recurringFreq, "Monthly");
    assert.equal(preview[1].isRecurring, false, "an excluded duplicate must not be a third observation");
    assert.equal(preview[2].isRecurring, false);
    assert.equal(preview[3].recurringType, "subscription", "catalog-only signal needs no history");
    assert.equal((await client.query("SELECT count(*)::int AS count FROM transactions")).rows[0].count, 4);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM transactions WHERE is_recurring")).rows[0].count, 0);
    const forBob = await detectPreviewRecurrence(client, "bob", [entry(1, "Acme", "2026-04-01")]);
    assert.equal(forBob[0].isRecurring, false, "other users' history must not supply observations");

    const prepared = validateReviewedTransactionEntries([preview[0]], []);
    assert.deepEqual(prepared.errors, []);
    await saveReviewedTransactionBatch(client, "alice", prepared.transactions, false);
    assert.equal(await detectAndMarkRecurring(client, "alice", {
      targetIds: [5], providerSignals: new Map([[5, {
        isRecurring: true, recurringType: "recurring_bill", recurringFreq: "Quarterly",
      }]]),
    }), 0, "already saved merchant tags beat a conflicting provider signal");
    const saved = (await client.query("SELECT * FROM transactions WHERE id=5")).rows[0];
    assert.equal(saved.recurring_type, "subscription");
    assert.equal(saved.recurring_freq, "Monthly");
    assert.equal((await client.query("SELECT is_recurring FROM transactions WHERE id=1")).rows[0].is_recurring, true,
      "saving reviewed positive tags backfills matching historical rows");
    assert.equal((await client.query("SELECT recurring_freq FROM transactions WHERE id=2")).rows[0].recurring_freq, "Monthly");
    assert.equal((await client.query("SELECT is_recurring FROM transactions WHERE id=4")).rows[0].is_recurring, false,
      "unrelated merchants remain untouched");

    const reviewed = { ...entry(1, "Acme", "2026-04-01"), recurrenceOverride: true };
    const reviewedPrepared = validateReviewedTransactionEntries([reviewed], []);
    await saveReviewedTransactionBatch(client, "alice", reviewedPrepared.transactions, false);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM transaction_change_history")).rows[0].count, 3);
    assert.equal((await client.query("SELECT is_user_modified FROM transactions WHERE id=6")).rows[0].is_user_modified, true);
    const nextPreview = await detectPreviewRecurrence(client, "alice", [entry(1, "Acme", "2026-05-01")]);
    assert.equal(nextPreview[0].isRecurring, false, "reviewer's negative choice wins over a regular cadence");
    assert.equal(await detectAndMarkRecurring(client, "alice", { targetIds: [5] }), 3);
    assert.equal((await client.query("SELECT recurring_freq FROM transactions WHERE id=5")).rows[0].recurring_freq, null);
    assert.equal(await detectAndMarkRecurring(client, "alice", { targetIds: [5] }), 0, "detection is idempotent");
    assert.equal((await client.query("SELECT is_recurring FROM transactions WHERE id=3")).rows[0].is_recurring, false);

    const { rows: bills } = await client.query(`
      INSERT INTO transactions (user_id,date,description,merchant,amount,type,is_user_modified) VALUES
        ('alice','2026-01-01','Utility','Utility',100,'expense',FALSE),
        ('alice','2026-02-01','Utility','Utility',150,'expense',FALSE),
        ('alice','2026-03-01','Utility','Utility',200,'expense',TRUE)
      RETURNING id`);
    assert.equal(await detectAndMarkRecurring(client, "alice", {
      targetIds: [bills[1].id], providerSignals: new Map([[bills[1].id, {
        isRecurring: true, recurringType: "recurring_bill", recurringFreq: "Monthly",
      }]]),
    }), 2, "a Plaid signal must backfill older matching history, not only the imported row");
    const { rows: updatedBills } = await client.query("SELECT * FROM transactions WHERE merchant='Utility' ORDER BY id");
    assert.ok(updatedBills.slice(0, 2).every(row => row.is_recurring &&
      row.recurring_type === "recurring_bill" && row.recurring_freq === "Monthly"));
    assert.equal(updatedBills[2].is_recurring, false, "existing user-modified rows remain protected");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
