import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import type { TransactionImportEntry } from "../shared/transaction-import";
import {
  applyImportCategorySuggestion,
  saveReviewedTransactionBatch,
  transactionEntryFromSource,
  validateReviewedTransactionEntries,
  type ImportCategory,
  type PreparedReviewedTransaction,
} from "./transaction-import";
import { parseTransactionUpload, parseUpload } from "./asset-liability-ingestion";

const canonicalCategories: ImportCategory[] = [
  {
    type: "Expense",
    parentCategory: "Food",
    category: "Groceries",
    needVsWant: "need",
    storedCategory: "Groceries",
    storedParentCategory: "Food",
  },
];

function reviewedEntry(overrides: Partial<TransactionImportEntry> = {}): TransactionImportEntry {
  return {
    id: 1,
    date: "2024-01-05",
    description: "Grocery store",
    merchant: "Grocery store",
    amount: "23.45",
    type: "expense",
    subcategory: "Groceries",
    parentCategory: "Food",
    needsWant: "need",
    isRecurring: false,
    recurringType: "",
    notes: "",
    ...overrides,
  };
}

test("source normalization keeps invalid or missing fields visible and trusts source financial values", () => {
  const parsed = transactionEntryFromSource({
    "Posted Date": "01/05/2024",
    Description: "  Original description  ",
    Amount: "($1,234.50)",
    Category: "Unknown category",
    Type: "expense",
  }, 7);

  assert.equal(parsed.id, 7);
  assert.equal(parsed.date, "2024-01-05");
  assert.equal(parsed.description, "Original description");
  assert.equal(parsed.amount, "1234.50");
  assert.equal(parsed.sourceCategory, "Unknown category");

  const sparse = transactionEntryFromSource({
    description: "Sparse row",
    date: "not a valid date",
    amount: "10%",
  }, 8);
  assert.equal(sparse.id, 8);
  assert.equal(sparse.description, "Sparse row");
  assert.equal(sparse.date, "not a valid date");
  assert.equal(sparse.amount, "10%");
  assert.equal(sparse.subcategory, "");
  assert.equal(transactionEntryFromSource({ description: "Malformed commas", amount: "1,2" }, 9).amount, "1,2");
});

test("debit and credit columns ignore zero placeholders, and explicit type has priority", () => {
  const expense = transactionEntryFromSource({ description: "Debit", debit: "10.00", credit: "0.00" }, 1);
  const income = transactionEntryFromSource({ description: "Credit", debit: "0.00", credit: "10.00" }, 2);
  const amountZero = transactionEntryFromSource({
    description: "Zero amount placeholder",
    amount: "0.00",
    debit: "10.00",
    credit: "0.00",
  }, 4);
  const explicit = transactionEntryFromSource({
    description: "Explicit type",
    type: "expense",
    debit: "0.00",
    credit: "10.00",
  }, 3);

  assert.equal(expense.type, "expense");
  assert.equal(expense.amount, "10.00");
  assert.equal(income.type, "income");
  assert.equal(income.amount, "10.00");
  assert.equal(amountZero.type, "expense");
  assert.equal(amountZero.amount, "10.00");
  assert.equal(explicit.type, "expense");
  assert.equal(explicit.amount, "10.00");
});

test("Need/Want and recurrence source fields are normalized for review", () => {
  const entry = transactionEntryFromSource({
    description: "Subscription",
    "Needs Want": "Want",
    "Is Recurring": "yes",
    "Recurring Type": "Recurring Bill",
  }, 1);
  const no = transactionEntryFromSource({
    description: "One time",
    "Need / Want": "N/A",
    Recurring: "no",
    "Recurring Type": "subscription",
  }, 2);

  assert.equal(entry.needsWant, "want");
  assert.equal(entry.isRecurring, true);
  assert.equal(entry.recurringType, "recurring_bill");
  assert.equal(no.needsWant, "na");
  assert.equal(no.isRecurring, false);
  assert.equal(no.recurringType, "");

  const unclear = transactionEntryFromSource({
    description: "Unknown source labels",
    "Need/Want": "maybe",
    "Is Recurring": "sometimes",
  }, 3);
  assert.equal(unclear.needsWant, "na");
  assert.equal(unclear.isRecurring, false);
});

test("preview parsing keeps incomplete CSV rows without changing legacy parsing", async () => {
  const file = {
    originalname: "transactions.csv",
    buffer: Buffer.from("date,description,amount\n2024-01-05,Sparse\n2024-01-06,Shop,5.00\n"),
  } as Express.Multer.File;

  assert.equal(parseUpload(file), null);
  const parsed = await parseTransactionUpload(file);
  assert.equal(parsed?.rows.length, 2);
  assert.equal(parsed?.rows[0].amount, "");
  assert.equal(parsed?.rows[1].amount, "5.00");
});

test("category suggestions cannot rewrite source amount, date, description, merchant, or row identity", () => {
  const source = transactionEntryFromSource({
    date: "2024-01-05",
    description: "Original merchant narrative",
    merchant: "Original merchant",
    amount: "19.99",
    type: "expense",
  }, 12);
  const suggested = applyImportCategorySuggestion(source, {
    type: "Expense",
    parentCategory: "Food",
    category: "Groceries",
    needVsWant: "need",
  });

  assert.equal(suggested.id, 12);
  assert.equal(suggested.date, source.date);
  assert.equal(suggested.description, source.description);
  assert.equal(suggested.merchant, source.merchant);
  assert.equal(suggested.amount, source.amount);
  assert.equal(suggested.subcategory, "Groceries");
});

