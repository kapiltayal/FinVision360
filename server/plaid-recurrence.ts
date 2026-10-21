import type { RecurringFrequency } from "../shared/schema";
import type { RecurrenceTags } from "./recurring-transactions";

const frequencies: Record<string, RecurringFrequency> = {
  WEEKLY: "Weekly", BIWEEKLY: "Bi-Weekly", SEMI_MONTHLY: "Semi-monthly",
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", SEMI_ANNUALLY: "Semi-Annually", ANNUALLY: "Annually",
};

/** Standard transactions currently omit these flags; accept them only when explicitly supplied. */
export function plaidRecurrenceSignal(value: unknown): RecurrenceTags | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const subscription = row.is_subscription === true || String(row.recurring_type).toLowerCase() === "subscription";
  if (!subscription && row.is_recurring !== true && row.recurring_type !== "recurring_bill") return undefined;
  return { isRecurring: true, recurringType: subscription ? "subscription" : "recurring_bill",
    recurringFreq: frequencies[String(row.frequency ?? row.recurring_freq).toUpperCase()] ?? null };
}

export function plaidStreamSignals(
  streams: Array<{ is_active: boolean; transaction_ids: string[]; frequency: string; account_id: string }>,
  allowedAccountIds: Set<string>,
): Map<string, RecurrenceTags> {
  const signals = new Map<string, RecurrenceTags>();
  for (const stream of streams) {
    if (!stream.is_active || !allowedAccountIds.has(stream.account_id)) continue;
    const tags = plaidRecurrenceSignal(stream) ?? {
      isRecurring: true, recurringType: "recurring_bill" as const,
      recurringFreq: frequencies[stream.frequency] ?? null,
    };
    for (const id of stream.transaction_ids) signals.set(id, tags);
  }
  return signals;
}
