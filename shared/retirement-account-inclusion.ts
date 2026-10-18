import { z } from "zod";

export const retirementAccountInclusionSchema = z.object({
  kind: z.enum(["asset", "liability"]),
  accountId: z.number().int().positive().max(2147483647),
  projection: z.enum(["net-worth", "income-expense"]),
  included: z.boolean(),
}).strict();

export type RetirementAccountInclusionInput = z.infer<typeof retirementAccountInclusionSchema>;
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
  kind: RetirementAccountInclusionInput["kind"],
  projection: RetirementAccountInclusionInput["projection"],
): T[] {
  const excluded = new Set(preferences
    .filter((preference) => !(projection === "net-worth" ? preference.netWorthIncluded : preference.incomeExpenseIncluded))
    .map((preference) => kind === "asset" ? preference.assetId : preference.liabilityId)
    .filter((id): id is number => id !== null));
  return accounts.filter((account) => !excluded.has(account.id));
}
