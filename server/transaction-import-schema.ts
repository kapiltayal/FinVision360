export const transactionImportSchemaSql = `
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS upload_source_id TEXT;
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS upload_source_account TEXT;
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS upload_identity TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_upload_unique
    ON transactions(user_id, upload_identity) WHERE upload_identity IS NOT NULL;
  CREATE TABLE IF NOT EXISTS transaction_import_receipts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    request_id VARCHAR(36) NOT NULL,
    payload_hash TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_import_receipt_unique
    ON transaction_import_receipts(user_id, request_id);
`;

/** Part of the application's existing schema bootstrap, before any routes serve. */
export async function ensureTransactionImportSchema(database: {
  connect(): Promise<{ query(sql: string, values?: any[]): Promise<any>; release(): void }>;
}): Promise<void> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    // Serialize concurrent cold starts so CREATE TABLE/INDEX cannot race.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('transaction-import-schema',0))");
    await client.query(transactionImportSchemaSql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
