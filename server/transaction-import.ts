import type { TransactionImportEntry } from "../shared/transaction-import";
import type { RawRow } from "./asset-liability-ingestion";

export interface ImportCategory {
  type: string;
  parentCategory: string;
  category: string;
  needVsWant?: string | null;
  storedCategory?: string;
  storedParentCategory?: string;
}

export interface PreparedReviewedTransaction {
  date: string;
  description: string;
  merchant: string;
  amount: string;
  type: "income" | "expense";
  parentCategory: string | null;
  subcategory: string;
  needsWant: "need" | "want" | "na";
  isRecurring: boolean;
  recurringType: string | null;
  notes: string | null;
}

export interface ReviewedImportValidation {
  transactions: PreparedReviewedTransaction[];
  errors: Array<{ index: number; field: string; message: string }>;
}

function normalizedFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sourceField(row: RawRow, ...names: string[]): string {
  const wanted = new Set(names.map(normalizedFieldName));
  const found = Object.entries(row).find(([key]) => wanted.has(normalizedFieldName(key)));
  return found && (typeof found[1] === "string" || typeof found[1] === "number")
    ? String(found[1]).trim()
    : "";
}

export function isBlankTransactionSourceRow(row: RawRow): boolean {
  return Object.values(row).every((value) =>
    value === null || value === undefined || (typeof value === "string" && !value.trim()) ||
    (typeof value === "number" && !Number.isFinite(value)));
}

export function normalizeImportDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== "string" && typeof value !== "number") return "";
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);
  const us = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T].*)?$/);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] :
    us ? [Number(us[3]), Number(us[1]), Number(us[2])] : null;
  if (!parts) return raw;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
    : raw;
}

function parseSourceAmount(value: string): { amount: string; numericValue: number | null } {
  if (!value) return { amount: "", numericValue: null };
  let normalized = value.trim();
  let negative = false;
  const parenthesized = normalized.match(/^\(\s*(.*?)\s*\)$/);
  if (parenthesized) {
    negative = true;
    normalized = parenthesized[1];
  } else if (/[()]/.test(normalized)) {
    return { amount: value, numericValue: null };
  }
  const sign = normalized.match(/^([+-])\s*/);
  if (sign) {
    negative = negative || sign[1] === "-";
    normalized = normalized.slice(sign[0].length);
  }
  normalized = normalized.replace(/^[$£€]\s*/, "").trim();
  const numericPattern = /^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?|\.\d{1,2})$/;
  if (!numericPattern.test(normalized)) return { amount: value, numericValue: null };
  const absoluteValue = Number(normalized.replace(/,/g, ""));
  if (!Number.isFinite(absoluteValue) || absoluteValue > 9_999_999_999.99) {
    return { amount: value, numericValue: null };
  }
  const numericValue = negative ? -absoluteValue : absoluteValue;
  return { amount: absoluteValue.toFixed(2), numericValue };
}

function sourceType(value: string): "income" | "expense" | null {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "income" || normalized === "credit" || normalized === "deposit") return "income";
  if (normalized === "expense" || normalized === "debit" || normalized === "withdrawal") return "expense";
  return null;
}

function sourceNeedsWant(row: RawRow): "need" | "want" | "na" | null {
  const value = sourceField(row, "need/want", "needwant", "needswant", "needvswant", "needsvswant")
    .toLowerCase().replace(/\s+/g, " ").trim();
  if (value === "need") return "need";
  if (value === "want") return "want";
  if (value === "na" || value === "n/a" || value === "n.a." || value === "not applicable") return "na";
  return null;
}

export function hasSuppliedNeedWant(row: RawRow): boolean {
  return sourceNeedsWant(row) !== null;
}

function sourceRecurringStatus(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "1", "on"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "off"].includes(normalized)) return false;
  return null;
}

function sourceRecurringType(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "subscription") return "subscription";
  if (normalized === "recurringbill") return "recurring_bill";
  return "";
}

