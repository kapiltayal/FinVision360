import { estimateRemainingInterest, type ExposureItem } from "./liability-map";

export type BubbleCamera = { yaw: number; pitch: number; zoom: number; panX: number; panY: number };
export type BubblePosition = { x: number; y: number; z: number };
export type BubblePoint = { item: ExposureItem; interest: number; position: BubblePosition; radius: number };
export const BUBBLE_VIEWBOX = { width: 960, height: 560 } as const;
export const DEFAULT_BUBBLE_CAMERA: BubbleCamera = { yaw: -0.58, pitch: 0.3, zoom: 1, panX: 0, panY: 0 };

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Camera state never changes source balances, APRs or planning durations. */
export function clampBubbleCamera(camera: BubbleCamera): BubbleCamera {
  const yaw = finite(camera.yaw, DEFAULT_BUBBLE_CAMERA.yaw);
  return {
    yaw: ((yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI,
    pitch: clamp(finite(camera.pitch, DEFAULT_BUBBLE_CAMERA.pitch), -1.25, 1.25),
    zoom: clamp(finite(camera.zoom, 1), 0.45, 3.5),
    panX: clamp(finite(camera.panX, 0), -1600, 1600),
    panY: clamp(finite(camera.panY, 0), -1600, 1600),
  };
}

/** True perspective projection after yaw and pitch, in SVG viewBox coordinates. */
export function projectBubblePoint(position: BubblePosition, input: BubbleCamera) {
  const camera = clampBubbleCamera(input);
  const x = finite(position.x, 0), y = finite(position.y, 0), z = finite(position.z, 0);
  const turnedX = x * Math.cos(camera.yaw) + z * Math.sin(camera.yaw);
  const turnedZ = -x * Math.sin(camera.yaw) + z * Math.cos(camera.yaw);
  const turnedY = y * Math.cos(camera.pitch) - turnedZ * Math.sin(camera.pitch);
  const depth = y * Math.sin(camera.pitch) + turnedZ * Math.cos(camera.pitch);
  const scale = (5 / Math.max(0.5, 5 + depth)) * camera.zoom;
  return {
    x: BUBBLE_VIEWBOX.width / 2 + turnedX * 155 * scale + camera.panX,
    y: BUBBLE_VIEWBOX.height / 2 - turnedY * 155 * scale + camera.panY,
    depth, scale,
  };
}

/** Zoom around the pointer (or plot center) rather than making the scene jump. */
export function zoomBubbleCamera(input: BubbleCamera, zoom: number, anchor?: { x: number; y: number }): BubbleCamera {
  const camera = clampBubbleCamera(input);
  const next = clampBubbleCamera({ ...camera, zoom });
  const ratio = next.zoom / camera.zoom;
  const x = finite(anchor?.x ?? BUBBLE_VIEWBOX.width / 2, BUBBLE_VIEWBOX.width / 2) - BUBBLE_VIEWBOX.width / 2;
  const y = finite(anchor?.y ?? BUBBLE_VIEWBOX.height / 2, BUBBLE_VIEWBOX.height / 2) - BUBBLE_VIEWBOX.height / 2;
  return clampBubbleCamera({
    ...next,
    panX: x - (x - camera.panX) * ratio,
    panY: y - (y - camera.panY) * ratio,
  });
}

export function buildBubbleScene(items: ExposureItem[]) {
  const candidates: { item: ExposureItem; interest: number }[] = [];
  const unplotted: { item: ExposureItem; reason: string }[] = [];
  for (const item of items) {
    if (!Number.isFinite(item.balance) || item.balance <= 0) {
      unplotted.push({ item, reason: item.balance === 0 ? "Paid off — no remaining balance." : "A usable balance is needed." });
      continue;
    }
    const missing = [];
    if (item.apr === null || !Number.isFinite(item.apr) || item.apr < 0) missing.push("APR");
    if (item.monthsRemaining === null || !Number.isFinite(item.monthsRemaining) || item.monthsRemaining <= 0) missing.push("remaining duration");
    if (missing.length) {
      unplotted.push({ item, reason: `Missing usable ${missing.join(" and ")}. Adjust the account or planning duration to plot it.` });
      continue;
    }
    const interest = estimateRemainingInterest(item);
    if (interest === null || !Number.isFinite(interest) || interest < 0) {
      unplotted.push({ item, reason: "A usable remaining-interest estimate is needed." });
      continue;
    }
    candidates.push({ item, interest });
  }
  const maxMonths = Math.max(1, ...candidates.map(({ item }) => item.monthsRemaining!));
  const maxApr = Math.max(1, ...candidates.map(({ item }) => item.apr!));
  const maxInterest = Math.max(1, ...candidates.map(({ interest }) => interest));
  const maxBalance = Math.max(0, ...candidates.map(({ item }) => item.balance));
  const points: BubblePoint[] = candidates.map(({ item, interest }) => ({
    item, interest,
    position: {
      x: item.monthsRemaining! / maxMonths * 2 - 1,
      y: item.apr! / maxApr * 2 - 1,
      z: interest / maxInterest * 2 - 1,
    },
    // Area encodes balance; the minimum radius keeps small debts discoverable.
    radius: Math.max(6, 42 * Math.sqrt(item.balance / maxBalance)),
  }));
  return { points, unplotted, maxMonths, maxApr, maxInterest, maxBalance };
}
