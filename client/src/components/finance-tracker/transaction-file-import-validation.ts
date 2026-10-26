import type { TransactionImportEntry } from "@shared/transaction-import";
import { RECURRING_FREQUENCIES } from "@shared/schema";

export type TransactionImportCategory = {
  type: string;
  parentCategory: string;
  category: string;
  needVsWant: string | null;
};

/** Category labels alone need not be unique across canonical parent categories. */
export function transactionCategoryChoiceValue(category: Pick<TransactionImportCategory, "parentCategory" | "category">) {
  return JSON.stringify([category.parentCategory, category.category]);
}

export function findTransactionImportCategory(
  categories: TransactionImportCategory[], type: string, category: string, parentCategory: string,
): TransactionImportCategory | undefined {
  const matches = categories.filter(item =>
    item.category === category && item.type.toLowerCase() === type.toLowerCase());
  if (parentCategory) return matches.find(item => item.parentCategory === parentCategory);
  return matches.length === 1 ? matches[0] : undefined;
}

export type TransactionImportReviewField =
  Exclude<
    keyof TransactionImportEntry,
    "id" | "sourceCategory" | "parentCategory" | "sourceTransactionId" | "sourceAccount" | "duplicate" | "keepDuplicate"
  >;
export type TransactionImportRowErrors = Partial<Record<TransactionImportReviewField, string>>;

export function createBlankTransactionImportEntry(id: number): TransactionImportEntry {
  return {
    id,
    date: "",
    description: "",
    merchant: "",
    amount: "",
    type: "expense",
    subcategory: "",
    parentCategory: "",
    needsWant: "na",
    isRecurring: false,
    recurringType: "",
    recurringFreq: "",
    notes: "",
    sourceCategory: "",
    include: true,
  };
}

function validCalendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function validateTransactionImportEntry(
  entry: TransactionImportEntry,
  categories: TransactionImportCategory[],
): TransactionImportRowErrors {
  const errors: TransactionImportRowErrors = {};
  if (!validCalendarDate(entry.date.trim())) errors.date = "Enter a valid date (YYYY-MM-DD).";
  if (!entry.description.trim()) errors.description = "Description is required.";
  const amountText = entry.amount.trim();
  const amount = Number(amountText);
  if (
    !/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(amountText)
    || !Number.isFinite(amount)
    || amount <= 0
    || amount > 9_999_999_999.99
  ) {
    errors.amount = "Enter an amount greater than zero, up to $9,999,999,999.99, with no more than two decimal places.";
  }
  if (entry.type !== "income" && entry.type !== "expense") errors.type = "Choose income or expense.";
  if (entry.subcategory) {
    const category = findTransactionImportCategory(categories, entry.type, entry.subcategory, entry.parentCategory);
    if (!category) errors.subcategory = "Choose a category for this transaction type.";
  }
  if (entry.needsWant !== "need" && entry.needsWant !== "want" && entry.needsWant !== "na") {
    errors.needsWant = "Choose need, want, or N/A.";
  }
  if (typeof entry.isRecurring !== "boolean") errors.isRecurring = "Choose whether this transaction recurs.";
  if (entry.isRecurring && entry.recurringType !== "subscription" && entry.recurringType !== "recurring_bill") {
    errors.recurringType = "Choose a recurring type.";
  }
  if (typeof entry.recurringFreq !== "string" || (entry.recurringFreq && !(RECURRING_FREQUENCIES as readonly string[]).includes(entry.recurringFreq))) {
    errors.recurringFreq = "Choose a supported recurrence frequency.";
  } else if (!entry.isRecurring && entry.recurringFreq) {
    errors.recurringFreq = "Frequency requires recurring status.";
  }
  return errors;
}