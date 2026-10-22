import type { RecurringFrequency } from "../shared/schema";
import { buildMerchantCatalog, matchKnownMerchant } from "./merchant-matching";

export type RecurrenceTags = {
  isRecurring: boolean;
  recurringType: "subscription" | "recurring_bill" | null;
  recurringFreq: RecurringFrequency | null;
};

export type RecurringTransaction = {
  id: number;
  date: string | Date;
  description: string;
  merchant?: string | null;
  amount: string | number;
  type: string;
  is_user_modified?: boolean;
  is_recurring?: boolean;
  recurring_type?: string | null;
  recurring_freq?: RecurringFrequency | null;
  recurrence_override?: boolean;
  recurrence_override_at?: string | Date | null;
  source?: string;
  providerSignal?: RecurrenceTags;
};

export type RecurringMerchant = {
  id: number;
  name: string;
  is_known_subscription: boolean;
  is_known_recurring?: boolean;
};

export type RecurringUpdate = RecurrenceTags & { id: number };

const cycles: Array<{ name: RecurringFrequency; days: number; min: number; max: number }> = [
  { name: "Weekly", days: 7, min: 6, max: 8 },
  { name: "Bi-Weekly", days: 14, min: 13, max: 15 },
  { name: "Semi-monthly", days: 15, min: 14, max: 16 },
  { name: "Monthly", days: 30, min: 27, max: 33 },
  { name: "Quarterly", days: 90, min: 85, max: 95 },
  { name: "Semi-Annually", days: 180, min: 175, max: 195 },
  { name: "Annually", days: 365, min: 360, max: 370 },
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function inferRecurrence(rows: RecurringTransaction[]): RecurrenceTags | undefined {
  if (rows.length < 3) return undefined;
  const sorted = [...rows].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const intervals = sorted.slice(1).map((row, index) =>
    (+new Date(row.date) - +new Date(sorted[index].date)) / 86_400_000);
  const midpoint = median(intervals);
  const candidates = cycles.filter(cycle => rows.length <= 4
    ? midpoint >= cycle.min && midpoint <= cycle.max
    : intervals.filter(days => days >= cycle.min && days <= cycle.max).length / intervals.length >= 0.8);
  // The overlapping windows must not turn alternating 14/16-day billing into biweekly billing.
  const alternating = intervals.length >= 2 && intervals.every((days, index) =>
    (days === 14 || days === 16) && (!index || days !== intervals[index - 1]));
  const cycle = alternating
    ? candidates.find(candidate => candidate.name === "Semi-monthly")
    : [...candidates].sort((a, b) => Math.abs(a.days - midpoint) - Math.abs(b.days - midpoint))[0];
  if (!cycle) return undefined;
  const amounts = rows.map(row => Math.abs(Number(row.amount)));
  const medianAmount = median(amounts);
  const stable = amounts.every(amount => Math.abs(amount - medianAmount) <= medianAmount * 0.05 + 1e-8);
  return { isRecurring: true, recurringType: stable ? "subscription" : "recurring_bill", recurringFreq: cycle.name };
}

export function hasRecurrenceOverride(row: RecurringTransaction): boolean {
  return row.recurrence_override === true || (row.source === "manual" && row.is_recurring === true);
}

/** Use the same guarded identity matching as categorization, scoped to one user's history. */
export function identifyRecurringTransactions(
  rows: RecurringTransaction[], merchants: RecurringMerchant[],
  options: { targetIds?: Set<number>; reviewed?: boolean } = {},
): RecurringUpdate[] {
  const catalog = buildMerchantCatalog(merchants);
  const groups = new Map<string, { merchant?: RecurringMerchant; rows: RecurringTransaction[] }>();
  for (const row of rows) {
    const date = new Date(row.date);
    const impossibleDay = typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
      Number.isFinite(+date) && date.toISOString().slice(0, 10) !== row.date;
    if (row.type.toLowerCase() !== "expense" || !Number.isFinite(+date) || impossibleDay ||
        !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) continue;
    const merchant = matchKnownMerchant(row, catalog);
    const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const explicit = normalize(row.merchant || "");
    const descriptor = normalize(row.description);
    const fallback = explicit && explicit !== descriptor ? explicit :
      (descriptor || explicit).split(" ").slice(0, 3).join(" ");
    if (!merchant && fallback.length < 3) continue;
    const key = merchant ? `catalog:${merchant.id}` : `unmatched:${fallback}`;
    const group = groups.get(key) ?? { merchant, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  const updates: RecurringUpdate[] = [];
  for (const group of Array.from(groups.values())) {
    // Scope an import to its merchants, not just its newly imported row IDs.
    if (options.targetIds && !group.rows.some(row => options.targetIds!.has(row.id))) continue;
    const newestFirst = (a: RecurringTransaction, b: RecurringTransaction) =>
      +new Date(b.date) - +new Date(a.date) || b.id - a.id;
    const override = group.rows.filter(hasRecurrenceOverride).sort((a, b) =>
      (+new Date(b.recurrence_override_at || b.date) - +new Date(a.recurrence_override_at || a.date)) ||
      b.id - a.id)[0];
    const tagsFromRow = (row: RecurringTransaction): RecurrenceTags => ({
      isRecurring: row.is_recurring === true,
      recurringType: row.is_recurring &&
        (row.recurring_type === "subscription" || row.recurring_type === "recurring_bill")
        ? row.recurring_type : null,
      recurringFreq: row.is_recurring ? row.recurring_freq ?? null : null,
    });
    // Negative preview IDs are drafts, not previously saved merchant preferences.
    // At reviewed-file save, only the final reviewed positive rows may seed backfill.
    const saved = group.rows.filter(row => row.id > 0 && row.is_recurring === true &&
      (!options.reviewed || options.targetIds?.has(row.id))).sort(newestFirst)[0];
    const historyTags = override ? tagsFromRow(override) : undefined;
    const savedTags = saved ? tagsFromRow(saved) : undefined;
    const providerTags = group.rows.filter(row => row.providerSignal).sort(newestFirst)[0]?.providerSignal;
    const knownType = group.merchant?.is_known_subscription ? "subscription" :
      group.merchant?.is_known_recurring ? "recurring_bill" : null;
    // Never redetect reviewed files on save: use their final tags only.
    const inferred = !options.reviewed && !historyTags && !savedTags && !providerTags
      ? inferRecurrence(group.rows) : undefined;
    const tags = options.reviewed ? (savedTags ? historyTags || savedTags : undefined) :
      historyTags || savedTags || providerTags || (knownType ? {
        isRecurring: true, recurringType: knownType, recurringFreq: inferred?.recurringFreq ?? null,
      } : inferred);
    if (!tags || (options.reviewed && !tags.isRecurring)) continue;
    for (const row of group.rows) {
      // An existing corrected row is never rewritten, even by a later merchant-wide preference.
      if (row.is_user_modified || hasRecurrenceOverride(row)) continue;
      if (options.reviewed && options.targetIds?.has(row.id)) continue;
      updates.push({ id: row.id, ...tags });
    }
  }
  return updates;
}
