import assert from "node:assert/strict";
import test from "node:test";
import { cleanMerchantName, matchIngestedMerchant, matchIngestedMerchantWithMethod } from "./merchant-matching";
import { transactionEntryFromSource } from "./transaction-import";
import {
  buildIdentificationContext, identifyTransactionBatch, loadIdentificationContext, matchSourceCategory,
  type MerchantHistory,
} from "./transaction-identification";

const categories = [
  { id: 1, type: "Expense", parentCategory: "Food", category: "Groceries", needVsWant: "need", description: "Food to prepare at home." },
  { id: 2, type: "Expense", parentCategory: "Leisure", category: "Entertainment", needVsWant: "want", description: "Streaming, music and tickets." },
  { id: 3, type: "Income", parentCategory: "Income", category: "Refunds", needVsWant: "na", description: "Returned purchase funds." },
];
const catalog = [{ id: 10, name: "Netflix", category_id: 2 }];
const history = (values: Partial<MerchantHistory>): MerchantHistory => ({
  id: 1, merchant: "Netflix", description: "PAYPAL *NETFLIX #4829 CA", type: "expense",
  parent_category: "Food", subcategory: "Groceries", source: "upload", updated_at: "2026-01-01", ...values,
});
const entry = (merchant: string, id = 1, extras = {}) => transactionEntryFromSource({
  date: "2026-01-01", description: merchant, merchant, amount: "10", type: "expense", ...extras,
}, id);
const noAI = async () => { assert.fail("resolved rows must not call AI"); return ""; };

test("cleanup strips processors, numbers, dates, phones, states and whitespace, but keeps brand numbers", () => {
  assert.equal(cleanMerchantName("  SQ * TST* PAYPAL * Netflix STORE 101 #4829 10/24/2026 (800)555-1234 CA  "), "netflix");
  assert.equal(cleanMerchantName("NETFLIX REF 001 2026-10-24 800-555-1234 NY"), "netflix");
  assert.equal(cleanMerchantName("7-Eleven #103 TX"), "7 eleven");
  assert.equal(cleanMerchantName("Forever 21 STORE 10"), "forever 21");
  assert.equal(cleanMerchantName("Microsoft 365"), "microsoft 365");
  assert.equal(cleanMerchantName("Studio 54"), "studio 54");
  assert.equal(cleanMerchantName("STRIPE * VENMO * CASHAPP * SQ * Walmart #4829 CA"), "walmart");
});

test("ingestion catalog matches exact names, string containment and high-confidence fuzzy matches", () => {
  assert.equal(matchIngestedMerchant("NETFLIX #42", catalog), catalog[0]);
  const shops = [{ name: "Starbucks" }, { name: "Starbucks Reserve" }];
  assert.equal(matchIngestedMerchant("Starbuckss", shops), shops[0]);
  assert.equal(matchIngestedMerchant("Starbucks xy", [shops[0]]), shops[0]);
  assert.equal(matchIngestedMerchant("Starbucks gift card", shops), shops[0]);
  assert.equal(matchIngestedMerchant("Local Shop with Netflix", catalog), catalog[0]);
  assert.equal(matchIngestedMerchant("Netflixish", catalog), catalog[0], "literal containment is requested");
  assert.equal(matchIngestedMerchant("Unrelated Shop", shops), undefined);
  assert.equal(matchIngestedMerchant("Starbocks Reserve", shops), shops[1]);
  assert.equal(matchIngestedMerchant("Starbuckq Reserve", [{ name: "Starbucks Reserve" }, { name: "Starbuckx Reserve" }]), undefined);
});

test("user history wins identity and category; explicit corrections beat newer automatic history", async () => {
  const context = buildIdentificationContext(categories, catalog, [
    history({ id: 2, merchant: "Netflix", updated_at: "2026-10-01" }),
    history({ merchant: "My Streaming", description: "original narrative",
      name_override_at: "2026-02-01", category_override_at: "2026-02-01",
      name_aliases: ["PAYPAL *NETFLIX #42 CA"] }),
  ]);
  const original = entry("TST* Netflix #43 CA", 77);
  const result = await identifyTransactionBatch([original], [{}], context, noAI);
  assert.equal(result.entries[0].merchant, "My Streaming");
  assert.equal(result.entries[0].merchantSource, "USER_HISTORY");
  assert.equal(result.entries[0].subcategory, "Groceries");
  assert.equal(result.entries[0].categorySource, "USER_HISTORY");
  assert.equal(result.entries[0].description, original.description);
  assert.equal(result.entries[0].id, 77);
  assert.equal(original.merchant, "TST* Netflix #43 CA", "input is not mutated");
});

