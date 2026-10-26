import { cleanMerchantName } from "../shared/merchant-name";
export { cleanMerchantName } from "../shared/merchant-name";

export type MerchantIdentity = {
  merchant?: string | null;
  description: string;
};

export type MerchantCatalog<T> = Array<{ merchant: T; key: string }>;

type IndexedIngestedMerchant<T extends { name: string }> = { merchant: T; key: string };
type IngestedMerchantIndex<T extends { name: string }> = {
  exact: Map<string, IndexedIngestedMerchant<T>[]>;
  byLength: Map<number, IndexedIngestedMerchant<T>[]>;
  byInitial: Map<string, IndexedIngestedMerchant<T>[]>;
};
const ingestedMerchantIndexes = new WeakMap<object, IngestedMerchantIndex<{ name: string }>>();

function getIngestedMerchantIndex<T extends { name: string }>(merchants: T[]): IngestedMerchantIndex<T> {
  const cached = ingestedMerchantIndexes.get(merchants) as IngestedMerchantIndex<T> | undefined;
  if (cached) return cached;
  const index: IngestedMerchantIndex<T> = {
    exact: new Map(), byLength: new Map(), byInitial: new Map(),
  };
  for (const merchant of merchants) {
    const key = cleanMerchantName(merchant.name);
    if (!key) continue;
    const item = { merchant, key };
    const exact = index.exact.get(key) || [];
    exact.push(item);
    index.exact.set(key, exact);
    const sameLength = index.byLength.get(key.length) || [];
    sameLength.push(item);
    index.byLength.set(key.length, sameLength);
    const sameInitial = index.byInitial.get(key[0]) || [];
    sameInitial.push(item);
    index.byInitial.set(key[0], sameInitial);
  }
  ingestedMerchantIndexes.set(merchants, index as IngestedMerchantIndex<{ name: string }>);
  return index;
}

function editSimilarity(left: string, right: string): number {
  if (Math.abs(left.length - right.length) > Math.max(left.length, right.length) * 0.1) return 0;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

/**
 * Ingestion matching is deliberately separate from the existing recurrence matcher.
 * Fuzzy: >= .90 edit similarity, >= 8 characters, >= .08 lead over runner-up.
 * Partial: a whole-token prefix >= 6 characters covering >= 75% of the input,
 * with at most two suffix tokens. Never infer a merchant from an incidental gift/card reference.
 */
export function matchIngestedMerchantWithMethod<T extends { name: string }>(
  value: string,
  merchants: T[],
): { merchant: T; method: "exact" | "fuzzy" } | undefined {
  const key = cleanMerchantName(value);
  if (!key) return undefined;
  const index = getIngestedMerchantIndex(merchants);
  const exact = index.exact.get(key);
  if (exact) return exact.length === 1 ? { merchant: exact[0].merchant, method: "exact" } : undefined;
  // Bound fuzzy work for pathological descriptors; the unchanged cleaned name is still returned by callers.
  if (key.length > 160) return undefined;
  const candidates = new Set<IndexedIngestedMerchant<T>>(index.byInitial.get(key[0]) || []);
  const shortestPossible = Math.ceil(key.length * 0.9);
  const longestPossible = Math.floor(key.length / 0.9);
  for (let length = shortestPossible; length <= longestPossible; length++) {
    for (const item of index.byLength.get(length) || []) candidates.add(item);
  }
  let best: { item: IndexedIngestedMerchant<T>; score: number } | undefined;
  let runnerUp: { item: IndexedIngestedMerchant<T>; score: number } | undefined;
  for (const item of Array.from(candidates)) {
    const partial = item.key.length >= 6 && key.startsWith(`${item.key} `) &&
      item.key.length / key.length >= 0.75 &&
      key.slice(item.key.length).trim().split(" ").length <= 2 &&
      !/\b(?:gift|card|via|for)\b/.test(key.slice(item.key.length));
    const score = partial ? 0.96 : Math.min(key.length, item.key.length) >= 8 && item.key.length <= 160
      ? editSimilarity(key, item.key) : 0;
    if (!best || score > best.score) {
      runnerUp = best;
      best = { item, score };
    } else if (!runnerUp || score > runnerUp.score) runnerUp = { item, score };
  }
  if (!best || best.score < 0.90 || (runnerUp && best.score - runnerUp.score < 0.08)) return undefined;
  return { merchant: best.item.merchant, method: "fuzzy" };
}

export function matchIngestedMerchant<T extends { name: string }>(value: string, merchants: T[]): T | undefined {
  return matchIngestedMerchantWithMethod(value, merchants)?.merchant;
}

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
