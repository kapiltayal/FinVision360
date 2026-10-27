import { cleanMerchantName } from "../shared/merchant-name";
export { cleanMerchantName } from "../shared/merchant-name";

export type MerchantIdentity = {
  merchant?: string | null;
  description: string;
};

export type MerchantCatalog<T> = Array<{ merchant: T; key: string }>;

type IngestedMerchant = { name: string; id?: number; keywords?: string | null };
type IndexedIngestedMerchant<T extends IngestedMerchant> = { merchant: T; key: string; canonical: boolean };
type IngestedMatch<T> = { merchant: T; method: "exact" | "string" | "fuzzy" };
type MatchTrie<T extends IngestedMerchant> = {
  children: Map<string, MatchTrie<T>>;
  matches: IndexedIngestedMerchant<T>[];
};
type IngestedMerchantIndex<T extends { name: string }> = {
  exact: Map<string, IndexedIngestedMerchant<T>[]>;
  byLength: Map<number, IndexedIngestedMerchant<T>[]>;
  trie: MatchTrie<T>;
  results: Map<string, IngestedMatch<T> | undefined>;
};
const ingestedMerchantIndexes = new WeakMap<object, IngestedMerchantIndex<{ name: string }>>();

function getIngestedMerchantIndex<T extends IngestedMerchant>(merchants: T[]): IngestedMerchantIndex<T> {
  const cached = ingestedMerchantIndexes.get(merchants) as IngestedMerchantIndex<T> | undefined;
  if (cached) return cached;
  const index: IngestedMerchantIndex<T> = {
    exact: new Map(), byLength: new Map(), trie: { children: new Map(), matches: [] }, results: new Map(),
  };
  // Catalog collisions: canonical name beats an alias, then lowest ID/name wins.
  // Sorting makes equal-length substring ties independent of SQL row order.
  const ordered = [...merchants].sort((a, b) =>
    (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER) ||
    a.name.localeCompare(b.name));
  for (const merchant of ordered) {
    const canonicalKey = cleanMerchantName(merchant.name);
    const keys = Array.from(new Set([canonicalKey, ...(merchant.keywords || "").split(",")
      .map(cleanMerchantName)].filter(Boolean)));
    for (const key of keys) {
      const item = { merchant, key, canonical: key === canonicalKey };
      const exact = index.exact.get(key) || [];
      exact.push(item);
      index.exact.set(key, exact);
      const sameLength = index.byLength.get(key.length) || [];
      sameLength.push(item);
      index.byLength.set(key.length, sameLength);
      let node = index.trie;
      for (let offset = 0; offset < key.length; offset++) {
        if (!node.children.has(key[offset])) node.children.set(key[offset], { children: new Map(), matches: [] });
        node = node.children.get(key[offset])!;
      }
      node.matches.push(item);
    }
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
 * String stage: literal containment anywhere, longest name/alias first.
 * This intentionally replaces the old guarded-prefix policy at the user's request.
 */
export function matchIngestedMerchantWithMethod<T extends IngestedMerchant>(
  value: string,
  merchants: T[],
): IngestedMatch<T> | undefined {
  const key = cleanMerchantName(value);
  if (!key) return undefined;
  const index = getIngestedMerchantIndex(merchants);
  if (index.results.has(key)) return index.results.get(key);
  const remember = (result: IngestedMatch<T> | undefined) => {
    index.results.set(key, result);
    return result;
  };
  const preferred = (items: IndexedIngestedMerchant<T>[]) =>
    [...items].sort((a, b) => Number(b.canonical) - Number(a.canonical) ||
      (a.merchant.id ?? Number.MAX_SAFE_INTEGER) - (b.merchant.id ?? Number.MAX_SAFE_INTEGER) ||
      a.merchant.name.localeCompare(b.merchant.name))[0];
  const exact = index.exact.get(key);
  if (exact) return remember({ merchant: preferred(exact).merchant, method: "exact" });
  let longest: IndexedIngestedMerchant<T>[] = [];
  for (let start = 0; start < key.length; start++) {
    let node = index.trie;
    for (let offset = start; offset < key.length; offset++) {
      const next = node.children.get(key[offset]);
      if (!next) break;
      node = next;
      if (node.matches.length && (!longest.length || node.matches[0].key.length >= longest[0].key.length)) {
        longest = node.matches[0].key.length > (longest[0]?.key.length ?? 0)
          ? [...node.matches] : [...longest, ...node.matches];
      }
    }
  }
  if (longest.length) return remember({ merchant: preferred(longest).merchant, method: "string" });
  // Bound fuzzy work for pathological descriptors; the unchanged cleaned name is still returned by callers.
  if (key.length > 160) return remember(undefined);
  const candidates = new Set<IndexedIngestedMerchant<T>>();
  const shortestPossible = Math.ceil(key.length * 0.9);
  const longestPossible = Math.floor(key.length / 0.9);
  for (let length = shortestPossible; length <= longestPossible; length++) {
    for (const item of index.byLength.get(length) || []) candidates.add(item);
  }
  const scores = new Map<T, { item: IndexedIngestedMerchant<T>; score: number }>();
  for (const item of Array.from(candidates)) {
    const score = Math.min(key.length, item.key.length) >= 8 && item.key.length <= 160
      ? editSimilarity(key, item.key) : 0;
    if (score > (scores.get(item.merchant)?.score ?? 0)) scores.set(item.merchant, { item, score });
  }
  let best: { item: IndexedIngestedMerchant<T>; score: number } | undefined;
  let runnerUp: { item: IndexedIngestedMerchant<T>; score: number } | undefined;
  for (const { item, score } of Array.from(scores.values())) {
    if (!best || score > best.score) {
      runnerUp = best;
      best = { item, score };
    } else if (!runnerUp || score > runnerUp.score) runnerUp = { item, score };
  }
  if (!best || best.score < 0.90 || (runnerUp && best.score - runnerUp.score < 0.08)) return remember(undefined);
  return remember({ merchant: best.item.merchant, method: "fuzzy" });
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
