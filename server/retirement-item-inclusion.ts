import { and, eq } from "drizzle-orm";
import {
  retirementProjectionItemPreferences as preferences, retirementProjectionEntries,
  retirementIncomeExpenseEntries, retirementPensions, users,
} from "@shared/schema";
import type { RetirementAccountInclusionInput, RetirementItemKind } from "@shared/retirement-account-inclusion";
import { db } from "./db";


export function getRetirementItemPreferences(userId: string) {
  return db.select().from(preferences).where(eq(preferences.userId, userId));
}


export async function saveRetirementItemInclusion(userId: string, input: RetirementAccountInclusionInput) {
  return db.transaction(async (tx) => {
    if (input.kind === "asset" || input.kind === "liability") return null;
    if (input.kind === "social-security" || input.kind === "expected-expenses") {
      const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
      if (!user) return null;
    } else {
      const table = input.kind === "net-worth-entry" ? retirementProjectionEntries
        : input.kind === "income-expense-entry" ? retirementIncomeExpenseEntries : retirementPensions;
      const [item] = await tx.select({ id: table.id }).from(table)
        .where(and(eq(table.id, input.accountId), eq(table.userId, userId))).for("update");
      if (!item) return null;
    }
    const [saved] = await tx.insert(preferences).values({
      userId, kind: input.kind, itemId: input.accountId, included: input.included,
    }).onConflictDoUpdate({
      target: [preferences.userId, preferences.kind, preferences.itemId],
      set: { included: input.included, updatedAt: new Date() },
    }).returning();
    return saved;
  });
}

export function deleteRetirementItemPreference(userId: string, kind: RetirementItemKind, itemId: number) {
  return db.delete(preferences).where(and(
    eq(preferences.userId, userId), eq(preferences.kind, kind), eq(preferences.itemId, itemId),
  ));
}
