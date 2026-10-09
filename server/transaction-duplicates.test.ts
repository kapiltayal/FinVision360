import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { TransactionImportEntry } from "../shared/transaction-import";
import { detectTransactionDuplicates } from "../shared/transaction-duplicates";
import { transactionEntryFromSource, validateReviewedTransactionEntries } from "./transaction-import";
import { checkUserTransactionDuplicates, saveDuplicateSafeImport, validDuplicateReview } from "./transaction-duplicates";
import { pool } from "./db";

const entry = (overrides: Partial<TransactionImportEntry> = {}): TransactionImportEntry => ({
  id: 1, date: "2026-08-01", description: "Corner Grocery #123", merchant: "Corner Grocery",
  amount: "23.45", type: "expense", subcategory: "", parentCategory: "", needsWant: "need",
  isRecurring: false, recurringType: "", notes: "", include: true, ...overrides,
});
const prepared = (rows: TransactionImportEntry[]) => {
  const validation = validateReviewedTransactionEntries(rows.filter(row => row.include !== false), []);
  assert.deepEqual(validation.errors, []);
  return validation.transactions;
};

test("source IDs are recognized only from transaction identity columns, not a row number or generic reference", () => {
  assert.equal(transactionEntryFromSource({ ID: 1, Reference: 2 }, 1).sourceTransactionId, undefined);
  const result = transactionEntryFromSource({ FITID: "bank-abc", "Account ID": "checking-1" }, 1);
  assert.equal(result.sourceTransactionId, "bank-abc");
  assert.equal(result.sourceAccount, "checking-1");
});

test("content matches default to excluded, but legitimate identical charges can be explicitly kept", () => {
  const result = detectTransactionDuplicates([entry(), entry({ id: 2, description: "CORNER GROCERY 123" })], []);
  assert.equal(result[0].include, true);
  assert.equal(result[1].duplicate?.kind, "exact");
  assert.equal(result[1].duplicate?.rowId, 1);
  assert.equal(result[1].include, false);
  const kept = detectTransactionDuplicates([entry(), entry({ id: 2, keepDuplicate: true })], []);
  assert.equal(kept[1].include, true);
});

test("overlapping exports match small date differences; opposite types, amounts and known different accounts do not", () => {
  const saved = [entry()];
  assert.equal(detectTransactionDuplicates([entry({ date: "2026-08-03" })], saved)[0].duplicate?.kind, "possible");
  for (const change of [{ date: "2026-08-04" }, { type: "income" as const }, { amount: "23.46" }]) {
    assert.equal(detectTransactionDuplicates([entry(change)], saved)[0].duplicate, undefined);
  }
  assert.equal(detectTransactionDuplicates([entry({ sourceAccount: "checking-2" })],
    [entry({ sourceAccount: "checking-1" })])[0].duplicate, undefined);
});

test("stable source IDs cannot be kept even when financial fields change, and are scoped by account", () => {
  const saved = [entry({ sourceTransactionId: "bank-id", sourceAccount: "checking" })];
  const changed = entry({ sourceTransactionId: "bank-id", sourceAccount: "checking", date: "2025-01-01",
    amount: "1.00", description: "Edited", keepDuplicate: true });
  const result = detectTransactionDuplicates([changed], saved)[0];
  assert.equal(result.duplicate?.kind, "stable");
  assert.equal(result.include, false);
  assert.equal(result.keepDuplicate, false);
  assert.equal(detectTransactionDuplicates([{ ...changed, sourceAccount: "savings" }], saved)[0].duplicate, undefined);
  assert.equal(detectTransactionDuplicates([entry({ sourceTransactionId: "different-bank-id", sourceAccount: "checking" })],
    saved)[0].duplicate, undefined, "distinct stable IDs identify separate otherwise identical charges");
});

test("unfinished review rows are accepted for checks; malformed and repeated row IDs are not", () => {
  assert.equal(validDuplicateReview([entry({ date: "", amount: "" })]), true);
  assert.equal(validDuplicateReview([entry(), entry()]), false);
  assert.equal(validDuplicateReview([{ ...entry(), description: null }]), false);
  assert.equal(validDuplicateReview([entry({ sourceAccount: "x".repeat(257) })]), false);
  assert.equal(validDuplicateReview([{ ...entry(), include: "yes" }]), false);
});

