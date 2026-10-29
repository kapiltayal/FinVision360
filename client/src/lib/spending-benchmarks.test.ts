import assert from "node:assert/strict";
import test from "node:test";
import { BENCHMARK_SOURCE, buildSpendingBenchmarks, type BenchmarkSummary } from "./spending-benchmarks";

const empty: BenchmarkSummary = {
  period: { startMonth: null, endMonth: null, months: 0 },
  averages: { expenses: 0 }, categories: [],
};

test("survey values are sourced annual dollars converted to monthly averages", () => {
  const result = buildSpendingBenchmarks(empty);
  assert.deepEqual(result.rows.map((row) => row.benchmarkMonthly), [6224, 3945, 3609, 978, 1569].map((v) => v / 12));
  assert.equal(BENCHMARK_SOURCE.year, 2024);
  assert.match(BENCHMARK_SOURCE.url, /^https:\/\/www\.bls\.gov\//);
  assert.equal(result.coveragePercent, 0);
  assert.ok(result.rows.every((row) => !row.hasActivity));
});

test("matches only comparable expenses and exposes unmatched coverage", () => {
  const result = buildSpendingBenchmarks({
    ...empty, averages: { expenses: 1000 },
    categories: [
      { type: "expense", subcategory: "groceries", average: 300, total: 3600, transactionCount: 20 },
      { type: "expense", subcategory: "Dining_Out", average: 100, total: 1200, transactionCount: 5 },
      { type: "expense", subcategory: "Unassigned", average: 600, total: 7200, transactionCount: 8 },
      { type: "income", subcategory: "Groceries", average: 9999, total: 9999, transactionCount: 1 },
    ],
  });
  assert.equal(result.matchedMonthly, 400);
  assert.equal(result.unmatchedMonthly, 600);
  assert.equal(result.coveragePercent, 40);
  assert.equal(result.rows[0].userMonthly, 300);
  assert.equal(result.rows[0].delta, 300 - 6224 / 12);
  assert.equal(result.rows[1].hasActivity, true);
  assert.equal(result.rows[2].hasActivity, false);
});

test("combines duplicate category rows without double counting other categories", () => {
  const category = { type: "expense", subcategory: "Education", average: 25, total: 300, transactionCount: 1 };
  const result = buildSpendingBenchmarks({ ...empty, averages: { expenses: 50 }, categories: [category, category] });
  assert.equal(result.rows[4].userMonthly, 50);
  assert.equal(result.matchedMonthly, 50);
  assert.equal(result.coveragePercent, 100);
});
