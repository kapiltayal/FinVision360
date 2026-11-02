import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BeneficiaryAllocationView } from "./beneficiary-allocation-view";
import { summarizeBeneficiaryAllocations } from "@/lib/estate-beneficiary-allocation";

test("beneficiary cards offer an accessible Edit action for assigned and unused saved people", () => {
  const summary = summarizeBeneficiaryAllocations(
    [{ id: 1, name: "Account", value: "100", institution: null }],
    [{
      assetId: 1, hasBeneficiary: true, beneficiaryName: null,
      beneficiaries: [{
        id: 1, designationId: 1, userId: "fixture", assetId: 1, beneficiaryId: 10,
        beneficiaryName: "Old name", allocationPercentage: "50", notes: null,
      }],
    }],
    [{ id: 10, name: "Updated name", normalizedName: "updated name" }, { id: 11, name: "Unused", normalizedName: "unused" }],
  );
  const html = renderToStaticMarkup(createElement(BeneficiaryAllocationView, { summary, onEdit() {} }));
  assert.ok(html.includes('aria-label="Edit beneficiary Updated name"'));
  assert.ok(html.includes('data-testid="button-edit-beneficiary-10"'));
  assert.ok(html.includes('data-testid="button-edit-beneficiary-11"'));
  assert.ok(html.indexOf(">Updated name</h3>") < html.indexOf('data-testid="button-edit-beneficiary-10"'));
  assert.ok(html.indexOf('data-testid="button-edit-beneficiary-10"') < html.indexOf("$50"));
  assert.ok(!html.includes("Old name"), "latest saved display name wins over stale snapshots");
  assert.equal((html.match(/title="Edit beneficiary"/g) ?? []).length, 2, "unassigned balance has no Edit action");
  assert.equal(summary.totalAssignedValue, 50);
  assert.equal(summary.totalUnassignedValue, 50);
});
