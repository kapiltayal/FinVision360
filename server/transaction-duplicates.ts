import { createHash } from "node:crypto";
import type { TransactionImportEntry, TransactionImportResult } from "../shared/transaction-import";
import { detectTransactionDuplicates, stableSourceKey, type DuplicateCandidate } from "../shared/transaction-duplicates";
import { saveReviewedTransactionBatch, type PreparedReviewedTransaction } from "./transaction-import";

export interface ImportQueryClient {
  query(sql: string, values?: any[]): Promise<any>;
}

export class ImportConflict extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** The check endpoint tolerates unfinished financial fields, but never unbounded/malformed JSON. */
export function validDuplicateReview(entries: unknown): entries is TransactionImportEntry[] {
  if (!Array.isArray(entries) || entries.length > 500) return false;
  const ids = new Set<number>();
  return entries.every(row => {
    if (!row || !Number.isInteger(row.id) || ids.has(row.id)) return false;
    ids.add(row.id);
    return ["date", "description", "merchant", "amount", "type"].every(key =>
      typeof row[key] === "string" && row[key].length <= 2000) &&
      ["sourceTransactionId", "sourceAccount"].every(key =>
        row[key] === undefined || (typeof row[key] === "string" && row[key].length <= 256)) &&
      ["include", "keepDuplicate"].every(key => row[key] === undefined || typeof row[key] === "boolean");
  });
}

export async function checkUserTransactionDuplicates(
  client: ImportQueryClient, userId: string, entries: TransactionImportEntry[],
): Promise<TransactionImportEntry[]> {
  const dates = entries.map(e => e.date).filter(d =>
    /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d).sort();
  const amounts = Array.from(new Set(entries.map(e => Number(e.amount)).filter(n => Number.isFinite(n) && n > 0)));
  const identities = entries.map(stableSourceKey).filter((key): key is string => key !== null)
    .map(key => createHash("sha256").update(key).digest("hex"));
  const { rows } = await client.query(
    `SELECT id, to_char(date,'YYYY-MM-DD') AS date, amount::text, type, description,
            COALESCE(merchant,description) AS merchant,
            upload_source_id AS "sourceTransactionId", upload_source_account AS "sourceAccount"
     FROM transactions
     WHERE user_id=$1 AND (
       (date BETWEEN $2::date - 2 AND $3::date + 2 AND amount=ANY($4::numeric[]))
       OR upload_identity=ANY($5::text[])
     ) ORDER BY id`,
    [userId, dates[0] || null, dates[dates.length - 1] || null, amounts, identities],
  );
  return detectTransactionDuplicates(entries, rows as DuplicateCandidate[]);
}

/** User-scoped serialization + a durable receipt makes even an acknowledged-lost COMMIT retry safe. */
export async function saveDuplicateSafeImport(
  client: ImportQueryClient, userId: string, requestId: string,
  entries: TransactionImportEntry[], prepared: PreparedReviewedTransaction[],
): Promise<TransactionImportResult> {
  const selected = entries.filter(e => e.include !== false);
  const payloadHash = createHash("sha256").update(JSON.stringify({
    entries: selected.map(e => ({ id: e.id, keepDuplicate: e.keepDuplicate === true })),
    prepared, skipped: entries.length - selected.length,
  })).digest("hex");
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`transaction-file-import:${userId}`]);
    const receipt = await client.query(
      "SELECT payload_hash, result FROM transaction_import_receipts WHERE user_id=$1 AND request_id=$2", [userId, requestId],
    );
    if (receipt.rows.length) {
      if (receipt.rows[0].payload_hash !== payloadHash) {
        throw new ImportConflict("REQUEST_ID_REUSED", "This save request has already been used for different transactions. Review and try again.");
      }
      await client.query("COMMIT");
      return receipt.rows[0].result;
    }
    // Match the actual validated, normalized financial values we will insert.
    const candidates = selected.map((entry, i) => ({
      ...entry, date: prepared[i].date, amount: prepared[i].amount,
      merchant: prepared[i].merchant, description: prepared[i].description, type: prepared[i].type, include: true,
    }));
    const checked = await checkUserTransactionDuplicates(client, userId, candidates);
    if (checked.some(e => e.duplicate?.kind === "stable" || (e.duplicate && !e.keepDuplicate))) {
      throw new ImportConflict("DUPLICATES_CHANGED", "Duplicate matches need review. Nothing was saved; recheck the review and explicitly keep only separate real transactions.");
    }
    const saved = await saveReviewedTransactionBatch(client, userId, prepared, false);
    const skipped = entries.length - selected.length;
    const result: TransactionImportResult = { ...saved, skipped,
      skippedReasons: skipped ? { "Excluded in review": skipped } : {} };
    await client.query(
      "INSERT INTO transaction_import_receipts (user_id, request_id, payload_hash, result) VALUES ($1,$2,$3,$4::jsonb)",
      [userId, requestId, payloadHash, JSON.stringify(result)],
    );
    await client.query("COMMIT");
    return result;
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error.code === "23505" && error.constraint === "idx_transactions_upload_unique") {
      throw new ImportConflict("DUPLICATES_CHANGED", "A source transaction was already saved. Recheck duplicates before saving.");
    }
    throw error;
  }
}
