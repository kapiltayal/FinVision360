import { z } from "zod";

export const resetRetirementAccountInclusionSchema = z.object({
  projection: z.enum(["net-worth", "income-expense"]),
}).strict();

export const retirementAccountInclusionSchema = z.object({
  kind: z.enum(["asset", "liability", "net-worth-entry", "income-expense-entry", "pension", "social-security", "expected-expenses"]),
  accountId: z.number().int().nonnegative().max(2147483647),
  projection: z.enum(["net-worth", "income-expense"]),
  included: z.boolean(),
}).strict().superRefine((value, context) => {
  const builtin = value.kind === "social-security" || value.kind === "expected-expenses";
  if ((builtin && value.accountId !== 0) || (!builtin && value.accountId <= 0)) {
    context.addIssue({ code: "custom", message: "Invalid account or projection item ID.", path: ["accountId"] });
  }
  if ((value.kind === "net-worth-entry" && value.projection !== "net-worth")
    || (["income-expense-entry", "pension", "social-security", "expected-expenses"].includes(value.kind)
      && value.projection !== "income-expense")) {
    context.addIssue({ code: "custom", message: "Item does not belong to this projection.", path: ["projection"] });
  }
});

export type RetirementAccountInclusionInput = z.infer<typeof retirementAccountInclusionSchema>;
export type RetirementItemKind = Exclude<RetirementAccountInclusionInput["kind"], "asset" | "liability">;
export type RetirementItemPreference = { kind: string; itemId: number; included: boolean };
export function retirementItemIncluded(preferences: RetirementItemPreference[], kind: RetirementItemKind, id: number) {
  return preferences.find((row) => row.kind === kind && row.itemId === id)?.included ?? true;
}
export type RetirementAccountPreference = {
  assetId: number | null;
  liabilityId: number | null;
  netWorthIncluded: boolean;
  incomeExpenseIncluded: boolean;
};

/** Filter before projecting, so excluded accounts also leave totals and assumptions. */
export function includedRetirementAccounts<T extends { id: number }>(
  accounts: T[],
  preferences: RetirementAccountPreference[],
  kind: "asset" | "liability",
  projection: RetirementAccountInclusionInput["projection"],
): T[] {
  const excluded = new Set(preferences
    .filter((preference) => !(projection === "net-worth" ? preference.netWorthIncluded : preference.incomeExpenseIncluded))
    .map((preference) => kind === "asset" ? preference.assetId : preference.liabilityId)
    .filter((id): id is number => id !== null));
  return accounts.filter((account) => !excluded.has(account.id));
}
