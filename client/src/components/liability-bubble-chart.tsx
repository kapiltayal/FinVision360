import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Home, Minus, Plus } from "lucide-react";
import { formatCurrencyFull, formatPercent } from "@/lib/format";
import type { ExposureItem } from "@/lib/liability-map";
import {
  BUBBLE_PLOT,
  BUBBLE_VIEWBOX,
  buildBubbleScene,
  clampBubbleCamera,
  DEFAULT_BUBBLE_CAMERA,
  getBubbleAxisTicks,
  getBubbleTooltipPosition,
  projectBubblePoint,
  zoomBubbleCamera,
  type BubbleCamera,
  type BubblePoint,
} from "@/lib/liability-bubbles";

const fmtNumber = (value: number, digits = 0) =>
  Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value) : "—";
const isWithinPlot = (x: number, y: number) =>
  x >= BUBBLE_PLOT.left && x <= BUBBLE_PLOT.right && y >= BUBBLE_PLOT.top && y <= BUBBLE_PLOT.bottom;
const useTooltipLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function aprColor(apr: number | null) {
  if (apr === null) return "#94a3b8";
  if (apr > 15) return "#ef4444";
  if (apr >= 6) return "#facc15";
  return "#10b981";
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
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
      const anchor = toViewPoint(event.clientX, event.clientY);
      if (!isWithinPlot(anchor.x, anchor.y)) return;
      event.preventDefault();
      const current = cameraRef.current;
      updateCamera(zoomBubbleCamera(current, current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), anchor));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const current = cameraRef.current;
    updateCamera(zoomBubbleCamera(current, current.zoom * factor));
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
    const point = toViewPoint(event.clientX, event.clientY);
    if (!isWithinPlot(point.x, point.y)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
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
    updateCamera({ ...current, panX: current.panX + dx, panY: current.panY + dy });
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const projected = useMemo(() => scene.points.map((point) => ({
    point,
    screen: projectBubblePoint(point.position, camera),
  })).sort((a, b) => b.point.radius - a.point.radius), [scene.points, camera]);
  const selectedPoint = scene.points.find(({ item }) => item.id === (hoveredId ?? selectedId));
  const selectedProjection = projected.find(({ point }) => point.item.id === selectedPoint?.item.id);
  const tooltipItem = selectedPoint?.item;
  const tooltipInterest = selectedPoint?.interest ?? null;
  const tooltipRadius = selectedProjection ? Math.max(4, selectedProjection.point.radius * selectedProjection.screen.scale) : 0;
  const showTooltip = Boolean(
    tooltipItem && selectedProjection &&
    isWithinPlot(selectedProjection.screen.x, selectedProjection.screen.y),
  );
  const axisTicks = getBubbleAxisTicks(camera, scene.maxMonths, scene.maxApr);
  const plotAvailable = scene.points.length > 0;

  useTooltipLayoutEffect(() => {
    if (!showTooltip || !selectedProjection) {
      setTooltipPosition((current) => current === null ? current : null);
      return;
    }
    const chart = chartRef.current;
    const svg = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!chart || !svg || !tooltip) return;

    const updatePosition = () => {
      const matrix = svg.getScreenCTM();
      const chartBounds = chart.getBoundingClientRect();
      const tooltipBounds = tooltip.getBoundingClientRect();
      if (!matrix || chartBounds.width <= 0 || chartBounds.height <= 0 || tooltipBounds.width <= 0 || tooltipBounds.height <= 0) return;

      const svgCenter = svg.createSVGPoint();
      svgCenter.x = selectedProjection.screen.x;
      svgCenter.y = selectedProjection.screen.y;
      const screenCenter = svgCenter.matrixTransform(matrix);
      const radiusX = Math.hypot(matrix.a * tooltipRadius, matrix.b * tooltipRadius);
      const radiusY = Math.hypot(matrix.c * tooltipRadius, matrix.d * tooltipRadius);
      const next = getBubbleTooltipPosition(
        {
          x: screenCenter.x - chartBounds.left,
          y: screenCenter.y - chartBounds.top,
          radius: Math.max(radiusX, radiusY),
        },
        { width: chartBounds.width, height: chartBounds.height },
        { width: tooltipBounds.width, height: tooltipBounds.height },
      );
      setTooltipPosition((current) =>
        current && Math.abs(current.left - next.left) < 0.25 && Math.abs(current.top - next.top) < 0.25
          ? current
          : next,
      );
    };

    updatePosition();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
    resizeObserver?.observe(chart);
    resizeObserver?.observe(tooltip);
    window.addEventListener("resize", updatePosition);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
    };
  }, [
    showTooltip,
    tooltipItem,
    selectedProjection?.screen.x,
    selectedProjection?.screen.y,
    selectedProjection?.screen.scale,
    tooltipRadius,
  ]);

  return (
    <section className="liability-bubble-card" aria-label="Two-axis liability bubble chart">
      <style>{`
        .liability-bubble-card {
          overflow: hidden;
          color: hsl(var(--foreground));
          background: hsl(var(--card));
        }
        .liability-bubble-toolbar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid hsl(var(--border) / .7);
          background: hsl(var(--muted) / .2);
        }
        .bubble-icon-button:focus-visible, .bubble-detail-chip:focus-visible {
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
        .bubble-node:focus-visible { opacity: .75; }
        .bubble-tooltip {
          position: absolute; z-index: 5; width: min(270px, calc(100% - 16px)); box-sizing: border-box;
          border: 1px solid hsl(var(--border));
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
          .bubble-axes text { font-size: 18px; }
          .bubble-ticks text { font-size: 20px; }
        }
      `}</style>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/70 bg-background px-4 py-3 text-[11px] text-muted-foreground sm:px-5" aria-label="Bubble chart legend">
        <span className="font-semibold uppercase tracking-wider">APR</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-500" /> &gt;15%</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-yellow-400" /> 6–15%</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &lt;6%</span>
        <span className="ml-auto">Circle area = balance · minimum visible size shown</span>
      </div>
      <div className="liability-bubble-toolbar">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Debt landscape <span className="font-normal text-muted-foreground">/ two-axis view</span></p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Months remaining vs APR; circle area reflects balance. Switch to Gantt to adjust planning durations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="bubble-icon-button" onClick={() => zoomBy(1.18)} aria-label="Zoom in" title="Zoom in"><Plus className="h-4 w-4" /></button>
          <button type="button" className="bubble-icon-button" onClick={() => zoomBy(1 / 1.18)} aria-label="Zoom out" title="Zoom out"><Minus className="h-4 w-4" /></button>
          <button type="button" className="bubble-icon-button" onClick={reset} aria-label="Reset chart view" title="Reset view"><Home className="h-4 w-4" /></button>
        </div>
      </div>
      <p className="border-b border-border/70 px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
        Drag to pan · wheel or pinch to zoom · select a bubble for details. Keyboard: arrows pan, +/− zoom, Home or 0 reset.
      </p>
      <div
        ref={chartRef}
        className="liability-bubble-plot cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={(event) => { pointersRef.current.delete(event.pointerId); gestureRef.current = null; }}
        role="group"
        aria-label="Interactive two-axis liability bubble chart. Horizontal axis is months remaining; vertical axis is APR. Circle area represents balance. Use arrow keys to pan, plus and minus to zoom, and Home to reset."
        tabIndex={0}
        style={{ touchAction: "none" }}
      >
        {!plotAvailable && <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">No debts have usable balance, APR, and remaining duration to plot yet.</div>}
        <svg ref={svgRef} viewBox={`0 0 ${BUBBLE_VIEWBOX.width} ${BUBBLE_VIEWBOX.height}`} className="block h-auto w-full select-none" role="group" aria-label="Orthogonal bubble chart. X axis: months remaining. Y axis: APR percent. Circle area: current balance.">
          <defs>
            <clipPath id={`${defsId}-plot-clip`} clipPathUnits="userSpaceOnUse">
              <rect
                x={BUBBLE_PLOT.left}
                y={BUBBLE_PLOT.top}
                width={BUBBLE_PLOT.right - BUBBLE_PLOT.left}
                height={BUBBLE_PLOT.bottom - BUBBLE_PLOT.top}
              />
            </clipPath>
          </defs>
          <rect
            x={BUBBLE_PLOT.left}
            y={BUBBLE_PLOT.top}
            width={BUBBLE_PLOT.right - BUBBLE_PLOT.left}
            height={BUBBLE_PLOT.bottom - BUBBLE_PLOT.top}
            fill="hsl(var(--muted) / .12)"
          />
          <g clipPath={`url(#${defsId}-plot-clip)`}>
            <g className="bubble-grid">
              {axisTicks.x.map((tick, index) => (
                <path key={`x-${index}`} d={`M${tick.position},${BUBBLE_PLOT.top} L${tick.position},${BUBBLE_PLOT.bottom}`} />
              ))}
              {axisTicks.y.map((tick, index) => (
                <path key={`y-${index}`} d={`M${BUBBLE_PLOT.left},${tick.position} L${BUBBLE_PLOT.right},${tick.position}`} />
              ))}
            </g>
            {projected.map(({ point, screen }) => {
              const color = aprColor(point.item.apr);
              const radius = Math.max(4, point.radius * screen.scale);
              return (
                <g key={point.item.id} data-bubble-select="true" className="bubble-point-group">
                  <circle
                    cx={screen.x} cy={screen.y} r={radius}
                    fill={color}
                    stroke="none"
                    tabIndex={0}
                    role="button"
                    aria-label={pointLabel(point)}
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
                    <title>{pointLabel(point)}</title>
                  </circle>
                </g>
              );
            })}
          </g>
          <g className="bubble-axes">
            <path d={`M${BUBBLE_PLOT.left},${BUBBLE_PLOT.bottom} L${BUBBLE_PLOT.right},${BUBBLE_PLOT.bottom}`} />
            <path d={`M${BUBBLE_PLOT.left},${BUBBLE_PLOT.bottom} L${BUBBLE_PLOT.left},${BUBBLE_PLOT.top}`} />
            <text x={(BUBBLE_PLOT.left + BUBBLE_PLOT.right) / 2} y={BUBBLE_PLOT.bottom + 42} textAnchor="middle">X · MONTHS REMAINING</text>
            <text
              x={32}
              y={(BUBBLE_PLOT.top + BUBBLE_PLOT.bottom) / 2}
              textAnchor="middle"
              transform={`rotate(-90 32 ${(BUBBLE_PLOT.top + BUBBLE_PLOT.bottom) / 2})`}
            >Y · APR %</text>
          </g>
          <g className="bubble-ticks">
            {axisTicks.x.map((tick, index) => (
              <text key={`x-${index}`} x={tick.position} y={BUBBLE_PLOT.bottom + 19} textAnchor="middle">{fmtNumber(tick.value, 2)} mo</text>
            ))}
            {axisTicks.y.map((tick, index) => (
              <text key={`y-${index}`} x={BUBBLE_PLOT.left - 12} y={tick.position + 4} textAnchor="end">{fmtNumber(tick.value, 2)}%</text>
            ))}
          </g>
        </svg>
        {tooltipItem && (
          <div
            ref={tooltipRef}
            className="bubble-tooltip"
            role="status"
            aria-live="polite"
            style={{
              left: tooltipPosition?.left ?? 0,
              top: tooltipPosition?.top ?? 0,
              visibility: tooltipPosition ? "visible" : "hidden",
            }}
          >
            <p className="mb-1.5 max-w-[220px] truncate font-semibold" title={tooltipItem.name}>{tooltipItem.name}</p>
            {tooltipRows(tooltipItem, tooltipInterest).map(([label, value]) => <p key={label} className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></p>)}
          </div>
        )}
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
