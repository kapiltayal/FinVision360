import type { Pool } from "pg";
import type { TransactionImportEntry } from "../shared/transaction-import";
import { identifyRecurringTransactions, type RecurrenceTags, type RecurringMerchant, type RecurringTransaction } from "./recurring-transactions";

type Database = Pick<Pool, "query">;

async function recurrenceContext(database: Database, userId: string) {
  const [transactions, merchants] = await Promise.all([
    database.query<RecurringTransaction>(
      `SELECT t.id, t.date, t.description, t.merchant, t.amount, t.type, t.source,
              t.is_user_modified, t.is_recurring, t.recurring_type, t.recurring_freq,
              (h.last_override IS NOT NULL) AS recurrence_override,
              COALESCE(h.last_override, t.created_at) AS recurrence_override_at
       FROM transactions t
       LEFT JOIN LATERAL (
         SELECT MAX(created_at) AS last_override FROM transaction_change_history
         WHERE user_id = $1 AND transaction_id = t.id
           AND field IN ('is_recurring','recurring_type','recurring_freq')
       ) h ON TRUE
       WHERE t.user_id = $1 AND lower(t.type) = 'expense' ORDER BY t.date, t.id`, [userId]),
    database.query<RecurringMerchant>("SELECT id, name, is_known_subscription, is_known_recurring FROM merchants"),
  ]);
  return { transactions: transactions.rows, merchants: merchants.rows };
}

/** No writes: excluded duplicates do not contribute additional observations. */
export async function detectPreviewRecurrence(
  database: Database, userId: string, entries: TransactionImportEntry[],
): Promise<TransactionImportEntry[]> {
  const context = await recurrenceContext(database, userId);
  const pending = entries.filter(entry => entry.include !== false).map(entry => ({
    id: -entry.id, date: entry.date, amount: entry.amount, type: entry.type,
    merchant: entry.merchant, description: entry.description,
    // Preserve supplied source tags unless the user's history overrides them.
    ...(entry.isRecurring && ["subscription", "recurring_bill"].includes(entry.recurringType) ? {
      providerSignal: {
        isRecurring: true, recurringType: entry.recurringType,
        recurringFreq: entry.recurringFreq || null,
      } as RecurrenceTags,
    } : {}),
  }));
  const updates = new Map(identifyRecurringTransactions([...context.transactions, ...pending], context.merchants)
    .filter(update => update.id < 0).map(update => [-update.id, update]));
  return entries.map(entry => {
    const update = updates.get(entry.id);
    return update ? { ...entry, isRecurring: update.isRecurring,
      recurringType: update.recurringType ?? "", recurringFreq: update.recurringFreq ?? "" } : entry;
  });
}

export async function detectAndMarkRecurring(
  database: Database, userId: string,
  options: { targetIds?: number[]; providerSignals?: Map<number, RecurrenceTags> } = {},
): Promise<number> {
  const context = await recurrenceContext(database, userId);
  const rows = context.transactions.map(row => ({ ...row, providerSignal: options.providerSignals?.get(row.id) }));
  const targets = options.targetIds ? new Set(options.targetIds) : undefined;
  const updates = identifyRecurringTransactions(rows, context.merchants).filter(update => !targets || targets.has(update.id));
  let marked = 0;
  for (const update of updates) {
    const result = await database.query(
      `UPDATE transactions t
       SET is_recurring = $1, recurring_type = $2, recurring_freq = $3, updated_at = NOW()
       WHERE t.id = $4 AND t.user_id = $5 AND NOT t.is_user_modified AND lower(t.type) = 'expense'
         AND NOT EXISTS (SELECT 1 FROM transaction_change_history h
           WHERE h.transaction_id=t.id AND h.user_id=$5 AND h.field IN ('is_recurring','recurring_type','recurring_freq'))
         AND (t.is_recurring IS DISTINCT FROM $1 OR t.recurring_type IS DISTINCT FROM $2
           OR t.recurring_freq IS DISTINCT FROM $3)`,
      [update.isRecurring, update.recurringType, update.recurringFreq, update.id, userId]);
    marked += result.rowCount ?? 0;
  }
  return marked;
}
