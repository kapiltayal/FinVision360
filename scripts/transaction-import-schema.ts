import { pool } from "../server/db";
import { ensureTransactionImportSchema } from "../server/transaction-import-schema";

// Narrow, additive migration: do not run a broad schema push against unrelated drift.
async function main() {
  await ensureTransactionImportSchema(pool);
  console.log("Transaction import duplicate protection schema is ready.");
}
main().catch(error => {
  console.error("Transaction import schema migration failed:", error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
