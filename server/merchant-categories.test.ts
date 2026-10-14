import assert from "node:assert/strict";
import test from "node:test";
import { buildMerchantCatalog, matchKnownMerchant } from "./merchant-matching";
import { knownMerchantCategory } from "./transaction-import";

const categories = [
  { id: 1, type: "Expense", parentCategory: "Leisure", category: "Services", needVsWant: "Want" },
  { id: 2, type: "Expense", parentCategory: "Household", category: "Services", needVsWant: "Need" },
  { id: 3, type: "Income", parentCategory: "Earnings", category: "Services", needVsWant: "NA" },
];
const catalog = buildMerchantCatalog([
  { id: 1, name: "Netflix", category_id: 1 },
  { id: 2, name: "Home Services", category_id: 2 },
  { id: 3, name: "Empty Profile", category_id: null },
  { id: 4, name: "Stale Profile", category_id: 99 },
  { id: 5, name: "Income Merchant", category_id: 3 },
]);

test("known categories resolve the FK and exact parent/type rather than a duplicate label", () => {
  assert.equal(knownMerchantCategory({ description: "Home Services", type: "expense" }, catalog, categories), categories[1]);
  assert.equal(knownMerchantCategory({ description: "NETFLIX", type: "expense" }, catalog, categories), categories[0]);
  assert.equal(knownMerchantCategory({ description: "Netflix", type: "income" }, catalog, categories), undefined,
    "expense profiles never convert refunds/income into expenses");
  assert.equal(knownMerchantCategory({ description: "Income Merchant", type: "income" }, catalog, categories), categories[2]);
  assert.equal(knownMerchantCategory({ description: "Income Merchant", type: "expense" }, catalog, categories), undefined);
});

test("descriptor copies and missing merchant identities allow guarded whole-token matching", () => {
  for (const merchant of [null, "PAYPAL NETFLIX REF 001"]) {
    assert.equal(knownMerchantCategory({
      merchant, description: "PAYPAL NETFLIX REF 001", type: "expense",
    }, catalog, categories), categories[0]);
  }
  assert.equal(knownMerchantCategory({
    merchant: "Netflix", description: "CARD 123", type: "expense",
  }, catalog, categories), categories[0], "exact identity works with opaque descriptions");
});

test("distinct identities and substring-only names do not inherit incidental brand categories", () => {
  assert.equal(knownMerchantCategory({
    merchant: "Local Shop", description: "Netflix gift card", type: "expense",
  }, catalog, categories), undefined);
  assert.equal(knownMerchantCategory({ description: "Netflixish purchase", type: "expense" }, catalog, categories), undefined);
});

test("missing, stale and uncategorized profiles produce no suggestion", () => {
  for (const description of ["Empty Profile", "Stale Profile", "Unknown Shop"]) {
    assert.equal(knownMerchantCategory({ description, type: "expense" }, catalog, categories), undefined);
  }
});

test("ambiguous normalized identities are rejected and longer specific brands win", () => {
  const ambiguous = buildMerchantCatalog([
    { name: "A+B", category_id: 1, id: 1 }, { name: "A B", category_id: 2, id: 2 },
  ]);
  assert.equal(matchKnownMerchant({ description: "A B" }, ambiguous), undefined);
  assert.equal(matchKnownMerchant({ description: "CARD A B REF 123" }, ambiguous), undefined);
  const overlapping = buildMerchantCatalog([{ name: "Apple" }, { name: "Apple Music" }]);
  assert.equal(matchKnownMerchant({ description: "CARD APPLE MUSIC REF 123" }, overlapping)?.name, "Apple Music");
  assert.equal(matchKnownMerchant({ description: "Something", merchant: "" }, buildMerchantCatalog([{ name: "" }])), undefined);
});
