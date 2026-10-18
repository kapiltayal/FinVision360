import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LiabilityBubbleChart } from "./liability-bubble-chart";
import { buildBubbleScene } from "../lib/liability-bubbles";
import { estimateRemainingInterest, type ExposureItem } from "../lib/liability-map";
import { formatCurrencyFull } from "../lib/format";

const debt = (id: number, change: Partial<ExposureItem> = {}): ExposureItem => ({
  id, name: `Loan ${id}`, balance: 1000.34, apr: 20, monthlyPayment: 100, maturityDate: null,
  monthsRemaining: 12, durationSource: "override", issue: null, ...change,
});

test("two-axis chart keeps spherical shading, pan, zoom, reset and keyboard controls without orbit", () => {
  const html = renderToStaticMarkup(<LiabilityBubbleChart items={[debt(1)]} />);
  for (const label of ["Drag to pan", 'aria-label="Zoom in"', 'aria-label="Zoom out"',
    'aria-label="Reset chart view"', "X · MONTHS REMAINING", "Y · APR %",
    "Keyboard: arrows pan", "pinch to zoom", "Bubble size = balance"]) assert.ok(html.includes(label), label);
  assert.ok(html.includes('viewBox="0 0 960 560"'));
  assert.ok(html.includes("radialGradient"));
  assert.ok(!html.includes("Z · REMAINING INTEREST"));
  assert.ok(!html.includes(">Rotate<"));
  assert.ok(!html.toLowerCase().includes("orbit"));
  assert.ok(!html.includes("NaN"));
  for (const label of ["Highest APR First", "Smallest Balance First", "Longest Duration First"]) {
    assert.ok(!html.includes(label), "Gantt-only sorting is not part of the bubble chart");
  }
});

test("accessible spheres retain exact debt data and render small debts above larger overlapping spheres", () => {
  const items = [debt(1), debt(2, { balance: 500.17, apr: 8, monthsRemaining: 24 }), debt(3, { apr: 0, monthsRemaining: 6 })];
  const html = renderToStaticMarkup(<LiabilityBubbleChart items={items} />);
  for (const item of items) {
    assert.ok(html.includes(`${item.name}, balance ${formatCurrencyFull(item.balance)}`));
    assert.ok(html.includes(`total remaining interest ${formatCurrencyFull(estimateRemainingInterest(item)!)}`));
  }
  const order = buildBubbleScene(items).points
    .map((point) => ({ id: point.item.id, radius: point.radius }))
    .sort((a, b) => b.radius - a.radius);
  const locations = order.map((point) => html.indexOf(`aria-label="Loan ${point.id}, balance`));
  assert.ok(locations.every((location) => location >= 0));
  assert.ok(locations[0] < locations[1] && locations[1] < locations[2]);
});

test("fixed coordinate frame stays outside the clipped bubble viewport", () => {
  const html = renderToStaticMarkup(<LiabilityBubbleChart items={[debt(1)]} />);
  const clipId = html.match(/<clipPath id="([^"]+-plot-clip)"/)?.[1];
  assert.ok(clipId, "the plot has a unique clipping boundary");
  assert.ok(html.includes('<rect x="112" y="88" width="712" height="356"'));
  const contentStart = html.indexOf(`<g clip-path="url(#${clipId})">`);
  const bubbleStart = html.indexOf('data-bubble-select="true"');
  const axesStart = html.indexOf('<g class="bubble-axes">');
  assert.ok(contentStart >= 0 && contentStart < bubbleStart && bubbleStart < axesStart);
  const axes = html.slice(axesStart, html.indexOf("</g>", axesStart));
  assert.ok(axes.includes('d="M112,444 L824,444"'));
  assert.ok(axes.includes('d="M112,444 L112,88"'));
  assert.ok(!axes.includes("clip-path"));
  const second = renderToStaticMarkup(<LiabilityBubbleChart items={[debt(2, { apr: 40, monthsRemaining: 300 })]} />);
  const secondAxesStart = second.indexOf('<g class="bubble-axes">');
  assert.equal(second.slice(secondAxesStart, second.indexOf("</g>", secondAxesStart)), axes);
});

test("unknown inputs and paid-off debts remain disclosed rather than becoming zero-axis bubbles", () => {
  const html = renderToStaticMarkup(<LiabilityBubbleChart items={[
    debt(1, { name: "Unknown APR", apr: null }), debt(2, { name: "Unknown duration", monthsRemaining: null }),
    debt(3, { name: "Paid loan", balance: 0, durationSource: "paid", monthsRemaining: 0 }),
  ]} />);
  assert.ok(html.includes("No debts have usable balance, APR, and remaining duration to plot yet."));
  assert.ok(html.includes("Not shown in the plot"));
  for (const name of ["Unknown APR", "Unknown duration", "Paid loan"]) assert.ok(html.includes(name));
  assert.ok(html.includes("Unknown APR or duration is never treated as zero."));
  assert.ok(html.includes("Paid off — no remaining balance."));
  assert.ok(!html.includes('class="bubble-node"'));
});

test("empty charts are safe and repeated charts have distinct sphere-gradient identifiers", () => {
  const empty = renderToStaticMarkup(<LiabilityBubbleChart items={[]} />);
  assert.ok(empty.includes("No debts have usable"));
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