test("category priority is explicit history, catalog, source, then AI; Need/Want and source values survive", async () => {
  const raw = { Category: "Groceries", "Parent Category": "Food", "Need Want": "need" };
  const original = entry("SQ *Netflix #42 CA", 1, raw);
  const catalogResult = await identifyTransactionBatch([original], [raw],
    buildIdentificationContext(categories, catalog, []), noAI);
  assert.equal(catalogResult.entries[0].merchant, "Netflix");
  assert.equal(catalogResult.entries[0].merchantSource, "EXACT_MATCH");
  assert.equal(catalogResult.entries[0].subcategory, "Entertainment");
  assert.equal(catalogResult.entries[0].categorySource, "MERCHANT_CAT");
  assert.equal(catalogResult.entries[0].needsWant, "need");
  assert.equal(catalogResult.entries[0].sourceCategory, "Groceries");
  assert.equal(catalogResult.entries[0].amount, "10.00");
  const automaticHistory = await identifyTransactionBatch([original], [raw],
    buildIdentificationContext(categories, catalog, [history({})]), noAI);
  assert.equal(automaticHistory.entries[0].subcategory, "Entertainment", "automatic prior category is not a user preference");
  const sourceResult = await identifyTransactionBatch([entry("Unknown Store", 1, raw)], [raw],
    buildIdentificationContext(categories, [], []), noAI);
  assert.equal(sourceResult.entries[0].subcategory, "Groceries");
  assert.equal(sourceResult.entries[0].categorySource, "BANK_DATA_CAT");
  assert.equal(sourceResult.entries[0].merchantSource, "NO_MATCH");
});

test("source subcategory and parent are independent of header order, type and ambiguous parents are guarded", () => {
  for (const raw of [
    { Category: "Food", Subcategory: "Groceries" },
    { Subcategory: "Groceries", Category: "Food" },
    { Subcategory: "", Category: "Groceries", "Parent Category": "Food" },
  ]) {
    const parsed = entry("Unknown", 1, raw);
    assert.equal(parsed.sourceCategory, "Groceries");
    assert.equal(parsed.sourceParentCategory, "Food");
  }
  assert.equal(matchSourceCategory(categories, "income", "Groceries"), undefined);
  assert.equal(matchSourceCategory([...categories, { ...categories[0], id: 4, parentCategory: "Other" }],
    "expense", "Groceries"), undefined);
});

test("AI only resolves validated canonical IDs for the server-owned row and original income/expense direction", async () => {
  const rows = Array.from({ length: 8 }, (_, index) => entry(`Unknown ${index}`, 900 + index));
  const context = buildIdentificationContext(categories, catalog, []);
  const result = await identifyTransactionBatch(rows, rows, context, async prompt => {
    const request = JSON.parse(prompt);
    assert.deepEqual(Object.keys(request.categories[0]), ["id", "type", "parent_category", "category", "description"]);
    assert.equal(request.rows[0].sourceIndex, 0, "source IDs are not review IDs");
    return JSON.stringify({ entries: [
      { sourceIndex: 0, categoryId: 2, amount: 999, merchant: "changed", type: "income" },
      { sourceIndex: 1, categoryId: 3 }, // incompatible direction
      { sourceIndex: 2, categoryId: 999 }, // invented ID
      { sourceIndex: 3, categoryId: 1 }, { sourceIndex: 3, categoryId: 2 }, // duplicate => reject both
      { sourceIndex: 4, categoryId: null, category: "Uncategorized" },
      { sourceIndex: 5, categoryId: "1" }, { sourceIndex: 6.5, categoryId: 1 },
      { sourceIndex: 999, categoryId: 1 },
    ] });
  });
  assert.equal(result.entries[0].categorySource, "AI_MATCH");
  assert.equal(result.entries[0].subcategory, "Entertainment");
  assert.equal(result.entries[0].type, "expense");
  assert.equal(result.entries[0].id, 900);
  assert.equal(result.entries[0].amount, "10.00");
  assert.equal(result.entries[0].merchant, "Unknown 0");
  assert.ok(result.entries.slice(1).every(row => row.subcategory === ""));
  assert.equal(result.uncategorized, 7);
});

