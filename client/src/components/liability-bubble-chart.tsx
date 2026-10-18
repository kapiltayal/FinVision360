import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { Home, Minus, Move, Plus, Rotate3D } from "lucide-react";
import { formatCurrencyFull, formatPercent } from "@/lib/format";
import { estimateRemainingInterest, type ExposureItem } from "@/lib/liability-map";
import {
  BUBBLE_VIEWBOX,
  buildBubbleScene,
  clampBubbleCamera,
  DEFAULT_BUBBLE_CAMERA,
  projectBubblePoint,
  zoomBubbleCamera,
  type BubbleCamera,
  type BubblePoint,
} from "@/lib/liability-bubbles";

type InteractionMode = "pan" | "rotate";

const fmtNumber = (value: number, digits = 0) =>
  Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value) : "—";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function aprColor(apr: number | null) {
  if (apr === null) return { fill: "url(#bubble-unknown)", stroke: "var(--bubble-unknown-stroke)" };
  if (apr > 15) return { fill: "url(#bubble-high)", stroke: "var(--bubble-high-stroke)" };
  if (apr >= 6) return { fill: "url(#bubble-medium)", stroke: "var(--bubble-medium-stroke)" };
  return { fill: "url(#bubble-low)", stroke: "var(--bubble-low-stroke)" };
}

function pointLabel(point: BubblePoint) {
  const { item } = point;
  return `${item.name}, balance ${formatCurrencyFull(item.balance)}, APR ${item.apr === null ? "unknown" : formatPercent(item.apr)}, ${item.monthsRemaining === null ? "duration unknown" : `${item.monthsRemaining} months remaining`}, total remaining interest ${point.interest === null ? "unavailable" : formatCurrencyFull(point.interest)}`;
}

function tooltipRows(item: ExposureItem, interest: number | null) {
  return [
    ["Balance", formatCurrencyFull(item.balance)],
    ["APR", item.apr === null ? "Unknown" : formatPercent(item.apr)],
    ["Months remaining", item.durationSource === "paid" ? "Paid off" : item.monthsRemaining === null ? "Unknown" : `${item.monthsRemaining} months`],
    ["Total remaining interest", interest === null ? "Unavailable" : formatCurrencyFull(interest)],
  ];
}

