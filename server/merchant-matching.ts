export type MerchantIdentity = {
  merchant?: string | null;
  description: string;
};

export type MerchantCatalog<T> = Array<{ merchant: T; key: string }>;

function merchantKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildMerchantCatalog<T extends { name: string }>(merchants: T[]): MerchantCatalog<T> {
  return merchants.map(merchant => ({ merchant, key: merchantKey(merchant.name) }))
    .filter(({ key }) => key.length > 0)
    .sort((a, b) => b.key.length - a.key.length);
}

/**
 * Prefer exact identities. Imports may copy a bank descriptor into merchant:
 * only those rows (or missing identities) allow guarded whole-token matching.
 * Distinct explicit identities and ambiguous matches must not be guessed.
 */
export function matchKnownMerchant<T>(
  row: MerchantIdentity,
  catalog: MerchantCatalog<T>,
): T | undefined {
  const explicit = merchantKey(row.merchant || "");
  const descriptor = merchantKey(row.description);
  const exact = explicit ? catalog.filter(({ key }) => key === explicit) : [];
  if (exact.length) return exact.length === 1 ? exact[0].merchant : undefined;
  if (explicit && explicit !== descriptor) return undefined;
  const description = ` ${descriptor} `;
  const matches = catalog.filter(({ key }) => description.includes(` ${key} `));
  if (!matches.length || (matches[1] && matches[0].key.length === matches[1].key.length)) return undefined;
  return matches[0].merchant;
}
