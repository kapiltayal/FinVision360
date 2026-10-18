import assert from "node:assert/strict";
import test from "node:test";
import { buildBubbleScene, BUBBLE_PLOT, clampBubbleCamera, DEFAULT_BUBBLE_CAMERA, getBubbleAxisTicks, projectBubblePoint, zoomBubbleCamera } from "./liability-bubbles";
import { estimateRemainingInterest, type ExposureItem } from "./liability-map";

const debt = (id: number, change: Partial<ExposureItem> = {}): ExposureItem => ({
  id, name: `Loan ${id}`, balance: 10000, apr: 8, monthlyPayment: 500, maturityDate: null,
  monthsRemaining: 24, durationSource: "override", issue: null, ...change,
});

test("two bubble axes encode duration and APR, with interest in details and area proportional to balance", () => {
  const items = [debt(1), debt(2, { balance: 2500, apr: 4, monthsRemaining: 12 }), debt(3, { balance: 1 })];
  const scene = buildBubbleScene(items);
  assert.equal(scene.points.length, 3);
  assert.equal(scene.points[0].interest, estimateRemainingInterest(items[0]));
  assert.ok(Math.abs(scene.points[0].position.x - (2 / 1.05 - 1)) < 1e-10);
  assert.ok(Math.abs(scene.points[1].position.x - (1 / 1.05 - 1)) < 1e-10);
  assert.ok(Math.abs(scene.points[1].position.y - (1 / 1.05 - 1)) < 1e-10);
  assert.deepEqual(Object.keys(scene.points[0].position).sort(), ["x", "y"]);
  assert.equal(scene.points[0].radius, 42);
  assert.equal(scene.points[1].radius, 21);
  assert.equal(scene.points[2].radius, 6);
  assert.equal(scene.points[0].radius ** 2 / scene.points[1].radius ** 2, 4);
  assert.equal(items[0].balance, 10000, "scene construction never modifies financial inputs");
});

test("initial and reset axis maxima are 5% above the plotted maxima, including APRs below 1%", () => {
  const items = [debt(1), debt(2, { apr: 4, monthsRemaining: 12 })];
  const scene = buildBubbleScene(items);
  assert.equal(scene.maxMonths, 24 * 1.05);
  assert.equal(scene.maxApr, 8 * 1.05);
  const ticks = getBubbleAxisTicks(DEFAULT_BUBBLE_CAMERA, scene.maxMonths, scene.maxApr);
  assert.equal(ticks.x[4].value, scene.maxMonths);
  assert.equal(ticks.y[4].value, scene.maxApr);
  const highestPoint = projectBubblePoint(scene.points[0].position, DEFAULT_BUBBLE_CAMERA);
  assert.ok(highestPoint.x < BUBBLE_PLOT.right && highestPoint.y > BUBBLE_PLOT.top);
  assert.equal(buildBubbleScene([debt(1, { apr: 0.5 })]).maxApr, 0.5 * 1.05);
  assert.equal(buildBubbleScene([debt(1, { apr: 0 })]).maxApr, 1);
  assert.equal(items[0].apr, 8);
  assert.equal(items[0].monthsRemaining, 24);
});

test("unknown APR/duration are not plotted at zero; an explicit zero APR remains a valid point", () => {
  const scene = buildBubbleScene([
    debt(1, { apr: null }), debt(2, { monthsRemaining: null }),
    debt(3, { apr: 0 }), debt(4, { balance: 0, monthsRemaining: 0, durationSource: "paid" }),
  ]);
  assert.deepEqual(scene.points.map((point) => point.item.id), [3]);
  assert.equal(scene.points[0].interest, 0);
  assert.equal(scene.points[0].position.y, -1);
  assert.equal(scene.unplotted.length, 3);
  assert.ok(scene.unplotted.find((row) => row.item.id === 1)?.reason.includes("APR"));
  assert.ok(scene.unplotted.find((row) => row.item.id === 2)?.reason.includes("duration"));
  assert.ok(scene.unplotted.find((row) => row.item.id === 4)?.reason.includes("Paid off"));
});

