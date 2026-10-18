import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { GoalAllocationTab } from "./goal-allocation-tab";
import { accountAllocationColor } from "./goal-allocation-connections";

function render(data: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["/api/goal-allocations"], data);
  const html = renderToStaticMarkup(<Router ssrPath="/goals"><QueryClientProvider client={client}><GoalAllocationTab onAddGoal={() => {}} /></QueryClientProvider></Router>);
  client.clear();
  return html;
}

test("allocation workspace exposes balances, legacy funding, completed goals and accessible alternatives", () => {
  const html = render({
    accounts: [{ id: 1, name: "Checking", category: "Checking Account", value: "500", allocatedAmount: "600", unallocatedAmount: "0", deficitAmount: "100" }],
    goals: [
      { id: 1, title: "House", category: "home", targetAmount: "1000", currentAmount: "700", legacyAmount: "100", allocatedAmount: "600" },
      { id: 2, title: "Trip", category: "travel", targetAmount: "200", currentAmount: "200", legacyAmount: "200", allocatedAmount: "0" },
    ],
    allocations: [{ id: 1, assetId: 1, goalId: 1, amount: "600" }],
  });
  assert.ok(html.includes('draggable="true"'));
  assert.ok(html.includes("Overallocated by"), "show balance-drop warning");
  assert.ok(html.includes("Completed goals"));
  assert.ok(html.includes("Assign account funds to House"));
  assert.ok(html.includes("Edit Checking allocation for House"));
  assert.ok(html.includes("Remove Checking allocation from House"));
  assert.ok(html.includes('data-allocation-account="1"'));
  assert.ok(html.includes('data-allocation-row="1"'));
  assert.ok(html.includes(`background-color:${accountAllocationColor(1)}`));
  assert.match(html, /legacy/i);
  assert.ok(html.includes("not a transfer"));
});

test("account relationship colors are deterministic and distinct across accounts", () => {
  assert.equal(accountAllocationColor(17), accountAllocationColor(17));
  assert.notEqual(accountAllocationColor(17), accountAllocationColor(18));
  assert.notEqual(accountAllocationColor(18), accountAllocationColor(19));
});

test("empty state gives a direct way to add a goal", () => {
  const html = render({ accounts: [], goals: [], allocations: [] });
  assert.ok(html.includes("Add a goal"));
});

test("goals and preserved legacy funding remain visible without an eligible account", () => {
  const html = render({
    accounts: [], allocations: [],
    goals: [
      { id: 1, title: "Legacy house", category: "home", targetAmount: "1000", currentAmount: "300", legacyAmount: "300", allocatedAmount: "0" },
      { id: 2, title: "Legacy trip", category: "travel", targetAmount: "100", currentAmount: "100", legacyAmount: "100", allocatedAmount: "0" },
    ],
  });
  assert.ok(html.includes("Go to Assets"));
  assert.ok(html.includes("Legacy house"));
  assert.ok(html.includes("$300"));
  assert.ok(html.includes("Completed goals"));
  assert.ok(html.includes("Legacy trip"));
});
