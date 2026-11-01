import type { Asset, EstateBeneficiaryWithEntries } from "@shared/schema";

export type BeneficiaryAccountAllocation = {
  assetId: number;
  accountName: string;
  institution: string | null;
  accountValue: number;
  percentage: number;
  amount: number;
};

export type BeneficiaryAllocationSummary = {
  totalAssetValue: number;
  totalAssignedValue: number;
  totalUnassignedValue: number;
  beneficiaries: Array<{
    key: string;
    name: string;
    totalAmount: number;
    accounts: BeneficiaryAccountAllocation[];
  }>;
  unassignedAccounts: Array<BeneficiaryAccountAllocation & { reason: string }>;
  overallocatedAccounts: string[];
};

/** Group saved designations without changing or redistributing their allocations. */
export function summarizeBeneficiaryAllocations(
  assets: Pick<Asset, "id" | "name" | "value" | "institution">[],
  designations: Pick<EstateBeneficiaryWithEntries, "assetId" | "hasBeneficiary" | "beneficiaryName" | "beneficiaries">[],
): BeneficiaryAllocationSummary {
  const byAsset = new Map(designations.map(designation => [designation.assetId, designation]));
  const byName = new Map<string, BeneficiaryAllocationSummary["beneficiaries"][number]>();
  const summary: BeneficiaryAllocationSummary = {
    totalAssetValue: 0,
    totalAssignedValue: 0,
    totalUnassignedValue: 0,
    beneficiaries: [],
    unassignedAccounts: [],
    overallocatedAccounts: [],
  };

  for (const asset of assets) {
    const parsedValue = Number(asset.value);
    const accountValue = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;
    summary.totalAssetValue += accountValue;
    const designation = byAsset.get(asset.id);
    const entries = !designation?.hasBeneficiary ? [] : designation.beneficiaries.length
      ? designation.beneficiaries.map(entry => ({
          name: entry.beneficiaryName,
          percentage: Number(entry.allocationPercentage),
        }))
      : designation.beneficiaryName?.trim()
        ? [{ name: designation.beneficiaryName, percentage: 100 }]
        : [];
    let assignedPercentage = 0;
    for (const entry of entries) {
      const name = entry.name.trim().replace(/\s+/g, " ");
      if (!name || !Number.isFinite(entry.percentage) || entry.percentage <= 0) continue;
      const key = name.toLocaleLowerCase("en-US");
      const beneficiary = byName.get(key) ?? { key, name, totalAmount: 0, accounts: [] };
      const amount = accountValue * entry.percentage / 100;
      const existingAccount = beneficiary.accounts.find(account => account.assetId === asset.id);
      if (existingAccount) {
        existingAccount.percentage += entry.percentage;
        existingAccount.amount += amount;
      } else {
        beneficiary.accounts.push({
          assetId: asset.id,
          accountName: asset.name,
          institution: asset.institution,
          accountValue,
          percentage: entry.percentage,
          amount,
        });
      }
      beneficiary.totalAmount += amount;
      byName.set(key, beneficiary);
      assignedPercentage += entry.percentage;
      summary.totalAssignedValue += amount;
    }
    if (assignedPercentage > 100.001) summary.overallocatedAccounts.push(asset.name);
    const unassignedPercentage = Math.max(0, 100 - assignedPercentage);
    if (unassignedPercentage > 0) {
      const amount = accountValue * unassignedPercentage / 100;
      summary.totalUnassignedValue += amount;
      summary.unassignedAccounts.push({
        assetId: asset.id,
        accountName: asset.name,
        institution: asset.institution,
        accountValue,
        percentage: unassignedPercentage,
        amount,
        reason: !designation?.hasBeneficiary ? "No beneficiary assigned"
          : assignedPercentage === 0 ? "Beneficiary details needed" : "Partially allocated",
      });
    }
  }
  summary.beneficiaries = Array.from(byName.values())
    .sort((a, b) => b.totalAmount - a.totalAmount || a.name.localeCompare(b.name));
  for (const beneficiary of summary.beneficiaries) {
    beneficiary.accounts.sort((a, b) => b.amount - a.amount || a.accountName.localeCompare(b.accountName));
  }
  summary.unassignedAccounts.sort((a, b) => b.amount - a.amount || a.accountName.localeCompare(b.accountName));
  return summary;
}
