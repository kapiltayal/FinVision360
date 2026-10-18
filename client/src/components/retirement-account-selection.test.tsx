import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InlineAccountInclusion, ProjectionExclusionNotice, type RetirementAccountInclusionKind } from "./retirement-account-selection";

function renderCheckbox(projection: "net-worth" | "income-expense", included: boolean, kind: RetirementAccountInclusionKind) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { gcTime: Infinity } } });
  try {
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <InlineAccountInclusion projection={projection} included={included} kind={kind} accountId={kind === "social-security" || kind === "expected-expenses" ? 0 : 1} accountName="Test account" />
      </QueryClientProvider>,
    );
  } finally { client.clear(); }
}

test("account controls use compact accessible checkboxes instead of separate management sections", () => {
  const included = renderCheckbox("net-worth", true, "asset");
  const excluded = renderCheckbox("net-worth", false, "asset");
  assert.ok(included.includes('type="checkbox"'));
  assert.ok(included.includes('checked=""'));
  assert.ok(!excluded.includes('checked=""'), "excluded accounts remain unchecked and can be restored");
  assert.ok(included.includes("Exclude asset account Test account from the Net worth projection"));
  assert.ok(excluded.includes("Include asset account Test account in the Net worth projection"));
  assert.ok(!included.includes("Manage accounts"));
  assert.ok(!included.includes("Accounts in this projection"));
  assert.ok(!included.includes('role="switch"'));
});

test("checkbox labels scope their changes to the correct projection and account kind", () => {
  assert.ok(renderCheckbox("income-expense", false, "liability").includes(
    "Include liability account Test account in the Income &amp; expenses projection",
  ));
  assert.ok(renderCheckbox("income-expense", true, "asset").includes(
    "Exclude asset account Test account from the Income &amp; expenses projection",
  ));
});

test("custom accounts, pensions, Social Security and the expense baseline all have restorable checkboxes", () => {
  for (const kind of ["net-worth-entry", "income-expense-entry", "pension", "social-security", "expected-expenses"] as const) {
    const projection = kind === "net-worth-entry" ? "net-worth" : "income-expense";
    const included = renderCheckbox(projection, true, kind);
    const excluded = renderCheckbox(projection, false, kind);
    assert.ok(included.includes('type="checkbox"') && included.includes('checked=""'));
    assert.ok(excluded.includes('type="checkbox"') && !excluded.includes('checked=""'));
    assert.ok(!excluded.includes("disabled="), "unchecked custom entries remain available to re-include");
    assert.ok(excluded.includes('aria-label="Include'));
  }
});

test("top exclusion notice stays hidden when everything is included and reports exact counts", () => {
  assert.equal(renderToStaticMarkup(<ProjectionExclusionNotice count={0} />), "");
  const one = renderToStaticMarkup(<ProjectionExclusionNotice count={1} />);
  assert.ok(one.includes("1 account has been excluded from the calculations."));
  assert.ok(one.includes('role="status"'));
  const many = renderToStaticMarkup(<ProjectionExclusionNotice count={12} />);
  assert.ok(many.includes("12 accounts have been excluded from the calculations."));
});
