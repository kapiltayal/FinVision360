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

test("flat two-axis bubbles retain one legend, pan, zoom, reset and keyboard controls without shading", () => {
  const html = renderToStaticMarkup(<LiabilityBubbleChart items={[debt(1)]} />);
  for (const label of ['aria-label="Zoom in"', 'aria-label="Zoom out"',
    'aria-label="Reset chart view"', "MONTHS REMAINING", "APR %",
    "Use arrow keys to pan", "Circle area = balance"]) assert.ok(html.includes(label), label);
  assert.ok(!html.includes("X · MONTHS REMAINING"));
  assert.ok(!html.includes("Y · APR %"));
  assert.ok(html.includes('viewBox="0 0 960 560"'));
  assert.ok(!html.includes("radialGradient"));
  assert.ok(!html.includes("feGaussianBlur"));
  assert.equal((html.match(/aria-label="Bubble chart legend"/g) ?? []).length, 1);
  assert.ok(html.includes("Debt landscape"));
  assert.ok(!html.includes("/ two-axis view"));
  assert.ok(!html.includes("Drag to pan"));
  assert.ok(!html.includes("Keyboard: arrows pan"));
  assert.ok(html.includes('<h2 class="font-semibold">Debt landscape</h2>'));
  assert.ok(html.includes('<p class="mt-0.5 text-xs text-muted-foreground">Months remaining vs APR;'));
  assert.match(html, /class="[^"]*\btext-xs\b[^"]*" aria-label="Bubble chart legend"/);
  assert.ok(html.indexOf('class="liability-bubble-toolbar"') < html.indexOf('aria-label="Bubble chart legend"'));
  assert.ok(!html.includes("3D-styled"));
  assert.ok(!html.includes("Z · REMAINING INTEREST"));
  assert.ok(!html.includes(">Rotate<"));
  assert.ok(!html.toLowerCase().includes("orbit"));
  assert.ok(!html.includes("NaN"));
  for (const label of ["Highest APR First", "Smallest Balance First", "Longest Duration First"]) {
    assert.ok(!html.includes(label), "Gantt-only sorting is not part of the bubble chart");
  }
});

test("flat circles retain exact debt data and render small debts above larger overlapping bubbles", () => {
  const items = [debt(1), debt(2, { balance: 500.17, apr: 8, monthsRemaining: 24 }), debt(3, { apr: 0, monthsRemaining: 6 })];
  const html = renderToStaticMarkup(<LiabilityBubbleChart items={items} />);
  assert.equal((html.match(/<circle /g) ?? []).length, items.length, "each debt has one flat circle without highlights or shadow circles");
  for (const circle of html.match(/<circle [^>]+>/g) ?? []) {
    assert.ok(circle.includes('stroke="none"'), "bubbles have no outlines");
    assert.ok(!circle.includes("stroke-width"));
  }
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
  assert.ok(html.includes("(Balance $1,000.34 · APR unknown · Months 12)"));
  assert.ok(html.includes("(Balance $1,000.34 · APR 20.00% · Months unknown)"));
  assert.ok(html.includes("(Balance $0.00 · APR 20.00% · Months 0 — paid off)"));
  assert.ok(!html.includes("Missing usable"));
  assert.ok(!html.includes("rounded-sm bg-background/70"));
  assert.ok(!html.includes('class="bubble-node"'));
});

test("empty charts are safe and repeated charts have distinct plot-clipping identifiers", () => {
  const empty = renderToStaticMarkup(<LiabilityBubbleChart items={[]} />);
  assert.ok(empty.includes("No debts have usable"));
  const html = renderToStaticMarkup(<div>
    <LiabilityBubbleChart items={[debt(1, { name: "<script>unsafe</script>" })]} />
    <LiabilityBubbleChart items={[debt(2)]} />
  </div>);
  const ids = Array.from(html.matchAll(/<clipPath id="([^"]+-plot-clip)"/g), (match) => match[1]);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  assert.ok(!html.includes("<script>unsafe</script>"));
  assert.ok(html.includes("&lt;script&gt;unsafe&lt;/script&gt;"));
});
