import type { TransactionDuplicate, TransactionImportEntry } from "./transaction-import";

export interface DuplicateCandidate {
  id: number;
  date: string;
  amount: string;
  type: string;
  merchant: string;
  description: string;
  sourceTransactionId?: string;
  sourceAccount?: string;
}

export function normalizedTransactionText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function stableSourceKey(row: Pick<DuplicateCandidate, "sourceTransactionId" | "sourceAccount">): string | null {
  const id = row.sourceTransactionId?.trim();
  return id ? JSON.stringify([normalizedTransactionText(row.sourceAccount || ""), id]) : null;
}

function match(row: DuplicateCandidate, other: DuplicateCandidate): Omit<TransactionDuplicate, "rowId" | "transactionId"> | undefined {
  const key = stableSourceKey(row);
  if (key && key === stableSourceKey(other)) {
    return { kind: "stable", reason: "The same source transaction ID is already present. It cannot be saved twice." };
  }
  const account = normalizedTransactionText(row.sourceAccount || "");
  const otherAccount = normalizedTransactionText(other.sourceAccount || "");
  if (account && otherAccount && account !== otherAccount) return;
  // Distinct reliable IDs in the same namespace identify separate real charges,
  // even when their dates, amounts and descriptions are identical.
  if (row.sourceTransactionId && other.sourceTransactionId && account === otherAccount &&
      row.sourceTransactionId.trim() !== other.sourceTransactionId.trim()) return;
  if (row.type !== other.type || !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0 ||
      Math.round(Number(row.amount) * 100) !== Math.round(Number(other.amount) * 100)) return;
  const date = Date.parse(`${row.date}T00:00:00Z`);
  const otherDate = Date.parse(`${other.date}T00:00:00Z`);
  if (!Number.isFinite(date) || !Number.isFinite(otherDate)) return;
  const days = Math.abs(date - otherDate) / 86400000;
  if (days > 2) return;
  const description = normalizedTransactionText(row.description);
  const merchant = normalizedTransactionText(row.merchant || row.description);
  const sameDescription = !!description && description === normalizedTransactionText(other.description);
  const sameMerchant = merchant.length >= 3 && merchant === normalizedTransactionText(other.merchant || other.description);
  if (!sameDescription && !sameMerchant) return;
  if (days === 0 && sameDescription) {
    return { kind: "exact", reason: "Same date, amount, type and normalized description. Keep only if this is a separate real transaction." };
  }
  return { kind: "possible", reason: `Same amount and type, matching merchant/description, ${days === 0 ? "on the same date" : `dates ${days} day${days === 1 ? "" : "s"} apart`}. Review before keeping.` };
}

/** Stable IDs are certain; all content-based matches remain overridable. */
export function detectTransactionDuplicates(entries: TransactionImportEntry[], existing: DuplicateCandidate[]): TransactionImportEntry[] {
  const prior: TransactionImportEntry[] = [];
  return entries.map(entry => {
    let duplicate: TransactionDuplicate | undefined;
    const possible: TransactionDuplicate[] = [];
    for (const saved of existing) {
      const finding = match(entry, saved);
      if (finding) possible.push({ ...finding, transactionId: saved.id });
    }
    for (const other of prior) {
      const finding = match(entry, other);
      if (finding) possible.push({ ...finding, rowId: other.id });
    }
    duplicate = possible.find(d => d.kind === "stable") || possible.find(d => d.kind === "exact") || possible[0];
    if (entry.include !== false) prior.push(entry);
    return { ...entry, duplicate,
      include: duplicate ? duplicate.kind !== "stable" && entry.keepDuplicate === true : entry.include !== false,
      keepDuplicate: duplicate?.kind === "stable" ? false : entry.keepDuplicate === true };
  });
}
