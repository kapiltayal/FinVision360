import { estimateRemainingInterest, type ExposureItem } from "./liability-map";

export type BubbleCamera = { zoom: number; panX: number; panY: number };
export type BubblePosition = { x: number; y: number };
export type BubblePoint = { item: ExposureItem; interest: number | null; position: BubblePosition; radius: number };
export const BUBBLE_VIEWBOX = { width: 960, height: 560 } as const;
export const BUBBLE_PLOT = { left: 112, right: 824, top: 88, bottom: 444 } as const;
export const DEFAULT_BUBBLE_CAMERA: BubbleCamera = { zoom: 1, panX: 0, panY: 0 };
const centerX = (BUBBLE_PLOT.left + BUBBLE_PLOT.right) / 2;
const centerY = (BUBBLE_PLOT.top + BUBBLE_PLOT.bottom) / 2;

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Camera state never changes source balances, APRs or planning durations. */
export function clampBubbleCamera(camera: BubbleCamera): BubbleCamera {
  return {
    zoom: clamp(finite(camera.zoom, 1), 0.45, 3.5),
    panX: clamp(finite(camera.panX, 0), -1600, 1600),
    panY: clamp(finite(camera.panY, 0), -1600, 1600),
  };
}

/** Two perpendicular data axes; only the spheres' shading is three-dimensional. */
export function projectBubblePoint(position: BubblePosition, input: BubbleCamera) {
  const camera = clampBubbleCamera(input);
  const x = finite(position.x, 0), y = finite(position.y, 0);
  return {
    x: centerX + x * (BUBBLE_PLOT.right - BUBBLE_PLOT.left) / 2 * camera.zoom + camera.panX,
    y: centerY - y * (BUBBLE_PLOT.bottom - BUBBLE_PLOT.top) / 2 * camera.zoom + camera.panY,
    scale: camera.zoom,
  };
}

/** Screen-space axes remain fixed; labels invert the data viewport transformation. */
export function getBubbleAxisTicks(input: BubbleCamera, maxMonths: number, maxApr: number) {
  const camera = clampBubbleCamera(input);
  const width = BUBBLE_PLOT.right - BUBBLE_PLOT.left;
  const height = BUBBLE_PLOT.bottom - BUBBLE_PLOT.top;
  const ratios = [0, 0.25, 0.5, 0.75, 1];
  return {
    x: ratios.map((ratio) => {
      const position = BUBBLE_PLOT.left + width * ratio;
      const normalized = (position - centerX - camera.panX) / (width / 2 * camera.zoom);
      return { position, value: (normalized + 1) / 2 * maxMonths };
    }),
    y: ratios.map((ratio) => {
      const position = BUBBLE_PLOT.bottom - height * ratio;
      const normalized = (centerY + camera.panY - position) / (height / 2 * camera.zoom);
      return { position, value: (normalized + 1) / 2 * maxApr };
    }),
  };
}

/** Zoom around the pointer (or plot center) rather than making the scene jump. */
export function zoomBubbleCamera(input: BubbleCamera, zoom: number, anchor?: { x: number; y: number }): BubbleCamera {
  const camera = clampBubbleCamera(input);
  const next = clampBubbleCamera({ ...camera, zoom });
  const ratio = next.zoom / camera.zoom;
  const x = finite(anchor?.x ?? centerX, centerX) - centerX;
  const y = finite(anchor?.y ?? centerY, centerY) - centerY;
  return clampBubbleCamera({
    ...next,
    panX: x - (x - camera.panX) * ratio,
    panY: y - (y - camera.panY) * ratio,
  });
}

export function buildBubbleScene(items: ExposureItem[]) {
  const candidates: { item: ExposureItem; interest: number | null }[] = [];
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
    candidates.push({ item, interest: interest !== null && Number.isFinite(interest) && interest >= 0 ? interest : null });
  }
  const maxMonths = Math.max(1, ...candidates.map(({ item }) => item.monthsRemaining!));
  const maxApr = Math.max(1, ...candidates.map(({ item }) => item.apr!));
  const maxBalance = Math.max(0, ...candidates.map(({ item }) => item.balance));
  const points: BubblePoint[] = candidates.map(({ item, interest }) => ({
    item, interest,
    position: {
      x: item.monthsRemaining! / maxMonths * 2 - 1,
      y: item.apr! / maxApr * 2 - 1,
    },
    // Area encodes balance; the minimum radius keeps small debts discoverable.
    radius: Math.max(6, 42 * Math.sqrt(item.balance / maxBalance)),
  }));
  return { points, unplotted, maxMonths, maxApr, maxBalance };
}