test("database enforcement, exclusions, atomic failure, ownership and network/concurrent retries", async () => {
  const userId = `import-test-${randomUUID()}`;
  const otherUser = `import-test-${randomUUID()}`;
  const client = await pool.connect();
  const secondClient = await pool.connect();
  const save = (rows: TransactionImportEntry[], requestId = randomUUID()) =>
    saveDuplicateSafeImport(client, userId, requestId, rows, prepared(rows));
  const count = async () => Number((await client.query("SELECT count(*) FROM transactions WHERE user_id=$1", [userId])).rows[0].count);
  try {
    const initial = [entry({ sourceTransactionId: "stable-1", sourceAccount: "checking" })];
    const requestId = randomUUID();
    const first = await save(initial, requestId);
    assert.equal(first.inserted, 1);
    assert.deepEqual(await save(initial, requestId), first, "retry after lost response must return durable receipt");
    assert.equal(await count(), 1);
    await assert.rejects(save([entry({ ...initial[0], amount: "88.00" })], requestId),
      (error: any) => error.code === "REQUEST_ID_REUSED");
    await assert.rejects(save([entry({ ...initial[0], date: "2025-01-01", amount: "1.00", keepDuplicate: true })]),
      (error: any) => error.code === "DUPLICATES_CHANGED");
    await assert.rejects(save([entry({ date: "2026-08-02" })]),
      (error: any) => error.code === "DUPLICATES_CHANGED");
    assert.equal(await count(), 1, "rejected duplicates never write");

    const kept = await save([entry({ keepDuplicate: true })]);
    assert.equal(kept.inserted, 1, "legitimate separate identical purchase can be kept");
    const withExcludedInvalid = await save([entry({ id: 3, description: "Different shop", merchant: "Different shop" }),
      entry({ id: 4, date: "", amount: "", include: false })]);
    assert.equal(withExcludedInvalid.skipped, 1);
    assert.equal(withExcludedInvalid.inserted, 1);

    const intraFile = [entry({ id: 5, description: "Brand new", merchant: "New", sourceTransactionId: "same-id" }),
      entry({ id: 6, description: "Different description", merchant: "Other", sourceTransactionId: "same-id", keepDuplicate: true })];
    await assert.rejects(save(intraFile), (error: any) => error.code === "DUPLICATES_CHANGED");

    const separateOwner = await checkUserTransactionDuplicates(client, otherUser, initial);
    assert.equal(separateOwner[0].duplicate, undefined);
    const recheck = await checkUserTransactionDuplicates(client, userId, initial);
    assert.equal(recheck[0].duplicate?.kind, "stable");

    const failingRows = [entry({ id: 7, description: "Atomic first", merchant: "Atomic first" }),
      entry({ id: 8, description: "Atomic second", merchant: "Atomic second" })];
    let inserts = 0;
    const failingClient = { query: async (sql: string, values?: any[]) => {
      if (sql.includes("INSERT INTO transactions") && ++inserts === 2) throw new Error("simulated write failure");
      return client.query(sql, values);
    } };
    const before = await count();
    const failedRequestId = randomUUID();
    await assert.rejects(saveDuplicateSafeImport(failingClient, userId, failedRequestId, failingRows, prepared(failingRows)),
      /simulated write failure/);
    assert.equal(await count(), before);
    assert.equal((await client.query("SELECT 1 FROM transaction_import_receipts WHERE user_id=$1 AND request_id=$2",
      [userId, failedRequestId])).rowCount, 0);
    assert.equal((await save(failingRows, failedRequestId)).inserted, 2, "failed save can be retried");

    const concurrent = [entry({ id: 9, description: "Concurrent", merchant: "Concurrent", keepDuplicate: true })];
    const concurrentId = randomUUID();
    const baseline = await count();
    const results = await Promise.all([
      saveDuplicateSafeImport(client, userId, concurrentId, concurrent, prepared(concurrent)),
      saveDuplicateSafeImport(secondClient, userId, concurrentId, concurrent, prepared(concurrent)),
    ]);
    assert.deepEqual(results[0], results[1]);
    assert.equal(await count(), baseline + 1, "concurrent retries serialize even for a Keep override");
  } finally {
    await client.query("DELETE FROM transaction_import_receipts WHERE user_id=ANY($1::varchar[])", [[userId, otherUser]]);
    await client.query("DELETE FROM transactions WHERE user_id=ANY($1::varchar[])", [[userId, otherUser]]);
    client.release();
    secondClient.release();
    await pool.end();
  }
});
