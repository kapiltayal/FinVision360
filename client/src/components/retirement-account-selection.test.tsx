import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InlineAccountInclusion, ProjectionExclusionNotice } from "./retirement-account-selection";

function renderCheckbox(projection: "net-worth" | "income-expense", included: boolean, kind: "asset" | "liability") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { gcTime: Infinity } } });
  try {
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <InlineAccountInclusion projection={projection} included={included} kind={kind} accountId={1} accountName="Test account" />
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
  assert.ok(included.includes("Exclude asset Test account from the Net worth projection"));
  assert.ok(excluded.includes("Include asset Test account in the Net worth projection"));
  assert.ok(!included.includes("Manage accounts"));
  assert.ok(!included.includes("Accounts in this projection"));
  assert.ok(!included.includes('role="switch"'));
});

test("checkbox labels scope their changes to the correct projection and account kind", () => {
  assert.ok(renderCheckbox("income-expense", false, "liability").includes(
    "Include liability Test account in the Income &amp; expenses projection",
  ));
  assert.ok(renderCheckbox("income-expense", true, "asset").includes(
    "Exclude asset Test account from the Income &amp; expenses projection",
  ));
});

test("top exclusion notice stays hidden when everything is included and reports exact counts", () => {
  assert.equal(renderToStaticMarkup(<ProjectionExclusionNotice count={0} />), "");
  const one = renderToStaticMarkup(<ProjectionExclusionNotice count={1} />);
  assert.ok(one.includes("1 account has been excluded from the calculations."));
  assert.ok(one.includes('role="status"'));
  const many = renderToStaticMarkup(<ProjectionExclusionNotice count={12} />);
  assert.ok(many.includes("12 accounts have been excluded from the calculations."));
});
