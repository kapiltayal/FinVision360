import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import type { Liability } from "@shared/schema";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NetWorthTabs, netWorthNavigationTabs } from "@/components/net-worth-tabs";
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

test("rendered timeline preserves exact width, proportional thickness, APR tones and cent-precise accessible details", () => {
  const html = render([
    row(1, { name: "High APR loan", interestRate: "15.01" }),
    row(2, { name: "Medium APR loan", balance: "500.17", interestRate: "6", maturityDate: maturityAfter(6) }),
    row(3, { name: "Low APR loan", balance: "10", interestRate: "5.99", maturityDate: maturityAfter(3) }),
    row(4, { name: "Upper yellow boundary", interestRate: "15" }),
    row(5, { name: "Payment-estimated loan", balance: "500.17", interestRate: "6", minimumPayment: "500", maturityDate: null }),
  ]);
  for (const label of ["Highest APR First", "Smallest Balance First", "Longest Duration First"]) assert.ok(html.includes(label));
  assert.ok(html.includes("width:100%;height:100px"));
  assert.ok(html.includes("width:50%;height:50px"));
  assert.ok(html.includes("width:25%;height:5px"));
  assert.match(html, /data-testid="liability-map-row-1" class="grid [^"]+" style="height:112px"/);
  assert.match(html, /data-testid="liability-map-row-2" class="grid [^"]+" style="height:62px"/);
  assert.match(html, /data-testid="liability-map-row-3" class="grid [^"]+" style="height:48px"/);
  assert.ok(html.includes('aria-label="Liability totals"'));
  assert.ok(html.includes("Total interest owed"));
  assert.ok(html.includes("Total interest:"));
  assert.ok(html.includes(">Months left</span>"));
  assert.match(html, /data-testid="duration-end-date-1"[^>]*aria-label="Debt ending date for High APR loan"[^>]*>Ends [A-Z][a-z]{2} 1, \d{4}/);
  assert.match(html, /data-testid="duration-end-date-2"[^>]*>Ends [A-Z][a-z]{2} 1, \d{4}/);
  assert.match(html, /data-testid="duration-end-date-5"[^>]*>Est\. end [A-Z][a-z]{2} \d{4}/);
  assert.ok(html.includes("Estimated over the remaining duration at the current APR"));
  assert.ok(!html.includes("Estimated interest this month"));
  assert.ok(html.includes("Estimated over the displayed duration at the current APR"));
  assert.match(html, /bg-red-500/);
  assert.match(html, /bg-yellow-400/);
  assert.match(html, /bg-emerald-500/);
  for (const [id, color] of [[1, "bg-red-500"], [2, "bg-yellow-400"], [3, "bg-emerald-500"], [4, "bg-yellow-400"]] as const) {
    const bar = html.match(new RegExp(`<button[^>]*data-testid="liability-map-bar-${id}"[^>]*>`))?.[0];
    assert.ok(bar?.includes(color), `APR severity is correct for debt ${id}`);
  }
  assert.ok(html.includes("High APR loan, balance $1,000.34, total interest $"));
  assert.ok(html.includes("APR 15.01%, 12 months, source maturity"));
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(html.includes('data-testid="liability-map-bar-1"'));
  assert.ok(html.indexOf("High APR loan") < html.indexOf("Upper yellow boundary"));
});

test("header matches the shared Assets and Liabilities page-header height", () => {
  const html = render([]);
  assert.match(html, /class="page-header-gradient relative min-h-\[110px\] overflow-hidden"/);
  assert.match(html, /class="relative flex min-h-\[76px\] flex-col justify-center/);
});

test("Liability Map offers both views and preserves the default Gantt with its editable durations", () => {
  const html = render([row(1)]);
  assert.ok(html.includes('aria-label="Liability map view"'));
  const viewTogglePosition = html.indexOf('aria-label="Liability map view"');
  assert.ok(viewTogglePosition > html.indexOf('aria-label="Liability totals"'));
  assert.ok(viewTogglePosition < html.indexOf("Exposure matrix"), "view toggle belongs in totals, above the chart header");
  assert.ok(html.includes("Exposure matrix"), "Gantt view retains its exposure header");
  assert.equal((html.match(/aria-label="APR color legend"/g) ?? []).length, 1);
  assert.ok(html.includes(">Gantt</button>"));
  assert.ok(html.includes(">Bubbles</button>"));
  assert.ok(html.includes('aria-label="Sort liabilities"'));
  for (const label of ["Highest APR First", "Smallest Balance First", "Longest Duration First"]) assert.ok(html.includes(label));
  assert.ok(html.includes('data-testid="liability-map-bar-1"'));
  assert.ok(html.includes('aria-label="Planning duration in months for Debt 1"'));
  assert.ok(!html.includes('class="liability-bubble-card"'));
});

test("unknown duration remains named without a fabricated bar; unknown APR is disclosed", () => {
  const html = render([row(1, { maturityDate: null, interestRate: null })]);
  assert.ok(html.includes("Debt 1"));
  assert.ok(html.includes("APR unknown"));
  assert.ok(html.includes("Estimate unavailable without a usable APR and payoff duration"));
  assert.ok(html.includes("Add a duration to place on timeline"));
  assert.ok(html.includes("Add months for date"));
  assert.ok(html.includes("excludes 1 debt without a usable APR or duration."));
  assert.ok(!html.includes('data-testid="liability-map-bar-1"'));
});

test("zero balance has a paid-off status rather than a timeline bar", () => {
  const html = render([row(1, { balance: "0" })]);
  assert.ok(html.includes("No balance remaining"));
  assert.ok(html.includes("Paid off"));
  assert.ok(!html.includes('data-testid="liability-map-bar-1"'));
});

test("unknown APR is excluded while an explicit zero APR remains a zero-interest estimate", () => {
  const html = render([
    row(1, { name: "Unknown APR loan", interestRate: null }),
    row(2, { name: "Explicit zero APR loan", interestRate: "0", maturityDate: null }),
  ]);
  assert.ok(html.includes("APR unknown"));
  assert.ok(html.includes("excludes 1 debt without a usable APR or duration."));
  assert.ok(html.includes("Estimate unavailable without a usable APR and payoff duration"));
  assert.ok(html.includes("0.00%"));
  assert.ok(html.includes("$0.00"));
});

test("empty liabilities render a functional link to the liabilities input page", () => {
  const html = render([]);
  assert.ok(html.includes("No liabilities to map yet"));
  assert.ok(html.includes('href="/liabilities"'));
});

test("Liability Map tab includes a visual separator after Liabilities", () => {
  const html = renderToStaticMarkup(createElement(Router, { ssrPath: "/liability-map" }, createElement(NetWorthTabs)));
  const liabilitiesIndex = html.indexOf('data-testid="tab-liabilities"');
  const separatorIndex = html.indexOf('data-testid="separator-liabilities-liability-map"');
  const mapIndex = html.indexOf('data-testid="tab-liability-map"');
  assert.ok(liabilitiesIndex >= 0 && separatorIndex > liabilitiesIndex && mapIndex > separatorIndex);
  assert.ok(html.includes('href="/liability-map"'));
  assert.ok(netWorthNavigationTabs.some(tab => tab.title === "Liability Map" && tab.url === "/liability-map"),
    "the shared navigation config also feeds the main app navigation menu");
});
