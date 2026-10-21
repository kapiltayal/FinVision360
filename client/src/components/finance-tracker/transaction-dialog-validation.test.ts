import assert from "node:assert/strict";
import test from "node:test";
import { isUnchangedTransactionCategory } from "./transaction-dialog-validation";

const legacyCategory = {
  isEdit: true,
  type: "expense",
  initialType: "expense",
  subcategory: "old_category",
  initialSubcategory: "old_category",
  parentCategory: "Legacy",
  initialParentCategory: "Legacy",
};

test("unchanged legacy categories do not block saving other transaction edits", () => {
  assert.equal(isUnchangedTransactionCategory(legacyCategory), true);
});

test("new, changed, re-parented, or re-typed categories still require a canonical selection", () => {
  assert.equal(isUnchangedTransactionCategory({ ...legacyCategory, isEdit: false }), false);
  assert.equal(isUnchangedTransactionCategory({ ...legacyCategory, subcategory: "new_category" }), false);
  assert.equal(isUnchangedTransactionCategory({ ...legacyCategory, parentCategory: "Other" }), false);
  assert.equal(isUnchangedTransactionCategory({ ...legacyCategory, type: "income" }), false);
});