test("AI batches fit provider limits; a failed batch does not prevent later batches or lose rows", async () => {
  const rows = Array.from({ length: 61 }, (_, index) => entry(`Unmatched ${index}`, index + 1));
  let calls = 0;
  const result = await identifyTransactionBatch(rows, rows, buildIdentificationContext(categories, [], []), async prompt => {
    calls++;
    assert.ok(prompt.length <= 27000);
    const batch = JSON.parse(prompt).rows;
    assert.ok(batch.length <= 25);
    if (calls === 1) throw new Error("provider unavailable");
    return JSON.stringify({ entries: batch.map((row: any) => ({ sourceIndex: row.sourceIndex, categoryId: 1 })) });
  });
  assert.equal(calls, 3);
  assert.equal(result.entries.length, 61);
  assert.equal(result.uncategorized, 25);
  assert.ok(result.entries.slice(25).every(row => row.subcategory === "Groceries"));
});

test("large AI classifications run at most three provider batches concurrently", async () => {
  const rows = Array.from({ length: 176 }, (_, index) => entry(`Unique unmatched brand ${index}` , index + 1));
  let active = 0;
  let maximumActive = 0;
  let calls = 0;
  const result = await identifyTransactionBatch(rows, rows, buildIdentificationContext(categories, [], []), async prompt => {
    active++;
    maximumActive = Math.max(maximumActive, active);
    calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    const input = JSON.parse(prompt);
    active--;
    return JSON.stringify({ entries: input.rows.map((row: any) => ({ sourceIndex: row.sourceIndex, categoryId: null })) });
  });
  assert.equal(calls, 8);
  assert.equal(maximumActive, 3);
  assert.equal(result.entries.length, rows.length);
  assert.equal(result.uncategorized, rows.length);
});

test("malformed or oversized AI context stays unresolved; raw financial data is never truncated", async () => {
  const source = entry("Unknown");
  for (const response of ["not json", '{"entries":{}}', '{"entries":[null]}']) {
    const result = await identifyTransactionBatch([source], [{}], buildIdentificationContext(categories, [], []), async () => response);
    assert.equal(result.uncategorized, 1);
  }
  const oversized = [{ ...categories[0], description: "x".repeat(28000) }];
  const result = await identifyTransactionBatch([source], [{}], buildIdentificationContext(oversized, [], []), noAI);
  assert.equal(result.entries[0].description, "Unknown");
  assert.equal(result.uncategorized, 1);
});

test("large raw source context splits by prompt characters without losing original rows", async () => {
  const rows = Array.from({ length: 7 }, (_, index) => entry(`Unknown Large ${index}`, index + 1));
  const raw = rows.map(() => Object.fromEntries(Array.from({ length: 24 }, (_, index) => [`extra${index}`, "x".repeat(2000)])));
  let calls = 0;
  const result = await identifyTransactionBatch(rows, raw, buildIdentificationContext(categories, [], []), async prompt => {
    calls++;
    assert.ok(prompt.length <= 27000);
    const batch = JSON.parse(prompt).rows;
    assert.ok(batch.length < 7, "character limits must split even a small number of rows");
    assert.ok(batch[0].source.extra0.length <= 400);
    return JSON.stringify({ entries: batch.map((row: any) => ({ sourceIndex: row.sourceIndex, categoryId: 1 })) });
  });
  assert.ok(calls > 1);
  assert.equal(result.uncategorized, 0);
  assert.equal(result.entries.length, 7);
  assert.equal(raw[0].extra0.length, 2000);
});

test("history and alias lookup is scoped to the authenticated user, not source-row fields", async () => {
  const queries: any[] = [];
  await loadIdentificationContext({ query: async (sql, params) => {
    queries.push({ sql, params });
    return { rows: [] };
  } }, "current-user", categories);
  const historyQuery = queries.find(query => query.sql.includes("FROM transactions t"));
  assert.deepEqual(historyQuery.params, ["current-user"]);
  assert.match(historyQuery.sql, /WHERE t.user_id=\$1/);
  assert.match(historyQuery.sql, /transaction_id=t.id AND user_id=\$1/);
});