test("empty, single-loan and malformed scenes remain finite", () => {
  const empty = buildBubbleScene([]);
  assert.equal(empty.points.length, 0);
  assert.equal(empty.maxMonths, 1);
  const scene = buildBubbleScene([debt(1, { apr: 0 }), debt(2, { balance: Number.NaN }), debt(3, { monthsRemaining: Infinity })]);
  assert.equal(scene.points.length, 1);
  for (const value of Object.values(scene.points[0].position)) assert.ok(Number.isFinite(value));
});

test("axes stay perpendicular with no depth or rotation and pan moves points without changing measurements", () => {
  const origin = projectBubblePoint({ x: -1, y: -1 }, DEFAULT_BUBBLE_CAMERA);
  const xEnd = projectBubblePoint({ x: 1, y: -1 }, DEFAULT_BUBBLE_CAMERA);
  const yEnd = projectBubblePoint({ x: -1, y: 1 }, DEFAULT_BUBBLE_CAMERA);
  assert.equal(origin.x, BUBBLE_PLOT.left);
  assert.equal(origin.y, BUBBLE_PLOT.bottom);
  assert.equal(xEnd.y, origin.y);
  assert.equal(yEnd.x, origin.x);
  assert.equal(xEnd.scale, yEnd.scale, "there is no perspective size distortion");
  const panned = projectBubblePoint({ x: -1, y: -1 }, { ...DEFAULT_BUBBLE_CAMERA, panX: 50, panY: -30 });
  assert.equal(panned.x, origin.x + 50);
  assert.equal(panned.y, origin.y - 30);
});

test("different interest totals do not add a third spatial coordinate or move equal-APR/equal-duration debts", () => {
  const scene = buildBubbleScene([debt(1), debt(2, { balance: 2500 })]);
  assert.notEqual(scene.points[0].interest, scene.points[1].interest);
  assert.deepEqual(scene.points[0].position, scene.points[1].position);
});

test("axis screen positions remain fixed while pan and zoom change the visible data range", () => {
  const initial = getBubbleAxisTicks(DEFAULT_BUBBLE_CAMERA, 120, 24);
  const camera = { zoom: 2, panX: 71, panY: -35 };
  const moved = getBubbleAxisTicks(camera, 120, 24);
  assert.deepEqual(moved.x.map((tick) => tick.position), initial.x.map((tick) => tick.position));
  assert.deepEqual(moved.y.map((tick) => tick.position), initial.y.map((tick) => tick.position));
  assert.deepEqual(initial.x.map((tick) => tick.value), [0, 30, 60, 90, 120]);
  assert.deepEqual(initial.y.map((tick) => tick.value), [0, 6, 12, 18, 24]);
  assert.equal(moved.x[4].value - moved.x[0].value, 60);
  assert.equal(moved.y[4].value - moved.y[0].value, 12);
  for (const tick of moved.x) {
    const point = projectBubblePoint({ x: tick.value / 120 * 2 - 1, y: 0 }, camera);
    assert.ok(Math.abs(point.x - tick.position) < 1e-8);
  }
  for (const tick of moved.y) {
    const point = projectBubblePoint({ x: 0, y: tick.value / 24 * 2 - 1 }, camera);
    assert.ok(Math.abs(point.y - tick.position) < 1e-8);
  }
  assert.deepEqual(getBubbleAxisTicks(DEFAULT_BUBBLE_CAMERA, 120, 24), initial);
});

test("zoom preserves pointer anchoring, and camera state is bounded and recoverable by reset defaults", () => {
  const position = { x: 0.7, y: -0.3 };
  const before = projectBubblePoint(position, DEFAULT_BUBBLE_CAMERA);
  const camera = zoomBubbleCamera(DEFAULT_BUBBLE_CAMERA, 2, before);
  const after = projectBubblePoint(position, camera);
  assert.ok(Math.abs(after.x - before.x) < 1e-10);
  assert.ok(Math.abs(after.y - before.y) < 1e-10);
  assert.equal(zoomBubbleCamera(camera, 999).zoom, 3.5);
  assert.equal(zoomBubbleCamera(camera, 0).zoom, 0.45);
  const safe = clampBubbleCamera({ zoom: NaN, panX: Infinity, panY: -1e8 });
  assert.ok(Object.values(safe).every(Number.isFinite));
  assert.equal(safe.panY, -1600);
  assert.deepEqual(DEFAULT_BUBBLE_CAMERA, { zoom: 1, panX: 0, panY: 0 });
});