export function LiabilityBubbleChart({ items }: { items: ExposureItem[] }) {
  const scene = useMemo(() => buildBubbleScene(items), [items]);
  const [camera, setCamera] = useState<BubbleCamera>(() => ({ ...DEFAULT_BUBBLE_CAMERA }));
  const [mode, setMode] = useState<InteractionMode>("pan");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef(camera);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ id: number; x: number; y: number; distance?: number } | null>(null);
  const rawId = useId().replace(/:/g, "");
  const defsId = `liability-bubbles-${rawId}`;
  useEffect(() => {
    if (selectedId !== null && !items.some((item) => item.id === selectedId)) setSelectedId(null);
    if (hoveredId !== null && !items.some((item) => item.id === hoveredId)) setHoveredId(null);
  }, [items, selectedId, hoveredId]);

  const updateCamera = (next: BubbleCamera) => {
    const bounded = clampBubbleCamera(next);
    cameraRef.current = bounded;
    setCamera(bounded);
  };

  const toViewPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (svg && matrix) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      return point.matrixTransform(matrix.inverse());
    }
    const bounds = chartRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return { x: BUBBLE_VIEWBOX.width / 2, y: BUBBLE_VIEWBOX.height / 2 };
    return {
      x: ((clientX - bounds.left) / bounds.width) * BUBBLE_VIEWBOX.width,
      y: ((clientY - bounds.top) / bounds.height) * BUBBLE_VIEWBOX.height,
    };
  };

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const anchor = toViewPoint(event.clientX, event.clientY);
      const current = cameraRef.current;
      updateCamera(zoomBubbleCamera(current, current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), anchor));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const current = cameraRef.current;
    updateCamera(zoomBubbleCamera(current, current.zoom * factor, { x: BUBBLE_VIEWBOX.width / 2, y: BUBBLE_VIEWBOX.height / 2 }));
  };
  const reset = () => {
    pointersRef.current.clear();
    gestureRef.current = null;
    updateCamera({ ...DEFAULT_BUBBLE_CAMERA });
    setSelectedId(null);
    setHoveredId(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!chartRef.current?.contains(document.activeElement)) return;
      if (event.key === "Home" || event.key === "0") {
        event.preventDefault();
        reset();
        return;
      }
      const current = cameraRef.current;
      const panStep = event.shiftKey ? 34 : 18;
      if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomBy(1.15); }
      else if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomBy(1 / 1.15); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); updateCamera({ ...current, panX: current.panX + panStep }); }
      else if (event.key === "ArrowRight") { event.preventDefault(); updateCamera({ ...current, panX: current.panX - panStep }); }
      else if (event.key === "ArrowUp") { event.preventDefault(); updateCamera({ ...current, panY: current.panY + panStep }); }
      else if (event.key === "ArrowDown") { event.preventDefault(); updateCamera({ ...current, panY: current.panY - panStep }); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("[data-bubble-select]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toViewPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);
    gestureRef.current = { id: event.pointerId, ...point };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointersRef.current.get(event.pointerId);
    if (!previous) return;
    const point = toViewPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);
    if (pointersRef.current.size >= 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const prior = gestureRef.current?.distance;
      if (prior && prior > 0) {
        const current = cameraRef.current;
        updateCamera(zoomBubbleCamera(current, current.zoom * distance / prior, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));
      }
      gestureRef.current = { id: event.pointerId, x: point.x, y: point.y, distance };
      return;
    }
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const current = cameraRef.current;
    if (mode === "pan") updateCamera({ ...current, panX: current.panX + dx, panY: current.panY + dy });
    else updateCamera({ ...current, yaw: current.yaw + dx * 0.008, pitch: clamp(current.pitch + dy * 0.006, -1.15, 1.15) });
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const projected = useMemo(() => scene.points.map((point) => ({
    point,
    screen: projectBubblePoint(point.position, camera),
  })).sort((a, b) => b.screen.depth - a.screen.depth), [scene.points, camera]);
  const selectedPoint = scene.points.find(({ item }) => item.id === (hoveredId ?? selectedId));
  const tooltipItem = selectedPoint?.item;
  const tooltipInterest = selectedPoint?.interest ?? (tooltipItem ? estimateRemainingInterest(tooltipItem) : null);
  const tooltipPosition = selectedPoint ? projectBubblePoint(selectedPoint.position, camera) : null;
  const tickMonths = scene.maxMonths > 0 ? [0, scene.maxMonths / 2, scene.maxMonths] : [0, 1, 2];
  const tickApr = scene.maxApr > 0 ? [0, scene.maxApr / 2, scene.maxApr] : [0, 1, 2];
  const tickInterest = scene.maxInterest > 0 ? [0, scene.maxInterest / 2, scene.maxInterest] : [0, 1, 2];
  const axisX = (value: number) => projectBubblePoint({ x: value, y: -1, z: -1 }, camera);
  const axisY = (value: number) => projectBubblePoint({ x: -1, y: value, z: -1 }, camera);
  const axisZ = (value: number) => projectBubblePoint({ x: -1, y: -1, z: value }, camera);
  const plotAvailable = scene.points.length > 0;

  return (
    <section className="liability-bubble-card" aria-label="Three-dimensional liability bubble chart">
      <style>{`
        .liability-bubble-card {
          --bubble-high-stroke: #8f302a;
          --bubble-medium-stroke: #89651d;
          --bubble-low-stroke: #27654e;
          --bubble-unknown-stroke: #46525d;
          --bubble-paid-stroke: #397451;
          overflow: hidden;
          color: hsl(var(--foreground));
          background: hsl(var(--card));
        }
        .dark .liability-bubble-card {
          --bubble-high-stroke: #ffb3a4;
          --bubble-medium-stroke: #f5d876;
          --bubble-low-stroke: #96e0b8;
          --bubble-unknown-stroke: #d2d7dc;
          --bubble-paid-stroke: #9fe1b7;
        }
        .liability-bubble-toolbar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid hsl(var(--border) / .7);
          background: hsl(var(--muted) / .2);
        }
        .bubble-tool-button {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          min-height: 30px; border-radius: 5px; padding: 0 9px; font-size: 11px;
          color: hsl(var(--muted-foreground)); transition: color .15s, background-color .15s;
        }
        .bubble-tool-button:hover { color: hsl(var(--foreground)); }
        .bubble-tool-button.is-active { color: hsl(var(--primary)); background: hsl(var(--primary) / .1); box-shadow: 0 1px 2px hsl(var(--foreground) / .08); }
        .bubble-tool-button:focus-visible, .bubble-icon-button:focus-visible, .bubble-detail-chip:focus-visible {
          outline: 2px solid hsl(var(--ring)); outline-offset: 2px;
        }
        .bubble-icon-button {
          display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center;
          border: 1px solid hsl(var(--border)); border-radius: 6px; background: hsl(var(--background));
          color: hsl(var(--muted-foreground)); transition: color .15s, background-color .15s, transform .15s;
        }
        .bubble-icon-button:hover { background: hsl(var(--muted)); color: hsl(var(--foreground)); }
        .bubble-icon-button:active { transform: scale(.96); }
        .liability-bubble-plot {
          position: relative; overflow: hidden; width: 100%; touch-action: none;
          background:
            radial-gradient(ellipse at 52% 46%, hsl(var(--primary) / .075), transparent 56%),
            linear-gradient(160deg, hsl(var(--muted) / .08), hsl(var(--background)) 68%);
        }
        .liability-bubble-plot:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: -3px; }
        .liability-bubble-plot svg { aspect-ratio: 12 / 7; }
        .bubble-grid path { fill: none; stroke: hsl(var(--border) / .7); stroke-width: 1; stroke-dasharray: 3 5; vector-effect: non-scaling-stroke; }
        .bubble-axes path { fill: none; stroke: hsl(var(--foreground) / .48); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
        .bubble-axes text { fill: hsl(var(--muted-foreground)); font: 600 10px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
        .bubble-ticks text { fill: hsl(var(--muted-foreground)); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
        .bubble-node { cursor: pointer; outline: none; }
        .bubble-node:focus-visible { stroke-width: 4; filter: brightness(1.13); }
        .bubble-tooltip {
          position: absolute; z-index: 5; min-width: 220px; max-width: min(270px, 78%);
          top: 12px; right: 12px; border: 1px solid hsl(var(--border));
          border-radius: 8px; padding: 9px 11px; color: hsl(var(--foreground));
          background: hsl(var(--popover)); box-shadow: 0 8px 24px hsl(var(--foreground) / .13);
          font-size: 11px; line-height: 1.55; pointer-events: none;
        }
        .bubble-detail-chip {
          max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          border: 1px solid hsl(var(--border)); border-radius: 999px; padding: 4px 9px;
          background: hsl(var(--background)); color: hsl(var(--muted-foreground)); font-size: 10px;
          transition: color .15s, border-color .15s, background-color .15s;
        }
        .bubble-detail-chip:hover, .bubble-detail-chip.is-active {
          border-color: hsl(var(--primary) / .42); background: hsl(var(--primary) / .08); color: hsl(var(--primary));
        }
        @media (max-width: 520px) {
          .liability-bubble-toolbar { align-items: flex-start; }
          .liability-bubble-toolbar > div:last-child { width: 100%; }
          .liability-bubble-plot svg { min-height: 220px; }
          .bubble-axes text { font-size: 18px; }
          .bubble-ticks text { font-size: 20px; }
          .bubble-tooltip { position: relative; top: auto; right: auto; min-width: 0; max-width: none; margin: 8px 12px; }
        }
      `}</style>
      <div className="liability-bubble-toolbar">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Debt landscape <span className="font-normal text-muted-foreground">/ 3D view</span></p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Bubble area follows balance; the smallest bubble is enlarged to remain visible. Switch to Gantt to adjust planning durations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-md border bg-background p-0.5" role="group" aria-label="Chart interaction mode">
            <button type="button" onClick={() => setMode("pan")} aria-pressed={mode === "pan"} className={`bubble-tool-button ${mode === "pan" ? "is-active" : ""}`} title="Pan mode: drag to move the view">
              <Move className="h-3.5 w-3.5" /> <span>Pan</span>
            </button>
            <button type="button" onClick={() => setMode("rotate")} aria-pressed={mode === "rotate"} className={`bubble-tool-button ${mode === "rotate" ? "is-active" : ""}`} title="Rotate mode: drag to orbit the 3D view">
              <Rotate3D className="h-3.5 w-3.5" /> <span>Rotate</span>
            </button>
          </div>
          <button type="button" className="bubble-icon-button" onClick={() => zoomBy(1.18)} aria-label="Zoom in" title="Zoom in"><Plus className="h-4 w-4" /></button>
          <button type="button" className="bubble-icon-button" onClick={() => zoomBy(1 / 1.18)} aria-label="Zoom out" title="Zoom out"><Minus className="h-4 w-4" /></button>
          <button type="button" className="bubble-icon-button" onClick={reset} aria-label="Reset chart view" title="Reset view"><Home className="h-4 w-4" /></button>
        </div>
      </div>
      <p className="border-b border-border/70 px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
        {mode === "pan" ? "Drag to pan · wheel or pinch to zoom · select a bubble for details." : "Drag to orbit · wheel or pinch to zoom · select a bubble for details."}
        {" "}Keyboard: arrows pan, +/− zoom, Home or 0 reset.
      </p>
      <div
        ref={chartRef}
        className={`liability-bubble-plot ${mode === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={() => { pointersRef.current.clear(); gestureRef.current = null; }}
        role="group"
        aria-label="Interactive 3D debt chart. Use arrow keys to pan, plus and minus to zoom, and Home to reset."
        tabIndex={0}
        style={{ touchAction: "none" }}
      >
        {!plotAvailable && <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">No liabilities have complete balance, APR, and remaining duration inputs to plot yet.</div>}
        <svg ref={svgRef} viewBox={`0 0 ${BUBBLE_VIEWBOX.width} ${BUBBLE_VIEWBOX.height}`} className="block h-auto w-full select-none" role="img" aria-label="Perspective chart of liability balance, remaining months, APR, and estimated interest">
          <defs>
            <radialGradient id={`${defsId}-high`} cx="33%" cy="28%" r="72%">
              <stop offset="0%" stopColor="#ffd1c7" /><stop offset="30%" stopColor="#ef6558" /><stop offset="100%" stopColor="#972d31" />
            </radialGradient>
            <radialGradient id={`${defsId}-medium`} cx="33%" cy="28%" r="72%">
              <stop offset="0%" stopColor="#fff6c6" /><stop offset="32%" stopColor="#e9bd49" /><stop offset="100%" stopColor="#9b6e20" />
            </radialGradient>
            <radialGradient id={`${defsId}-low`} cx="33%" cy="28%" r="72%">
              <stop offset="0%" stopColor="#c9f5df" /><stop offset="32%" stopColor="#4bad82" /><stop offset="100%" stopColor="#21634e" />
            </radialGradient>
            <radialGradient id={`${defsId}-unknown`} cx="33%" cy="28%" r="72%">
              <stop offset="0%" stopColor="#e5e8eb" /><stop offset="34%" stopColor="#9aa4ae" /><stop offset="100%" stopColor="#4c5863" />
            </radialGradient>
            <radialGradient id={`${defsId}-paid`} cx="33%" cy="28%" r="72%">
              <stop offset="0%" stopColor="#e1f7eb" /><stop offset="100%" stopColor="#749c82" />
            </radialGradient>
            <filter id={`${defsId}-shadow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
          </defs>
          <g className="bubble-grid">
            {[0, 0.5, 1].map((ratio) => {
              const a = projectBubblePoint({ x: -1 + ratio * 2, y: -1, z: -1 }, camera);
              const b = projectBubblePoint({ x: -1 + ratio * 2, y: 1, z: -1 }, camera);
              const c = projectBubblePoint({ x: -1, y: -1 + ratio * 2, z: -1 }, camera);
              const d = projectBubblePoint({ x: 1, y: -1 + ratio * 2, z: -1 }, camera);
              return <g key={ratio}><path d={`M${a.x},${a.y} L${b.x},${b.y}`} /><path d={`M${c.x},${c.y} L${d.x},${d.y}`} /></g>;
            })}
            {[-1, 0, 1].map((value) => {
              const a = projectBubblePoint({ x: -1, y: value, z: -1 }, camera);
              const b = projectBubblePoint({ x: -1, y: value, z: 1 }, camera);
              return <path key={`z-${value}`} d={`M${a.x},${a.y} L${b.x},${b.y}`} />;
            })}
          </g>
          <g className="bubble-axes">
            {[
              [projectBubblePoint({ x: -1, y: -1, z: -1 }, camera), projectBubblePoint({ x: 1, y: -1, z: -1 }, camera), "X · MONTHS LEFT"],
              [projectBubblePoint({ x: -1, y: -1, z: -1 }, camera), projectBubblePoint({ x: -1, y: 1, z: -1 }, camera), "Y · APR %"],
              [projectBubblePoint({ x: -1, y: -1, z: -1 }, camera), projectBubblePoint({ x: -1, y: -1, z: 1 }, camera), "Z · REMAINING INTEREST"],
            ].map(([from, to, label], index) => {
              const start = from as ReturnType<typeof projectBubblePoint>;
              const end = to as ReturnType<typeof projectBubblePoint>;
              const labelText = label as string;
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;
              return <g key={labelText}><path d={`M${start.x},${start.y} L${end.x},${end.y}`} /><text x={midX + (index === 2 ? -18 : 8)} y={midY + (index === 1 ? -12 : 18)}>{labelText}</text></g>;
            })}
          </g>
          <g className="bubble-ticks">
            {tickMonths.map((_, index) => {
              const p = axisX(-1 + (index / (tickMonths.length - 1)) * 2);
              return <text key={`m-${index}`} x={p.x} y={p.y + 19} textAnchor="middle">{fmtNumber(index === 0 ? 0 : scene.maxMonths * index / 2)} mo</text>;
            })}
            {tickApr.map((_, index) => {
              const p = axisY(-1 + (index / (tickApr.length - 1)) * 2);
              return <text key={`a-${index}`} x={p.x - 12} y={p.y + 4} textAnchor="end">{fmtNumber(scene.maxApr * index / 2, 1)}%</text>;
            })}
            {tickInterest.map((_, index) => {
              const p = axisZ(-1 + (index / (tickInterest.length - 1)) * 2);
              return <text key={`i-${index}`} x={p.x - 9} y={p.y + 4} textAnchor="end">{formatCurrencyFull(scene.maxInterest * index / 2)}</text>;
            })}
          </g>
          {projected.map(({ point, screen }) => {
            const color = aprColor(point.item.apr);
            const radius = Math.max(4, point.radius * screen.scale);
            const isSelected = selectedId === point.item.id || hoveredId === point.item.id;
            const isPaid = point.item.durationSource === "paid";
            return (
              <g key={point.item.id} data-bubble-select="true" className="bubble-point-group">
                <circle cx={screen.x + 2} cy={screen.y + radius * 0.57} r={radius * 0.76} fill="currentColor" opacity="0.12" filter={`url(#${defsId}-shadow)`} />
                <circle
                  cx={screen.x} cy={screen.y} r={radius}
                  fill={isPaid ? `url(#${defsId}-paid)` : color.fill.replace("bubble-", `${defsId}-`)}
                  stroke={isPaid ? "var(--bubble-paid-stroke)" : color.stroke}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeDasharray={isPaid ? "4 3" : undefined}
                  tabIndex={0}
                  role="button"
                  aria-label={`${pointLabel(point)}${isPaid ? ", paid off" : ""}`}
                  onMouseEnter={() => setHoveredId(point.item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(point.item.id)}
                  onBlur={() => setHoveredId(null)}
                  onClick={(event) => { event.stopPropagation(); setSelectedId((current) => current === point.item.id ? null : point.item.id); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId((current) => current === point.item.id ? null : point.item.id); }
                  }}
                  className="bubble-node"
                >
                  <title>{`${pointLabel(point)}${isPaid ? " · paid off" : ""}`}</title>
                </circle>
                <circle cx={screen.x - radius * 0.28} cy={screen.y - radius * 0.34} r={Math.max(1.5, radius * 0.13)} fill="rgba(255,255,255,.64)" pointerEvents="none" />
              </g>
            );
          })}
        </svg>
        {tooltipItem && tooltipPosition && (
          <div
            className="bubble-tooltip"
            role="status"
            aria-live="polite"
          >
            <p className="mb-1.5 max-w-[220px] truncate font-semibold" title={tooltipItem.name}>{tooltipItem.name}{tooltipItem.durationSource === "paid" && <span className="ml-1.5 text-[10px] font-medium text-emerald-700">Paid off</span>}</p>
            {tooltipRows(tooltipItem, tooltipInterest).map(([label, value]) => <p key={label} className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></p>)}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70 px-4 py-3 text-[11px] text-muted-foreground sm:px-5">
        <span className="font-semibold uppercase tracking-wider">Bubble color · APR</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-500" /> &gt;15%</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-yellow-400" /> 6–15%</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &lt;6%</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Unknown APR</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full border border-dashed border-emerald-700 bg-emerald-100" /> Paid off</span>
        <span className="ml-auto">Bubble size = balance · minimum size shown</span>
      </div>
      <div className="border-t border-border/70 px-4 py-3 sm:px-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-xs font-semibold">Debt details</h3>
          <p className="text-[10px] text-muted-foreground">Select any entry to locate it in the plot.</p>
        </div>
        {scene.points.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Select a plotted liability">
            {scene.points.map((point) => (
              <button key={point.item.id} type="button" onClick={() => setSelectedId((current) => current === point.item.id ? null : point.item.id)} className={`bubble-detail-chip ${selectedId === point.item.id ? "is-active" : ""}`} aria-pressed={selectedId === point.item.id}>
                {point.item.name}
              </button>
            ))}
          </div>
        )}
        {scene.unplotted.length > 0 && (
          <div className="rounded-md border border-amber-800/15 bg-amber-500/[0.055] p-3">
            <p className="text-xs font-semibold">Not shown in the plot</p>
            <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">Update APRs in Manage liabilities or planning durations in Gantt. Unknown APR or duration is never treated as zero. Paid-off debts remain listed without a bubble.</p>
            <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Liabilities missing inputs for the bubble chart">
              {scene.unplotted.map(({ item, reason }) => (
                <li key={item.id} className="rounded-sm bg-background/70 px-2.5 py-2 text-xs">
                  <span className="font-medium">{item.name}</span>
                  <span className="ml-1 text-muted-foreground">— {reason}</span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    Balance {formatCurrencyFull(item.balance)} · APR {item.apr === null ? "unknown" : formatPercent(item.apr)} · Months {item.durationSource === "paid" ? "paid off" : item.monthsRemaining === null ? "unknown" : item.monthsRemaining}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default LiabilityBubbleChart;
