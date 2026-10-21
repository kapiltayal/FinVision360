import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "./db";
import { detectAndMarkRecurring } from "./recurring-transactions";

test("database detection uses the merchant catalog, scopes each user, preserves manual choices and is idempotent", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Temporary tables shadow the real tables on this connection only.
    await client.query(`
      CREATE TEMP TABLE merchants (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, is_known_subscription BOOLEAN NOT NULL
      ) ON COMMIT DROP;
      CREATE TEMP TABLE transactions (
        id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, date DATE NOT NULL,
        description TEXT NOT NULL, merchant TEXT, amount NUMERIC NOT NULL, type TEXT NOT NULL,
        is_user_modified BOOLEAN NOT NULL DEFAULT FALSE,
        is_recurring BOOLEAN DEFAULT FALSE, recurring_type TEXT, recurring_freq TEXT DEFAULT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      ) ON COMMIT DROP;
      INSERT INTO merchants VALUES (1, 'Spotify', TRUE), (2, 'Power Company', FALSE), (3, 'Netflix', TRUE);
      INSERT INTO transactions (id, user_id, date, description, merchant, amount, type, is_user_modified) VALUES
        (1, 'alice', '2026-01-03', 'CARD 001', 'Spotify', 10, 'expense', FALSE),
        (2, 'alice', '2026-02-03', 'CARD 002', 'Spotify', 12, 'expense', FALSE),
        (3, 'alice', '2026-03-03', 'Manually corrected', 'Spotify', 15, 'expense', TRUE),
        (4, 'alice', '2026-01-03', 'Power Company 001', NULL, 45, 'expense', FALSE),
        (5, 'alice', '2026-02-03', 'Power Company 002', NULL, 65, 'expense', FALSE),
        (6, 'alice', '2026-01-03', 'Single retailer purchase', NULL, 50, 'expense', FALSE),
        (7, 'alice', '2026-01-03', 'Spotify', 'Spotify', 10, 'income', FALSE),
        (8, 'alice', '2026-02-03', 'Spotify', 'Spotify', 12, 'income', FALSE),
        (9, 'bob', '2026-01-03', 'Spotify', 'Spotify', 10, 'expense', FALSE),
        (10, 'bob', '2026-02-03', 'Spotify', 'Spotify', 12, 'expense', FALSE),
        (11, 'carol', '2026-01-03', 'Spotify', 'Spotify', 10, 'expense', FALSE),
        (12, 'alice', '2026-08-03', 'One-off Spotify purchase', 'Spotify', 12, 'expense', FALSE),
        (13, 'alice', '2026-01-03', 'PAYPAL NETFLIX ID 001', 'PAYPAL NETFLIX ID 001', 10, 'expense', FALSE),
        (14, 'alice', '2026-02-03', 'PAYPAL NETFLIX ID 002', 'PAYPAL NETFLIX ID 002', 12, 'expense', FALSE),
        (15, 'alice', '2026-01-03', 'BANK RETAIL STORE 001', 'BANK RETAIL STORE 001', 10, 'expense', FALSE),
        (16, 'alice', '2026-02-03', 'BANK RETAIL STORE 002', 'BANK RETAIL STORE 002', 20, 'expense', FALSE),
        (17, 'alice', '2026-03-03', 'CARD 003', 'Spotify', 13, 'expense', FALSE);
    `);
    assert.equal(await detectAndMarkRecurring(client, "alice"), 9);
    const { rows } = await client.query("SELECT id, is_recurring, recurring_type, recurring_freq FROM transactions ORDER BY id");
    for (const row of rows) {
      const expected = [1, 2, 13, 14, 17].includes(row.id) ? "subscription" : [4, 5, 15, 16].includes(row.id) ? "recurring_bill" : null;
      assert.equal(row.recurring_type, expected, `classification of row ${row.id}`);
      assert.equal(row.is_recurring, expected !== null, `recurrence of row ${row.id}`);
      assert.equal(row.recurring_freq, [1, 2, 17].includes(row.id) ? "Monthly" : null, `frequency of row ${row.id}`);
    }
    assert.equal(await detectAndMarkRecurring(client, "alice"), 0, "unchanged classifications are not counted again");
    assert.equal(await detectAndMarkRecurring(client, "bob"), 2);
    assert.equal(await detectAndMarkRecurring(client, "carol"), 0, "a catalog flag cannot make a single charge recurring");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
