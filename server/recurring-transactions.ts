import type { Pool } from "pg";
import { buildMerchantCatalog, matchKnownMerchant } from "./merchant-matching";

export type RecurringTransaction = {
  id: number;
  date: string | Date;
  description: string;
  merchant?: string | null;
  amount: string | number;
  type: string;
  is_user_modified?: boolean;
};

export type RecurringMerchant = {
  id: number;
  name: string;
  is_known_subscription: boolean;
};

export type RecurringUpdate = {
  id: number;
  recurringType: "subscription" | "recurring_bill";
};

function merchantKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Known merchants influence classification, never the requirement for history. */
export function identifyRecurringTransactions(
  rows: RecurringTransaction[],
  merchants: RecurringMerchant[],
): RecurringUpdate[] {
  const catalog = buildMerchantCatalog(merchants);
  const groups = new Map<string, {
    knownSubscription: boolean;
    charges: Array<{ id: number; time: number; amount: number }>;
  }>();
  for (const row of rows) {
    const time = new Date(row.date).getTime();
    const amount = Number(row.amount);
    if (row.is_user_modified || row.type.toLowerCase() !== "expense" ||
        !Number.isFinite(time) || !Number.isFinite(amount) || amount === 0) continue;
    const merchant = matchKnownMerchant(row, catalog);
    // Retain the legacy description grouping for unmatched imports: their
    // merchant field can itself contain changing bank reference numbers.
    const fallback = merchantKey(row.description || row.merchant || "").split(" ").slice(0, 3).join(" ");
    if (!merchant && fallback.length < 3) continue;
    const key = merchant ? `catalog:${merchant.id}` : `unmatched:${fallback}`;
    let group = groups.get(key);
    if (!group) {
      group = { knownSubscription: merchant?.is_known_subscription === true, charges: [] };
      groups.set(key, group);
    }
    group.charges.push({ id: row.id, time, amount });
  }

  const updates: RecurringUpdate[] = [];
  for (const { charges, knownSubscription } of Array.from(groups.values())) {
    charges.sort((a, b) => a.time - b.time);
    let sequence: typeof charges = [];
    const flush = () => {
      if (sequence.length < 2) return;
      const sameAmount = sequence.slice(1).every((charge, index) =>
        Math.abs(charge.amount - sequence[index].amount) < 0.02);
      const recurringType = knownSubscription || sameAmount ? "subscription" : "recurring_bill";
      for (const charge of sequence) updates.push({ id: charge.id, recurringType });
    };
    for (const charge of charges) {
      const previous = sequence[sequence.length - 1];
      const days = previous ? (charge.time - previous.time) / 86_400_000 : 0;
      // Retain the existing detector's monthly cadence window.
      if (previous && (days < 20 || days > 45)) {
        flush();
        sequence = [];
      }
      sequence.push(charge);
    }
    flush();
  }
  return updates;
}

export async function detectAndMarkRecurring(database: Pick<Pool, "query">, userId: string): Promise<number> {
  const [transactions, merchants] = await Promise.all([
    database.query<RecurringTransaction>(
      `SELECT id, date, description, merchant, amount, type, is_user_modified
       FROM transactions WHERE user_id = $1 AND NOT is_user_modified AND lower(type) = 'expense'
       ORDER BY date ASC`,
      [userId],
    ),
    database.query<RecurringMerchant>("SELECT id, name, is_known_subscription FROM merchants"),
  ]);
  const updates = identifyRecurringTransactions(transactions.rows, merchants.rows);
  let marked = 0;
  for (const update of updates) {
    // Recheck ownership and manual corrections in case an edit raced detection.
    const result = await database.query(
      `UPDATE transactions SET is_recurring = TRUE, recurring_type = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND NOT is_user_modified AND lower(type) = 'expense'
         AND (is_recurring IS DISTINCT FROM TRUE OR recurring_type IS DISTINCT FROM $1)`,
      [update.recurringType, update.id, userId],
    );
    marked += result.rowCount ?? 0;
  }
  return marked;
}
