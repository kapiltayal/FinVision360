import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BenchmarkingPage from "./benchmarking";
import type { BenchmarkSummary } from "../lib/spending-benchmarks";

const summary: BenchmarkSummary = {
  period: { startMonth: "2025-10-01", endMonth: "2026-09-01", months: 12 },
  averages: { expenses: 1000 },
  categories: [{ type: "expense", subcategory: "Groceries", average: 300, total: 3600, transactionCount: 30 }],
};

function render(data?: BenchmarkSummary, error = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
  if (data) client.setQueryData(["/api/transactions/monthly-averages"], data);
  if (error) {
    const query = client.getQueryCache().build(client, { queryKey: ["/api/transactions/monthly-averages"] });
    query.setState({ status: "error", error: new Error("Unavailable"), fetchStatus: "idle" });
  }
  return renderToStaticMarkup(<QueryClientProvider client={client}><BenchmarkingPage /></QueryClientProvider>);
}

test("populated benchmark page renders actual comparisons, period, coverage and source", () => {
  const html = render(summary);
  assert.match(html, /Monthly spending comparison/);
  assert.match(html, /\$300/);
  assert.match(html, /30.0% of your monthly spending/);
  assert.match(html, /October 2025/);
  assert.match(html, /September 2026/);
  assert.match(html, /No recorded charges/);
  assert.match(html, /cesan_12192025.htm/);
  assert.match(html, /2024/);
  assert.match(html, /not personalized/);
});

test("empty history provides working transaction navigation, not fabricated comparisons", () => {
  const html = render({ ...summary, period: { startMonth: null, endMonth: null, months: 0 }, categories: [] });
  assert.match(html, /No transaction history to compare yet/);
  assert.match(html, /href="\/income-expenses\/finance-tracker"/);
  assert.doesNotMatch(html, /<table/);
});

test("loading and error states are explicit", () => {
  assert.match(render(), /Loading spending benchmarks/);
  assert.match(render(undefined, true), /Benchmarks could not be loaded/);
  assert.match(render(undefined, true), /Try again/);
});
