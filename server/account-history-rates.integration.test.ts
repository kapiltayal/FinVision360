import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { snapshotAccountHistory } from "./monthly-backup";

test("account history preserves unknown, explicit zero, and nonzero rates", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const columns = await client.query(
      `SELECT table_name, is_nullable, column_default FROM information_schema.columns
       WHERE table_schema='public' AND table_name IN ('assets','liabilities','asset_history','liability_history')
       AND column_name='interest_rate'`,
    );
    assert.equal(columns.rowCount, 4);
    for (const column of columns.rows) {
      assert.equal(column.is_nullable, "YES", `${column.table_name} permits unknown rates`);
      assert.equal(column.column_default, null, `${column.table_name} must not default missing rates to zero`);
    }

    // Shadow the live tables only on this connection. No real account records,
    // history records, or public ID sequences are modified by this test.
    for (const table of ["assets", "liabilities", "asset_history", "liability_history"]) {
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS) ON COMMIT DROP`);
      await client.query(`ALTER TABLE pg_temp.${table} ALTER COLUMN id SET DEFAULT -1`);
    }
    await client.query(
      `INSERT INTO assets(id,user_id,name,category,value,interest_rate) VALUES
       (1,'history_rate_test','Unknown return','test',100,NULL),
       (2,'history_rate_test','Explicit zero return','test',200,0),
       (3,'history_rate_test','Known return','test',300,5.75)`,
    );
    await client.query(
      `INSERT INTO assets(id,user_id,name,category,value)
       VALUES (4,'history_rate_test','Omitted return','test',400)`,
    );
    await client.query(
      `INSERT INTO liabilities(id,user_id,name,category,balance,interest_rate) VALUES
       (1,'history_rate_test','Unknown APR','test',100,NULL),
       (2,'history_rate_test','Explicit zero APR','test',200,0),
       (3,'history_rate_test','Known APR','test',300,12.5)`,
    );
    await client.query(
      `INSERT INTO liabilities(id,user_id,name,category,balance)
       VALUES (4,'history_rate_test','Omitted APR','test',400)`,
    );

    const capturedAt = new Date("2030-02-01T00:05:00Z");
    assert.deepEqual(await snapshotAccountHistory(client, capturedAt), {
      assetsSnapshotted: 4, liabilitiesSnapshotted: 4,
    });
    for (const [table, sourceId, amount, expectedRates] of [
      ["asset_history", "asset_id", "value", [null, "0.00", "5.75", null]],
      ["liability_history", "liability_id", "balance", [null, "0.00", "12.50", null]],
    ] as const) {
      const history = await client.query(
        `SELECT interest_rate, snapshot_at FROM ${table} ORDER BY ${sourceId}`,
      );
      assert.deepEqual(history.rows.map((row) => row.interest_rate), expectedRates);
      assert.ok(history.rows.every((row) => row.snapshot_at.getTime() === capturedAt.getTime()));
      const omitted = await client.query(
        `INSERT INTO ${table}(user_id,${sourceId},name,category,${amount})
         VALUES ('history_rate_test',5,'Omitted historical rate','test',500) RETURNING interest_rate`,
      );
      assert.equal(omitted.rows[0].interest_rate, null);
    }
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
