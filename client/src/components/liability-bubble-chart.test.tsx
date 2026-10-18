import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LiabilityBubbleChart } from "./liability-bubble-chart";
import { buildBubbleScene, DEFAULT_BUBBLE_CAMERA, projectBubblePoint } from "../lib/liability-bubbles";
import { estimateRemainingInterest, type ExposureItem } from "../lib/liability-map";
import { formatCurrencyFull } from "../lib/format";

const debt = (id: number, change: Partial<ExposureItem> = {}): ExposureItem => ({
  id, name: `Loan ${id}`, balance: 1000.34, apr: 20, monthlyPayment: 100, maturityDate: null,
  monthsRemaining: 12, durationSource: "override", issue: null, ...change,
});

test("3D chart exposes pan, orbit, zoom, reset, keyboard instructions and all quantitative axes", () => {
  const html = renderToStaticMarkup(<LiabilityBubbleChart items={[debt(1)]} />);
  for (const label of ["Pan", "Rotate", 'aria-label="Zoom in"', 'aria-label="Zoom out"',
    'aria-label="Reset chart view"', "X · MONTHS LEFT", "Y · APR %", "Z · REMAINING INTEREST",
    "Keyboard: arrows pan", "pinch to zoom", "Bubble area follows balance"]) assert.ok(html.includes(label), label);
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(html.includes('viewBox="0 0 960 560"'));
  assert.ok(html.includes("radialGradient"));
  assert.ok(!html.includes("NaN"));
});

test("accessible spheres retain exact debt data and render far-to-near for true perspective", () => {
  const items = [debt(1), debt(2, { balance: 500.17, apr: 8, monthsRemaining: 24 }), debt(3, { apr: 0, monthsRemaining: 6 })];
  const html = renderToStaticMarkup(<LiabilityBubbleChart items={items} />);
  for (const item of items) {
    assert.ok(html.includes(`${item.name}, balance ${formatCurrencyFull(item.balance)}`));
    assert.ok(html.includes(`total remaining interest ${formatCurrencyFull(estimateRemainingInterest(item)!)}`));
  }
  const order = buildBubbleScene(items).points
    .map((point) => ({ id: point.item.id, depth: projectBubblePoint(point.position, DEFAULT_BUBBLE_CAMERA).depth }))
    .sort((a, b) => b.depth - a.depth);
  const locations = order.map((point) => html.indexOf(`aria-label="Loan ${point.id}, balance`));
  assert.ok(locations.every((location) => location >= 0));
  assert.ok(locations[0] < locations[1] && locations[1] < locations[2]);
});

test("unknown inputs and paid-off debts remain disclosed rather than becoming zero-axis bubbles", () => {
  const html = renderToStaticMarkup(<LiabilityBubbleChart items={[
    debt(1, { name: "Unknown APR", apr: null }), debt(2, { name: "Unknown duration", monthsRemaining: null }),
    debt(3, { name: "Paid loan", balance: 0, durationSource: "paid", monthsRemaining: 0 }),
  ]} />);
  assert.ok(html.includes("No liabilities have complete balance, APR, and remaining duration inputs to plot yet."));
  assert.ok(html.includes("Not shown in the plot"));
  for (const name of ["Unknown APR", "Unknown duration", "Paid loan"]) assert.ok(html.includes(name));
  assert.ok(html.includes("Unknown APR or duration is never treated as zero."));
  assert.ok(html.includes("Paid off — no remaining balance."));
  assert.ok(!html.includes('class="bubble-node"'));
});

test("empty charts are safe and repeated charts have distinct sphere-gradient identifiers", () => {
  const empty = renderToStaticMarkup(<LiabilityBubbleChart items={[]} />);
  assert.ok(empty.includes("No liabilities have complete"));
  const html = renderToStaticMarkup(<div>
    <LiabilityBubbleChart items={[debt(1, { name: "<script>unsafe</script>" })]} />
    <LiabilityBubbleChart items={[debt(2)]} />
  </div>);
  const ids = Array.from(html.matchAll(/radialGradient id="([^"]+)-high"/g), (match) => match[1]);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  assert.ok(!html.includes("<script>unsafe</script>"));
  assert.ok(html.includes("&lt;script&gt;unsafe&lt;/script&gt;"));
});
