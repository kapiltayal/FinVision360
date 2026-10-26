export const MERCHANT_IDENTIFICATION_SOURCES = [
  "user_history",
  "merchant_catalog_exact",
  "merchant_catalog_fuzzy",
  "cleaned_fallback",
  "manual_entry",
  "user_edit",
  "unknown",
] as const;

export const CATEGORY_IDENTIFICATION_SOURCES = [
  "user_preference",
  "merchant_profile",
  "provided_category",
  "ai",
  "unassigned",
  "user_selected",
  "user_edit",
  "description_rule",
  "unknown",
] as const;

export interface TransactionImportEntry {
  id: number;
  date: string;
  description: string;
  merchant: string;
  amount: string;
  type: "income" | "expense";
  subcategory: string;
  parentCategory: string;
  needsWant: "need" | "want" | "na";
  isRecurring: boolean;
  recurringType: string;
  recurringFreq: string;
  recurrenceOverride?: boolean;
  categoryOverride?: boolean;
  merchantOverride?: boolean;
  notes: string;
  sourceCategory?: string;
  sourceParentCategory?: string;
  sourceMerchant?: string;
  merchantSource?: string;
  categorySource?: string;
  sourceTransactionId?: string;
  sourceAccount?: string;
  include?: boolean;
  keepDuplicate?: boolean;
  duplicate?: TransactionDuplicate;
}

export interface TransactionDuplicate {
  kind: "stable" | "exact" | "possible";
  reason: string;
  transactionId?: number;
  rowId?: number;
}

export type TransactionImportStage = "validation" | "processing" | "duplicates" | "review" | "finalization" | "complete";
export type TransactionImportEvent =
  | { stage: TransactionImportStage }
  | { preview: TransactionImportPreview }
  | { error: string };

export interface TransactionImportResult {
  inserted: number;
  uncategorized: number;
  skipped: number;
  skippedReasons: Record<string, number>;
  recurringMarked?: number;
}

export interface TransactionImportPreview {
  entries: TransactionImportEntry[];
  ignoredBlankRows: number;
}