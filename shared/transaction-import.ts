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
  notes: string;
  sourceCategory?: string;
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