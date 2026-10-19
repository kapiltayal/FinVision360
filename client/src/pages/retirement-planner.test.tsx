import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { Router } from "wouter";
import RetirementPlannerPage from "./retirement-planner";
import { buildRetirementNetWorthProjection } from "../../../server/retirement-projection";

const projectionKey = ["/api/retirement/net-worth-projection"];
const projection = buildRetirementNetWorthProjection({
  currentAge: 55, retirementAge: 65, assets: [], liabilities: [],
  assetTypes: [], liabilityTypes: [], assetOverrides: [], projectionEntries: [],
});

function client() {
  const result = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } },
  });
  result.setQueryData(["/api/auth/user"], { dateOfBirth: "1970-01-01" });
  result.setQueryData(["/api/retirement/planner-settings"], { retirementAge: 65, lifeExpectancy: 85 });
  result.setQueryData(["/api/asset-categories"], []);
  result.setQueryData(["/api/liability-categories"], []);
  return result;
}

function render(queryClient: QueryClient) {
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <Router ssrPath="/retirement"><RetirementPlannerPage /></Router>
    </QueryClientProvider>,
  );
}

test("failed net-worth requests show an alert and retry action instead of indefinite calculating", async () => {
  const queryClient = client();
  try {
    await queryClient.fetchQuery({ queryKey: projectionKey, queryFn: async () => { throw new Error("test outage"); } }).catch(() => {});
    const html = render(queryClient);
    assert.ok(html.includes('role="alert"'));
    assert.ok(html.includes("We couldn’t load your retirement net worth"));
    assert.ok(html.includes("Your saved plan is safe."));
    assert.ok(html.includes(">Try again</button>"));
    assert.ok(!html.includes("Calculating your retirement projection"));
    assert.ok(!html.includes("test outage"), "internal error details are not exposed");
  } finally { queryClient.clear(); }
});

test("pending requests still show calculating, not the failure alert", () => {
  const queryClient = client();
  try {
    const html = render(queryClient);
    assert.ok(html.includes("Calculating your retirement projection"));
    assert.ok(!html.includes("We couldn’t load your retirement net worth"));
  } finally { queryClient.clear(); }
});

test("refetch recovers a failed projection and renders results", async () => {
  const queryClient = client();
  try {
    let attempts = 0;
    const observer = new QueryObserver(queryClient, {
      queryKey: projectionKey,
      queryFn: async () => {
        if (++attempts === 1) throw new Error("temporary outage");
        return projection;
      },
    });
    await observer.refetch();
    assert.ok(render(queryClient).includes(">Try again</button>"));
    await observer.refetch();
    const html = render(queryClient);
    assert.equal(attempts, 2);
    assert.equal(queryClient.getQueryState(projectionKey)?.status, "success");
    assert.ok(!html.includes("We couldn’t load your retirement net worth"));
    assert.ok(!html.includes("Calculating your retirement projection"));
    assert.ok(html.includes("Projected Net Worth at Age"));
  } finally { queryClient.clear(); }
});

test("failed background refresh does not silently present cached projections as current", async () => {
  const queryClient = client();
  try {
    queryClient.setQueryData(projectionKey, projection);
    await queryClient.fetchQuery({
      queryKey: projectionKey, staleTime: 0,
      queryFn: async () => { throw new Error("refresh failed"); },
    }).catch(() => {});
    const html = render(queryClient);
    assert.ok(html.includes(">Try again</button>"));
    assert.ok(!html.includes("Calculating your retirement projection"));
  } finally { queryClient.clear(); }
});
