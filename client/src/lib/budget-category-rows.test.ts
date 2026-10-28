import assert from "node:assert/strict";
import test from "node:test";
import { buildBudgetCategoryRows, budgetCategoryVisibility } from "./budget-category-rows";

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

for (const type of ["income", "expense"] as const) {
  test(`${type} initially shows positive averages and lets users reveal unused catalog categories`, () => {
    const rows = [
      { key: `${type}:category:1`, average: 100, actual: 0 },
      { key: `${type}:category:2`, average: 0, actual: 0 },
      { key: `${type}:category:3`, average: -10, actual: 0 },
    ];
    const initial = budgetCategoryVisibility(rows, false);
    assert.deepEqual(initial.visible, [rows[0]]);
    assert.deepEqual(initial.available, rows.slice(1));
    const added = budgetCategoryVisibility(rows, false, [rows[1].key]);
    assert.deepEqual(added.visible, rows.slice(0, 2));
    assert.deepEqual(added.available, [rows[2]]);
    assert.deepEqual(budgetCategoryVisibility(rows, false).visible, initial.visible);
  });
}

test("zero-average categories retain saved plans, explicit zeros and current-month actuals", () => {
  const rows = [
    { key: "expense:category:1", average: 0, planned: 25, actual: 0 },
    { key: "expense:category:2", average: 0, planned: 0, actual: 0 },
    { key: "expense:category:3", average: 0, actual: 40 },
    { key: "expense:legacy", average: 0, planned: 50, actual: 0 },
  ];
  assert.deepEqual(budgetCategoryVisibility(rows, false).visible, rows);
  assert.deepEqual(budgetCategoryVisibility(rows, false).available, []);
});

test("historical category visibility is unchanged even with zero averages", () => {
  const rows = buildBudgetCategoryRows({
    ...base, readOnly: true, closeComplete: true,
    plans: [{ planKey: "expense:category:38", plannedAmount: 0 }],
  });
  assert.deepEqual(budgetCategoryVisibility(rows, true).visible, rows);
  assert.deepEqual(budgetCategoryVisibility(rows, true).available, []);
});

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

for (const type of ["income", "expense"] as const) {
  test(`${type} rows for current/future months sort by descending monthly average, not plan or actual`, () => {
    const rows = buildBudgetCategoryRows({
      ...base, type,
      categories: [
        { id: 101, type, name: "Lowest", parentCategory: "Group" },
        { id: 102, type, name: "Highest", parentCategory: "Group" },
        { id: 103, type, name: "Middle", parentCategory: "Group" },
        { id: 104, type, name: "No history", parentCategory: "Group" },
      ],
      plans: [{ planKey: `${type}:category:101`, plannedAmount: 9999 }],
      actuals: [{ type, category: "category:101", amount: 9999 }],
      historyCategories: [
        { type, categoryId: 101, average: 10, history: [] },
        { type, categoryId: 102, average: 100, history: [] },
        { type, categoryId: 103, average: 50, history: [] },
      ],
    });
    assert.deepEqual(rows.map((r) => r.label), ["Highest", "Middle", "Lowest", "No history"]);
    assert.deepEqual(rows.map((r) => r.average), [100, 50, 10, 0]);
  });
}

test("equal averages retain catalog order, including categories without history", () => {
  const rows = buildBudgetCategoryRows({
    ...base, historyCategories: [
      { type: "expense", categoryId: 21, average: 0, history: [] },
      { type: "expense", categoryId: 38, average: 0, history: [] },
    ],
  });
  assert.deepEqual(rows.map((r) => r.label), ["Groceries", "Donations"]);
});

test("historical rows retain captured order regardless of current monthly averages", () => {
  const rows = buildBudgetCategoryRows({
    ...base, readOnly: true, closeComplete: true,
    plans: [
      { planKey: "expense:category:38", plannedAmount: 100 },
      { planKey: "expense:category:21", plannedAmount: 10 },
    ],
  });
  assert.deepEqual(rows.map((r) => r.label), ["Donations", "Groceries"]);
});
