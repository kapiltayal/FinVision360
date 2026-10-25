import assert from "node:assert/strict";
import test from "node:test";
import type { TransactionImportEntry } from "@shared/transaction-import";
import {
  createBlankTransactionImportEntry,
  transactionCategoryChoiceValue,
  validateTransactionImportEntry,
  type TransactionImportCategory,
} from "./transaction-file-import-validation";

test("category review values distinguish the same label in different parents", () => {
  assert.notEqual(transactionCategoryChoiceValue({ category: "Other", parentCategory: "Food" }),
    transactionCategoryChoiceValue({ category: "Other", parentCategory: "Travel" }));
  assert.notEqual(transactionCategoryChoiceValue({ category: "B-C", parentCategory: "A" }),
    transactionCategoryChoiceValue({ category: "C", parentCategory: "A-B" }));
});

const categories: TransactionImportCategory[] = [
  { type: "expense", parentCategory: "Food", category: "Groceries", needVsWant: "need" },
  { type: "income", parentCategory: "Employment", category: "Salary", needVsWant: null },
];

function validEntry(): TransactionImportEntry {
  return {
    ...createBlankTransactionImportEntry(1),
    date: "2025-02-28",
    description: "Market",
    amount: "12.34",
    subcategory: "Groceries",
    parentCategory: "Food",
  };
}

test("row factory creates editable incomplete rows and validation requires repair", () => {
  const row = createBlankTransactionImportEntry(7);
  assert.equal(row.id, 7);
  assert.equal(row.type, "expense");
  assert.equal(row.subcategory, "");
  assert.equal(row.isRecurring, false);
  assert.equal(row.recurringFreq, "");
  assert.deepEqual(Object.keys(validateTransactionImportEntry(row, categories)).sort(), [
    "amount",
    "date",
    "description",
  ]);
});

test("recurrence frequency must be one of the supported values and requires recurring status", () => {
  const entry = validEntry();
  entry.isRecurring = true;
  entry.recurringType = "subscription";
  entry.recurringFreq = "Semi-monthly";
  assert.equal(validateTransactionImportEntry(entry, categories).recurringFreq, undefined);

  entry.recurringFreq = "Every 10 days";
  assert.match(validateTransactionImportEntry(entry, categories).recurringFreq ?? "", /supported recurrence frequency/);

  entry.recurringFreq = "Monthly";
  entry.isRecurring = false;
  assert.match(validateTransactionImportEntry(entry, categories).recurringFreq ?? "", /requires recurring status/);
});

test("date validation rejects impossible and noncanonical dates", () => {
  const entry = validEntry();
  assert.equal(validateTransactionImportEntry(entry, categories).date, undefined);
  entry.date = "2025-02-29";
  assert.match(validateTransactionImportEntry(entry, categories).date ?? "", /valid date/);
  entry.date = "02/28/2025";
  assert.match(validateTransactionImportEntry(entry, categories).date ?? "", /valid date/);
});

test("amount validation accepts positive decimal amounts up to the backend limit", () => {
  const entry = validEntry();
  for (const amount of ["0.01", "125", "125.5", "125.50", "9999999999.99"]) {
    entry.amount = amount;
    assert.equal(validateTransactionImportEntry(entry, categories).amount, undefined, amount);
  }
  for (const amount of ["", "0", "-1.00", "0.001", "1.999", "10000000000", "9999999999.991", "1e3"]) {
    entry.amount = amount;
    assert.match(validateTransactionImportEntry(entry, categories).amount ?? "", /amount greater than zero/ , amount);
  }
});

test("empty category is allowed, but selected categories must match transaction type", () => {
  const entry = validEntry();
  entry.subcategory = "";
  entry.parentCategory = "";
  assert.equal(validateTransactionImportEntry(entry, categories).subcategory, undefined);

  entry.type = "income";
  entry.subcategory = "Groceries";
  assert.match(validateTransactionImportEntry(entry, categories).subcategory ?? "", /transaction type/);

  entry.type = "income";
  entry.subcategory = "Salary";
  assert.equal(validateTransactionImportEntry(entry, categories).subcategory, undefined);

  const invalidType = { ...entry, type: "transfer" } as unknown as TransactionImportEntry;
  assert.match(validateTransactionImportEntry(invalidType, categories).type ?? "", /income or expense/);
});