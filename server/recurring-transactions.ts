import type { Pool } from "pg";
import type { RecurringFrequency } from "../shared/schema";
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
  recurringFreq?: RecurringFrequency;
};

function merchantKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function daysBetween(previous: number, current: number): number {
  return (current - previous) / 86_400_000;
}

function hasSemiMonthlyPattern(charges: Array<{ time: number }>): boolean {
  if (charges.length < 4) return false;
  const byMonth = new Map<string, number[]>();
  for (const charge of charges) {
    const date = new Date(charge.time);
    const month = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const dates = byMonth.get(month) ?? [];
    dates.push(date.getUTCDate());
    byMonth.set(month, dates);
  }
  let matchingMonths = 0;
  for (const dates of byMonth.values()) {
    dates.sort((a, b) => a - b);
    if (dates.length === 2 && dates[1] - dates[0] >= 13 && dates[1] - dates[0] <= 17) {
      matchingMonths++;
    }
  }
  return matchingMonths >= 2;
}

function inferRecurringFrequency(
  charges: Array<{ time: number }>,
): RecurringFrequency | undefined {
  if (charges.length < 3) return undefined;
  const intervals = charges.slice(1).map((charge, index) =>
    daysBetween(charges[index].time, charge.time));
  const allWithin = (minimum: number, maximum: number) =>
    intervals.every((days) => days >= minimum && days <= maximum);

  if (hasSemiMonthlyPattern(charges)) return "Semi-monthly";
  if (allWithin(6, 8)) return "Weekly";
  if (allWithin(13, 15)) return "Bi-Weekly";
  if (allWithin(25, 35)) return "Monthly";
  if (allWithin(80, 100)) return "Quarterly";
  if (allWithin(165, 200)) return "Semi-Annually";
  if (allWithin(330, 400)) return "Annually";
  return undefined;
}

function recurringIntervalBand(days: number): string | null {
  if (days >= 6 && days <= 8) return "weekly";
  if (days >= 13 && days <= 17) return "twice-monthly";
  // Keep the existing wider window for recurring classification; the narrower
  // frequency classifier still requires a more typical monthly interval.
  if (days >= 20 && days <= 45) return "monthly";
  if (days >= 80 && days <= 100) return "quarterly";
  if (days >= 165 && days <= 200) return "semi-annual";
  if (days >= 330 && days <= 400) return "annual";
  return null;
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
    let sequenceBand: string | null = null;
    const flush = () => {
      if (sequence.length < 2) return;
      const sameAmount = sequence.slice(1).every((charge, index) =>
        Math.abs(charge.amount - sequence[index].amount) < 0.02);
      const recurringType = knownSubscription || sameAmount ? "subscription" : "recurring_bill";
      const recurringFreq = inferRecurringFrequency(sequence);
      for (const charge of sequence) updates.push({
        id: charge.id,
        recurringType,
        ...(recurringFreq ? { recurringFreq } : {}),
      });
    };
    for (const charge of charges) {
      const previous = sequence[sequence.length - 1];
      const days = previous ? daysBetween(previous.time, charge.time) : 0;
      const band = previous ? recurringIntervalBand(days) : null;
      if (previous && (!band || (sequenceBand && band !== sequenceBand))) {
        flush();
        sequence = [];
        sequenceBand = null;
      }
      if (previous && band && !sequenceBand) sequenceBand = band;
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
      `UPDATE transactions
       SET is_recurring = TRUE, recurring_type = $1,
           recurring_freq = COALESCE(recurring_freq, $2::text), updated_at = NOW()
       WHERE id = $3 AND user_id = $4 AND NOT is_user_modified AND lower(type) = 'expense'
          AND (is_recurring IS DISTINCT FROM TRUE OR recurring_type IS DISTINCT FROM $1
             OR (recurring_freq IS NULL AND $2::text IS NOT NULL))`,
      [update.recurringType, update.recurringFreq ?? null, update.id, userId],
    );
    marked += result.rowCount ?? 0;
  }
  return marked;
}