test("CSV overflow detection scans past blank physical lines after 500 nonblank rows", async () => {
  const lines = ["date,description,amount"];
  for (let index = 0; index < 500; index++) lines.push(`2024-01-05,Shop ${index},5.00`);
  lines.push("", "2024-01-06,After blank,6.00");
  const parsed = await parseTransactionUpload({
    originalname: "transactions.csv",
    buffer: Buffer.from(lines.join("\n")),
  } as Express.Multer.File);

  assert.equal(parsed?.rows.length, 500);
  assert.equal(parsed?.ignoredBlankRows, 1);
  assert.equal(parsed?.overflow, true);
});

test("XLSX overflow detection scans sparse rows beyond 500 records and intervening blanks", async () => {
  const records: unknown[][] = [["date", "description", "amount"]];
  for (let index = 0; index < 500; index++) records.push(["2024-01-05", `Shop ${index}`, "5.00"]);
  records.push(["", "", ""]);
  records.push(["2024-01-06", "After blank", "6.00"]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(records), "Transactions");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const parsed = await parseTransactionUpload({
    originalname: "transactions.xlsx",
    buffer,
  } as Express.Multer.File);

  assert.equal(parsed?.rows.length, 500);
  assert.equal(parsed?.ignoredBlankRows, 1);
  assert.equal(parsed?.overflow, true);
});

test("review validation accepts a canonical category or an empty unassigned category", () => {
  const canonical = validateReviewedTransactionEntries([reviewedEntry()], canonicalCategories);
  assert.deepEqual(canonical.errors, []);
  assert.equal(canonical.transactions[0].subcategory, "Groceries");
  assert.equal(canonical.transactions[0].needsWant, "need");

  const unassigned = validateReviewedTransactionEntries([
    reviewedEntry({ subcategory: "", parentCategory: "", needsWant: "na" }),
  ], canonicalCategories);
  assert.deepEqual(unassigned.errors, []);
  assert.equal(unassigned.transactions[0].subcategory, "unassigned");
  assert.equal(unassigned.transactions[0].parentCategory, null);

  const fractional = validateReviewedTransactionEntries([reviewedEntry({ amount: ".50" })], canonicalCategories);
  assert.deepEqual(fractional.errors, []);
  assert.equal(fractional.transactions[0].amount, "0.50");
});

test("invalid reviewed rows are rejected before persistence preparation", () => {
  const result = validateReviewedTransactionEntries([
    reviewedEntry({
      date: "not-a-date",
      amount: "0",
      type: "other" as "expense",
      needsWant: "maybe" as "na",
      isRecurring: true,
      recurringType: "weekly",
    }),
    reviewedEntry({ subcategory: "Not canonical" }),
  ], canonicalCategories);

  assert.equal(result.transactions.length, 0);
  assert.deepEqual(
    new Set(result.errors.map((error) => error.field)),
    new Set(["date", "amount", "type", "subcategory", "needsWant", "recurringType"]),
  );

  const missingRecurrenceType = validateReviewedTransactionEntries([
    reviewedEntry({ isRecurring: true, recurringType: "" }),
  ], canonicalCategories);
  assert.equal(missingRecurrenceType.errors.some((error) => error.field === "recurringType"), true);

  const uiInvalidCurrency = validateReviewedTransactionEntries([
    reviewedEntry({ amount: "$1,000.00" }),
  ], canonicalCategories);
  assert.equal(uiInvalidCurrency.errors.some((error) => error.field === "amount"), true);
});

test("reviewed dates require a real calendar day, including leap-year validation", () => {
  for (const date of ["2025-02-29", "2024-13-01", "2024-00-10", "2024-04-31", "2024-01-00"]) {
    const result = validateReviewedTransactionEntries([reviewedEntry({ date })], canonicalCategories);
    assert.equal(result.errors.some((error) => error.field === "date"), true, `${date} should be rejected`);
    assert.equal(result.transactions.length, 0);
  }

  const leapDay = validateReviewedTransactionEntries([
    reviewedEntry({ date: "2024-02-29" }),
  ], canonicalCategories);
  assert.deepEqual(leapDay.errors, []);
  assert.equal(leapDay.transactions[0].date, "2024-02-29");
});

test("reviewed transaction writes commit together and roll back on an insertion failure", async () => {
  const prepared: PreparedReviewedTransaction[] = [
    {
      date: "2024-01-05",
      description: "First",
      merchant: "First",
      amount: "10.00",
      type: "expense",
      parentCategory: null,
      subcategory: "unassigned",
      needsWant: "na",
      isRecurring: false,
      recurringType: null,
      notes: null,
    },
    {
      date: "2024-01-06",
      description: "Second",
      merchant: "Second",
      amount: "12.00",
      type: "income",
      parentCategory: null,
      subcategory: "unassigned",
      needsWant: "na",
      isRecurring: true,
      recurringType: "subscription",
      notes: null,
    },
  ];
  const successfulQueries: string[] = [];
  const successfulClient = {
    async query(sql: string) {
      successfulQueries.push(sql.trim().split(/\s+/, 1)[0]);
      return {};
    },
  };

  assert.deepEqual(
    await saveReviewedTransactionBatch(successfulClient, "user-1", prepared),
    { inserted: 2, uncategorized: 2, recurringMarked: 1 },
  );
  assert.deepEqual(successfulQueries, ["BEGIN", "INSERT", "INSERT", "COMMIT"]);

  const failedQueries: string[] = [];
  let inserts = 0;
  const failingClient = {
    async query(sql: string) {
      const command = sql.trim().split(/\s+/, 1)[0];
      failedQueries.push(command);
      if (command === "INSERT" && ++inserts === 2) throw new Error("simulated insert failure");
      return {};
    },
  };
  await assert.rejects(saveReviewedTransactionBatch(failingClient, "user-1", prepared), /simulated insert failure/);
  assert.deepEqual(failedQueries, ["BEGIN", "INSERT", "INSERT", "ROLLBACK"]);
});