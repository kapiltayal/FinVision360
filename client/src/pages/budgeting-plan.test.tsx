import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CircleDollarSign } from "lucide-react";
import { PlanAmountInput, StatementSection } from "./budgeting-plan";

test("historical amount is rounded for display, with no input or increment controls", () => {
  const html = renderToStaticMarkup(<PlanAmountInput value={1234.56} saving={false} readOnly onSave={() => { throw new Error("Cannot save"); }} />);
  assert.ok(html.includes("$1,235"));
  assert.ok(!html.includes("<input"));
  assert.ok(!html.includes("<button"));
  const unknown = renderToStaticMarkup(<PlanAmountInput saving={false} readOnly onSave={() => {}} />);
  assert.ok(unknown.includes("—"));
  assert.ok(!unknown.includes("$0"));
});

test("historical statement hides trends, averages, copy/delete controls and shows known amounts only", () => {
  const html = renderToStaticMarkup(<StatementSection
    title="Income" subtitle="Historical" icon={CircleDollarSign} tone="income" savingKey={null} readOnly defaultOpen
    rows={[
      { key: "income:salary", label: "Salary", planned: 100, actual: 80, average: 9876, history: [{ month: "2026-09", amount: 9876 }], removable: true },
      { key: "income:bonus", label: "Bonus", actual: 0, average: 1234, history: [] },
    ]}
    onSave={() => {}} onCopy={() => {}} onRemove={() => {}}
    footer={<input aria-label="Add category" />}
  />);
  const rows = html.match(/<tbody[^>]*>([\s\S]*)<\/tbody>/)![1];
  assert.ok(!rows.includes("<input"));
  assert.ok(!rows.includes("<button"));
  assert.ok(!rows.includes("<svg"));
  assert.ok(!rows.includes("9,876"));
  assert.ok(!rows.includes("1,234"));
  assert.ok(rows.includes("$100"));
  assert.ok(rows.includes("—"), "uncaptured defaults are unavailable, not zero");
  assert.ok(html.includes("Saved amounts only"));
  assert.ok(!html.includes("Add category"));
});

test("current and future statements retain trend, average, copy and editable amount controls", () => {
  const html = renderToStaticMarkup(<StatementSection
    title="Income" subtitle="Editable" icon={CircleDollarSign} tone="income" savingKey={null} defaultOpen
    rows={[{ key: "income:salary", label: "Salary", actual: 0, average: 9876, history: [{ month: "2026-09", amount: 9876 }] }]}
    onSave={() => {}} onCopy={() => {}}
  />);
  assert.ok(html.includes("$9,876"));
  assert.ok(html.includes("1-month trend"));
  assert.ok(html.includes("monthly average to Salary plan"));
  assert.ok(html.includes("<input"));
  assert.ok(html.includes("Increase planned amount"));
});
