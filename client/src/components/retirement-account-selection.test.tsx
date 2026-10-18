import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetirementAccountSelection } from "./retirement-account-selection";

function render(projection: "net-worth" | "income-expense", data?: unknown, error = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } } });
  const key = ["/api/retirement/account-inclusion"];
  if (data !== undefined) client.setQueryData(key, data);
  if (error) client.getQueryCache().build(client, { queryKey: key }).setState({
    status: "error", error: new Error("Test unavailable"), fetchStatus: "idle",
  });
  try {
    return renderToStaticMarkup(<QueryClientProvider client={client}><RetirementAccountSelection projection={projection} /></QueryClientProvider>);
  } finally { client.clear(); }
}

test("account selector exposes independent accessible switches while keeping controls compact", () => {
  const data = { accounts: [
    { id: 1, kind: "asset", name: "IRA", category: "Individual Retirement", balance: "1000", netWorthIncluded: true, incomeExpenseIncluded: false },
    { id: 1, kind: "liability", name: "Mortgage", category: "Mortgage", balance: "500", netWorthIncluded: false, incomeExpenseIncluded: true },
  ] };
  const netWorth = render("net-worth", data);
  const income = render("income-expense", data);
  assert.ok(netWorth.includes("Manage accounts"));
  assert.ok(netWorth.includes("<details") && !netWorth.includes("<details open"));
  assert.ok(netWorth.includes("Exclude asset IRA from the Net worth projection"));
  assert.ok(income.includes("Include asset IRA in the Income &amp; expenses projection"));
  assert.ok(netWorth.includes("Include liability Mortgage in the Net worth projection"));
  assert.ok(income.includes("Exclude liability Mortgage from the Income &amp; expenses projection"));
  assert.ok(netWorth.includes("saved separately"));
});

test("empty, loading, and failure states do not fabricate included account selections", () => {
  assert.ok(render("net-worth", { accounts: [] }).includes("No accounts to include yet."));
  assert.ok(render("net-worth").includes("Loading account selections"));
  const failed = render("net-worth", undefined, true);
  assert.ok(failed.includes("couldn’t be loaded"), "render the saved query failure rather than restarting a request during SSR");
  assert.ok(failed.includes("Retry"));
  assert.ok(!failed.includes('role="switch"'));
});
