import assert from "node:assert/strict";
import test from "node:test";
import { buildBubbleScene, clampBubbleCamera, DEFAULT_BUBBLE_CAMERA, projectBubblePoint, zoomBubbleCamera } from "./liability-bubbles";
import { estimateRemainingInterest, type ExposureItem } from "./liability-map";

const debt = (id: number, change: Partial<ExposureItem> = {}): ExposureItem => ({
  id, name: `Loan ${id}`, balance: 10000, apr: 8, monthlyPayment: 500, maturityDate: null,
  monthsRemaining: 24, durationSource: "override", issue: null, ...change,
});

test("bubble axes encode actual duration, APR and shared amortized interest, with area proportional to balance", () => {
  const items = [debt(1), debt(2, { balance: 2500, apr: 4, monthsRemaining: 12 }), debt(3, { balance: 1 })];
  const scene = buildBubbleScene(items);
  assert.equal(scene.points.length, 3);
  assert.equal(scene.points[0].interest, estimateRemainingInterest(items[0]));
  assert.equal(scene.points[0].position.x, 1);
  assert.equal(scene.points[1].position.x, 0);
  assert.equal(scene.points[1].position.y, 0);
  assert.equal(scene.points[0].radius, 42);
  assert.equal(scene.points[1].radius, 21);
  assert.equal(scene.points[2].radius, 6);
  assert.equal(scene.points[0].radius ** 2 / scene.points[1].radius ** 2, 4);
  assert.equal(items[0].balance, 10000, "scene construction never modifies financial inputs");
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
  assert.equal(empty.maxInterest, 1);
  const scene = buildBubbleScene([debt(1, { apr: 0 }), debt(2, { balance: Number.NaN }), debt(3, { monthsRemaining: Infinity })]);
  assert.equal(scene.points.length, 1);
  for (const value of Object.values(scene.points[0].position)) assert.ok(Number.isFinite(value));
});

test("perspective uses depth and orbit changes projected coordinates; pan moves points without changing measurements", () => {
  const camera = { ...DEFAULT_BUBBLE_CAMERA, yaw: 0, pitch: 0 };
  const near = projectBubblePoint({ x: 1, y: 1, z: -1 }, camera);
  const far = projectBubblePoint({ x: 1, y: 1, z: 1 }, camera);
  assert.ok(near.scale > far.scale);
  assert.notEqual(near.x, far.x);
  const orbited = projectBubblePoint({ x: 1, y: 1, z: -1 }, { ...camera, yaw: 0.4 });
  assert.notEqual(orbited.x, near.x);
  const panned = projectBubblePoint({ x: 1, y: 1, z: -1 }, { ...camera, panX: 50, panY: -30 });
  assert.equal(panned.x, near.x + 50);
  assert.equal(panned.y, near.y - 30);
  assert.equal(panned.depth, near.depth);
});

test("zoom preserves pointer anchoring, and camera state is bounded and recoverable by reset defaults", () => {
  const position = { x: 0.7, y: -0.3, z: 0.2 };
  const before = projectBubblePoint(position, DEFAULT_BUBBLE_CAMERA);
  const camera = zoomBubbleCamera(DEFAULT_BUBBLE_CAMERA, 2, before);
  const after = projectBubblePoint(position, camera);
  assert.ok(Math.abs(after.x - before.x) < 1e-10);
  assert.ok(Math.abs(after.y - before.y) < 1e-10);
  assert.equal(zoomBubbleCamera(camera, 999).zoom, 3.5);
  assert.equal(zoomBubbleCamera(camera, 0).zoom, 0.45);
  const safe = clampBubbleCamera({ yaw: NaN, pitch: Infinity, zoom: NaN, panX: Infinity, panY: -1e8 });
  assert.ok(Object.values(safe).every(Number.isFinite));
  assert.equal(safe.panY, -1600);
  assert.deepEqual(DEFAULT_BUBBLE_CAMERA, { yaw: -0.58, pitch: 0.3, zoom: 1, panX: 0, panY: 0 });
});
