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
}

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