export function transactionEntryFromSource(row: RawRow, id: number): TransactionImportEntry {
  const dateValue = sourceField(row, "date", "transactiondate", "posteddate");
  const description = sourceField(row, "description", "merchant", "name", "memo", "text");
  const rawAmount = sourceField(row, "amount", "value");
  const rawDebit = sourceField(row, "debit");
  const rawCredit = sourceField(row, "credit");
  const explicitType = sourceType(sourceField(row, "type", "transactiontype"));
  const parsedAmount = parseSourceAmount(rawAmount);
  let selectedAmount = rawAmount;
  let inferredColumnType: "income" | "expense" | null = null;
  if (!rawAmount || parsedAmount.numericValue === 0) {
    const debit = parseSourceAmount(rawDebit);
    const credit = parseSourceAmount(rawCredit);
    const debitNonzero = !!rawDebit && debit.numericValue !== 0;
    const creditNonzero = !!rawCredit && credit.numericValue !== 0;
    if (explicitType === "income" && creditNonzero) {
      selectedAmount = rawCredit;
      inferredColumnType = "income";
    } else if (explicitType === "expense" && debitNonzero) {
      selectedAmount = rawDebit;
      inferredColumnType = "expense";
    } else if (debitNonzero && creditNonzero) {
      selectedAmount = rawDebit;
      inferredColumnType = "expense";
    } else if (debitNonzero) {
      selectedAmount = rawDebit;
      inferredColumnType = "expense";
    } else if (creditNonzero) {
      selectedAmount = rawCredit;
      inferredColumnType = "income";
    } else if (explicitType === "income" && rawCredit) {
      selectedAmount = rawCredit;
      inferredColumnType = "income";
    } else if (explicitType === "expense" && rawDebit) {
      selectedAmount = rawDebit;
      inferredColumnType = "expense";
    } else if (!rawAmount) {
      selectedAmount = rawDebit || rawCredit;
      inferredColumnType = rawDebit ? "expense" : rawCredit ? "income" : null;
    }
  }
  const { amount } = parseSourceAmount(selectedAmount);
  const type = explicitType ?? inferredColumnType ?? "expense";
  const sourceCategory = sourceField(row, "subcategory", "category");
  const sourceRecurrenceType = sourceRecurringType(sourceField(row, "recurringtype"));
  const recurringFlag = sourceRecurringStatus(sourceField(row, "isrecurring", "recurring"));
  const isRecurring = recurringFlag ?? !!sourceRecurrenceType;

  return {
    id,
    date: normalizeImportDate(dateValue),
    description,
    merchant: sourceField(row, "merchant", "description", "name") || description,
    amount,
    type,
    subcategory: "",
    parentCategory: "",
    needsWant: sourceNeedsWant(row) ?? "na",
    isRecurring,
    recurringType: isRecurring ? sourceRecurrenceType : "",
    notes: sourceField(row, "notes", "memo"),
    ...(sourceCategory ? { sourceCategory } : {}),
  };
}

export function applyImportCategorySuggestion(
  entry: TransactionImportEntry,
  category: ImportCategory,
  applyCanonicalNeedWant = true,
): TransactionImportEntry {
  const type = category.type.toLowerCase();
  if (type !== "income" && type !== "expense") return entry;
  const needsWant = category.needVsWant?.toLowerCase();
  return {
    ...entry,
    type,
    subcategory: category.storedCategory ?? category.category,
    parentCategory: category.storedParentCategory ?? category.parentCategory,
    needsWant: !applyCanonicalNeedWant
      ? entry.needsWant
      : needsWant === "need" || needsWant === "want" || needsWant === "na" ? needsWant : "na",
  };
}

function categoryKey(value: string): string {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function validImportDate(value: string): string | null {
  const normalized = normalizeImportDate(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1) return null;
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? normalized
    : null;
}

function parseReviewedAmount(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999.99) return null;
  return amount.toFixed(2);
}

