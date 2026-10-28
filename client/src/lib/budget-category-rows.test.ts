import assert from "node:assert/strict";
import test from "node:test";
import { buildBudgetCategoryRows } from "./budget-category-rows";

const base = {
  type: "expense" as const,
  categories: [
    { id: 21, type: "expense" as const, name: "Groceries", parentCategory: "Food" },
    { id: 38, type: "expense" as const, name: "Donations", parentCategory: "Community" },
    { id: 32, type: "expense" as const, name: "Debt Payment", parentCategory: "Financial" },
    { id: 1, type: "income" as const, name: "Salary & Wages", parentCategory: "Active" },
  ],
  plans: [], actuals: [],
  historyCategories: [{ type: "expense", categoryId: 21, average: 467.53, history: [{ month: "2026-09", amount: 5610.38 }] }],
  historyMonths: ["2026-09"], readOnly: false, closeComplete: false,
};

test("catalog supplies rows and display names; ID matches averages and trends", () => {
  const rows = buildBudgetCategoryRows(base);
  assert.deepEqual(rows.map((r) => r.label), ["Groceries", "Donations"]);
  assert.equal(rows[0].key, "expense:category:21");
  assert.equal(rows[0].average, 467.53);
  assert.equal(rows[0].history[0].amount, 5610.38);
  assert.equal(rows[1].average, 0);
  assert.equal(rows[0].removable, false);
});

test("renaming a catalog label does not break ID-based totals or saved zero", () => {
  const rows = buildBudgetCategoryRows({
    ...base, categories: [{ ...base.categories[0], name: "Food purchases" }],
    plans: [{ planKey: "expense:category:21", plannedAmount: 0 }],
    actuals: [{ type: "expense", category: "category:21", categoryName: "Groceries", amount: 55 }],
  });
  assert.equal(rows[0].label, "Food purchases");
  assert.equal(rows[0].planned, 0);
  assert.equal(rows[0].actual, 55);
  assert.equal(rows[0].average, 467.53);
});

test("Unassigned remains visible for future months with unresolved history", () => {
  const rows = buildBudgetCategoryRows({
    ...base, historyCategories: [{ type: "expense", categoryId: null, average: 100, history: [] }],
  });
  assert.equal(rows.find((r) => r.key === "expense:unassigned")?.average, 100);
});

test("historical rows retain captured labels and hide current catalog additions and metrics", () => {
  const rows = buildBudgetCategoryRows({
    ...base, readOnly: true, closeComplete: true,
    plans: [{ planKey: "expense:category:21", plannedAmount: 44, entityMetadata: { name: "Original name", category: "Food" } }],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "Original name");
  assert.equal(rows[0].planned, 44);
  assert.deepEqual(rows[0].history, []);
});

test("unmapped legacy saved amounts remain visible rather than discarded", () => {
  const rows = buildBudgetCategoryRows({ ...base, plans: [{ planKey: "expense:legacy_custom", plannedAmount: 321 }] });
  assert.equal(rows.find((r) => r.key === "expense:legacy_custom")?.planned, 321);
});
