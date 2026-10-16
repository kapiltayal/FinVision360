import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import type { Liability } from "@shared/schema";
import { TooltipProvider } from "@/components/ui/tooltip";
import LiabilityMapPage from "./liability-map";

function maturityAfter(months: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function row(id: number, changes: Partial<Liability>): Liability {
  return {
    id, userId: "test-fixture", name: `Debt ${id}`, category: "Personal Loan",
    balance: "1000.34", interestRate: "20", minimumPayment: "0",
    maturityDate: maturityAfter(12), institution: null, notes: null, createdAt: new Date(),
    ...changes,
  };
}

function render(rows: Liability[]): string {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(["/api/liabilities"], rows);
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(Router, { ssrPath: "/liability-map" },
        createElement(TooltipProvider, null, createElement(LiabilityMapPage)))));
  } finally {
    client.clear();
  }
}

test("rendered timeline preserves exact width, thickness, APR tones and cent-precise accessible details", () => {
  const html = render([
    row(1, { name: "High APR loan", interestRate: "15.01" }),
    row(2, { name: "Medium APR loan", balance: "500.17", interestRate: "6", maturityDate: maturityAfter(6) }),
    row(3, { name: "Low APR loan", balance: "10", interestRate: "5.99", maturityDate: maturityAfter(3) }),
    row(4, { name: "Upper yellow boundary", interestRate: "15" }),
  ]);
  for (const label of ["Highest APR First", "Smallest Balance First", "Longest Duration First"]) assert.ok(html.includes(label));
  assert.ok(html.includes(`width:100%;height:${80 / 3}px`));
  assert.ok(html.includes(`width:50%;height:${40 / 3}px`));
  assert.ok(html.includes(`width:25%;height:${16 / 3}px`));
  assert.match(html, /data-testid="liability-map-row-1" class="grid h-10 /);
  assert.match(html, /bg-red-500/);
  assert.match(html, /bg-yellow-400/);
  assert.match(html, /bg-emerald-500/);
  for (const [id, color] of [[1, "bg-red-500"], [2, "bg-yellow-400"], [3, "bg-emerald-500"], [4, "bg-yellow-400"]] as const) {
    const bar = html.match(new RegExp(`<button[^>]*data-testid="liability-map-bar-${id}"[^>]*>`))?.[0];
    assert.ok(bar?.includes(color), `APR severity is correct for debt ${id}`);
  }
  assert.ok(html.includes("High APR loan, balance $1,000.34, APR 15.01%, 12 months"));
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(html.includes('data-testid="liability-map-bar-1"'));
  assert.ok(html.indexOf("High APR loan") < html.indexOf("Upper yellow boundary"));
});

test("unknown duration remains named without a fabricated bar; unknown APR is disclosed", () => {
  const html = render([row(1, { maturityDate: null, interestRate: null })]);
  assert.ok(html.includes("Debt 1"));
  assert.ok(html.includes("APR unknown"));
  assert.ok(html.includes("Add a duration to place on timeline"));
  assert.ok(html.includes("Excludes 1 debt with unknown APR."));
  assert.ok(!html.includes('data-testid="liability-map-bar-1"'));
});

test("zero balance has a paid-off status rather than a timeline bar", () => {
  const html = render([row(1, { balance: "0" })]);
  assert.ok(html.includes("No balance remaining"));
  assert.ok(!html.includes('data-testid="liability-map-bar-1"'));
});

test("empty liabilities render a functional link to the liabilities input page", () => {
  const html = render([]);
  assert.ok(html.includes("No liabilities to map yet"));
  assert.ok(html.includes('href="/liabilities"'));
});