test("keywords resolve exact, anywhere-string and fuzzy stages with canonical names and longest aliases", async () => {
  const walmart = { id: 20, name: "Walmart", keywords: " wal-mart, wm supercenter, , WAL-MART ", category_id: 1 };
  const fuel = { id: 21, name: "Walmart Fuel", keywords: "wm supercenter fuel", category_id: 2 };
  const microsoft = { id: 22, name: "Microsoft", keywords: "Microsoft Online Services, Microsoft Online Service", category_id: 2 };
  const merchants = [fuel, walmart, microsoft, { id: 23, name: "Blank Shop", keywords: null, category_id: null }];
  const descriptors = ["VENMO * WAL-MART #42 CA", "WM SUPERCENTER", "purchase wm supercenter fuel chicago",
    "purchase wm supercenter chicago", "Microsift Online Services", "new local boutique"];
  const result = await identifyTransactionBatch(descriptors.map(value => entry(value)), [],
    buildIdentificationContext(categories, merchants, []), async () => '{"entries":[]}');
  assert.deepEqual(result.entries.map(row => [row.merchant, row.merchantSource, row.categorySource]), [
    ["Walmart", "EXACT_MATCH", "MERCHANT_CAT"], ["Walmart", "EXACT_MATCH", "MERCHANT_CAT"],
    ["Walmart Fuel", "MERCHANT_STRING_MATCH", "MERCHANT_CAT"],
    ["Walmart", "MERCHANT_STRING_MATCH", "MERCHANT_CAT"],
    ["Microsoft", "FUZZY_MATCH", "MERCHANT_CAT"], ["New Local Boutique", "NO_MATCH", "NO_MATCH"],
  ]);
  assert.equal(result.uncategorized, 1);
  assert.equal(matchIngestedMerchantWithMethod("wm supercenter", merchants)?.method, "exact");
});

test("catalog collisions and equal-length matches resolve consistently regardless of catalog order", () => {
  const canonical = { id: 50, name: "Shared Name" };
  const alias = { id: 1, name: "Another Shop", keywords: "shared name" };
  const lowerId = { id: 2, name: "Shop One", keywords: "north shop" };
  const higherId = { id: 3, name: "Shop Two", keywords: "south shop" };
  for (const merchants of [[alias, canonical, higherId, lowerId], [lowerId, higherId, canonical, alias]]) {
    assert.equal(matchIngestedMerchant("shared name", merchants), canonical);
    assert.equal(matchIngestedMerchant("north shop and south shop", merchants), lowerId);
  }
});

test("history wins over aliases, and unknown categories do not borrow opposite-direction catalog IDs", async () => {
  const merchant = { id: 20, name: "Walmart", keywords: "wm supercenter", category_id: 1 };
  const context = buildIdentificationContext(categories, [merchant], [
    history({ merchant: "My Grocer", description: "WM SUPERCENTER", source: "manual" }),
  ]);
  const result = await identifyTransactionBatch([entry("WM SUPERCENTER")], [], context, noAI);
  assert.equal(result.entries[0].merchant, "My Grocer");
  assert.equal(result.entries[0].merchantSource, "USER_HISTORY");
  assert.equal(result.entries[0].categorySource, "USER_HISTORY");
  const refund = await identifyTransactionBatch([entry("Walmart", 2, { type: "income", category: "Refunds" })], [],
    buildIdentificationContext(categories, [merchant], []), noAI);
  assert.equal(refund.entries[0].subcategory, "Refunds");
  assert.equal(refund.entries[0].categorySource, "BANK_DATA_CAT");
});

test("query counts stay fixed and descriptor identities are cached for 1 and 500 rows", async () => {
  for (const count of [1, 500]) {
    const queries: string[] = [];
    const context = await loadIdentificationContext({ query: async (sql, params) => {
      queries.push(sql);
      if (sql.includes("FROM merchants")) return { rows: [{ id: 20, name: "Walmart", keywords: "wm supercenter", category_id: 1 }] };
      assert.deepEqual(params, ["only-this-user"]);
      return { rows: [] };
    } }, "only-this-user", categories);
    const result = await identifyTransactionBatch(Array.from({ length: count }, (_, i) => entry("wm supercenter", i + 1)), [],
      context, noAI);
    assert.equal(queries.length, 2, "catalog and history each load once; categories supplied by the caller");
    assert.match(queries[0], /keywords/);
    assert.equal(context.identities.size, 1, "repeated descriptors resolve once");
    assert.equal(result.entries.length, count);
    assert.ok(result.entries.every(row => row.merchantSource === "EXACT_MATCH" && row.categorySource === "MERCHANT_CAT"));
  }
});