export function validateReviewedTransactionEntries(
  entries: unknown,
  categories: ImportCategory[],
): ReviewedImportValidation {
  const errors: ReviewedImportValidation["errors"] = [];
  const transactions: PreparedReviewedTransaction[] = [];
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 500) {
    return {
      transactions,
      errors: [{ index: -1, field: "entries", message: "Provide between 1 and 500 reviewed transactions" }],
    };
  }

  entries.forEach((entry: any, index) => {
    const addError = (field: string, message: string) => errors.push({ index, field, message });
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      addError("entry", "Transaction entry must be an object");
      return;
    }

    if (!Number.isInteger(entry.id)) addError("id", "Transaction row identity must be an integer");
    const date = typeof entry.date === "string" ? validImportDate(entry.date) : null;
    if (!date) addError("date", "A valid transaction date is required");
    const description = typeof entry.description === "string" ? entry.description.trim() : "";
    if (!description) addError("description", "A transaction description is required");
    const amount = parseReviewedAmount(entry.amount);
    if (!amount) addError("amount", "Amount must be a positive, non-zero amount with at most two decimal places");
    if (entry.type !== "income" && entry.type !== "expense") addError("type", "Transaction type must be income or expense");

    if (typeof entry.parentCategory !== "string") addError("parentCategory", "Parent category must be text");
    if (typeof entry.subcategory !== "string") addError("subcategory", "Category must be text");
    const parentInput = typeof entry.parentCategory === "string" ? entry.parentCategory.trim() : "";
    const categoryInput = typeof entry.subcategory === "string" ? entry.subcategory.trim() : "";
    let selected: ImportCategory | undefined;
    if (!categoryInput && parentInput) {
      addError("subcategory", "A parent category cannot be selected without a category");
    } else if (categoryInput && (entry.type === "income" || entry.type === "expense")) {
      selected = categories.find((category) =>
        category.type.toLowerCase() === entry.type &&
        categoryKey(category.category) === categoryKey(categoryInput) &&
        (!parentInput || categoryKey(category.parentCategory) === categoryKey(parentInput)));
      if (!selected) addError("subcategory", "Category does not match a canonical category for this type and parent");
    }

    if (entry.needsWant !== "need" && entry.needsWant !== "want" && entry.needsWant !== "na") {
      addError("needsWant", "Need / Want must be need, want, or na");
    }
    if (typeof entry.isRecurring !== "boolean") addError("isRecurring", "Recurring status must be true or false");
    if (typeof entry.recurringType !== "string") addError("recurringType", "Recurring type must be text");
    const recurringType = typeof entry.recurringType === "string" ? entry.recurringType.trim() : "";
    if (recurringType && recurringType !== "subscription" && recurringType !== "recurring_bill") {
      addError("recurringType", "Recurring type must be subscription or recurring_bill");
    }
    if (entry.isRecurring === false && recurringType) {
      addError("recurringType", "Recurring type must be empty when recurring status is false");
    }
    if (entry.isRecurring === true && !recurringType) {
      addError("recurringType", "Choose a recurring type when recurring status is true");
    }
    if (typeof entry.merchant !== "string") addError("merchant", "Merchant must be text");
    if (typeof entry.notes !== "string") addError("notes", "Notes must be text");

    if (
      date && description && amount && (entry.type === "income" || entry.type === "expense") &&
      (entry.needsWant === "need" || entry.needsWant === "want" || entry.needsWant === "na") &&
      typeof entry.isRecurring === "boolean" && (!recurringType || entry.isRecurring) &&
      (entry.isRecurring === false || recurringType === "subscription" || recurringType === "recurring_bill") &&
      typeof entry.parentCategory === "string" && typeof entry.subcategory === "string" &&
      typeof entry.recurringType === "string" && Number.isInteger(entry.id) &&
      (!categoryInput || selected) && (!parentInput || categoryInput) &&
      typeof entry.merchant === "string" && typeof entry.notes === "string"
    ) {
      transactions.push({
        date,
        description,
        merchant: entry.merchant.trim() || description,
        amount,
        type: entry.type,
        parentCategory: selected
          ? selected.storedParentCategory ?? selected.parentCategory
          : null,
        subcategory: selected
          ? selected.storedCategory ?? selected.category
          : "unassigned",
        needsWant: entry.needsWant,
        isRecurring: entry.isRecurring,
        recurringType: entry.isRecurring && recurringType ? recurringType : null,
        notes: entry.notes.trim() || null,
      });
    }
  });
  return { transactions: errors.length ? [] : transactions, errors };
}

export async function saveReviewedTransactionBatch(
  client: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  userId: string,
  transactions: PreparedReviewedTransaction[],
): Promise<{ inserted: number; uncategorized: number; recurringMarked: number }> {
  let inserted = 0;
  let uncategorized = 0;
  let recurringMarked = 0;
  try {
    await client.query("BEGIN");
    for (const transaction of transactions) {
      await client.query(
        `INSERT INTO transactions
           (user_id, date, description, merchant, amount, type, parent_category, subcategory,
            needs_want, is_recurring, recurring_type, source, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'upload',$12)`,
        [
          userId,
          transaction.date,
          transaction.description,
          transaction.merchant,
          transaction.amount,
          transaction.type,
          transaction.parentCategory,
          transaction.subcategory,
          transaction.needsWant,
          transaction.isRecurring,
          transaction.recurringType,
          transaction.notes,
        ],
      );
      inserted++;
      if (transaction.subcategory === "unassigned") uncategorized++;
      if (transaction.isRecurring) recurringMarked++;
    }
    await client.query("COMMIT");
    return { inserted, uncategorized, recurringMarked };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}