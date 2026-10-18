import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type AllocationConnection = {
  id: number;
  assetId: number;
  goalId: number;
};

type ConnectorPath = {
  id: number;
  color: string;
  d: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

const colorForAccount = (id: number) => {
  const hue = ((Math.abs(id) * 137.508) % 360).toFixed(1);
  return `hsl(${hue} 58% 39%)`;
};

export function accountAllocationColor(id: number) {
  return colorForAccount(id);
}

export function GoalAllocationConnections({
  allocations,
  children,
}: {
  allocations: AllocationConnection[];
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<ConnectorPath[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const allocationKey = useMemo(
    () => allocations.map(({ id, assetId, goalId }) => `${id}:${assetId}:${goalId}`).join("|"),
    [allocations],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = root.getBoundingClientRect();
        const width = root.clientWidth;
        const height = root.clientHeight;
        setDimensions({ width, height });
        if (!window.matchMedia("(min-width: 1024px)").matches) {
          setPaths([]);
          return;
        }

        const rootLeft = bounds.left;
        const rootTop = bounds.top;
        const linkedAccounts = new Map<number, AllocationConnection[]>();
        allocations.forEach((allocation) => {
          const accountNode = root.querySelector<HTMLElement>(`[data-allocation-account="${allocation.assetId}"]`);
          const goalNode = root.querySelector<HTMLElement>(`[data-allocation-row="${allocation.id}"]`);
          if (!accountNode || !goalNode || !accountNode.getClientRects().length || !goalNode.getClientRects().length) return;
          const group = linkedAccounts.get(allocation.assetId) ?? [];
          group.push(allocation);
          linkedAccounts.set(allocation.assetId, group);
        });

        const nextPaths: ConnectorPath[] = [];
        linkedAccounts.forEach((links, assetId) => {
          const accountNode = root.querySelector<HTMLElement>(`[data-allocation-account="${assetId}"]`);
          if (!accountNode) return;
          const accountRect = accountNode.getBoundingClientRect();
          const orderedLinks = [...links].sort((a, b) => a.id - b.id);
          orderedLinks.forEach((allocation, index) => {
            const goalNode = root.querySelector<HTMLElement>(`[data-allocation-row="${allocation.id}"]`);
            if (!goalNode || !goalNode.getClientRects().length) return;
            const goalRect = goalNode.getBoundingClientRect();
            const goalCardRect = goalNode.closest<HTMLElement>("[data-allocation-goal]")?.getBoundingClientRect();
            const spread = Math.min(14, (orderedLinks.length - 1) * 4);
            const offset = orderedLinks.length > 1
              ? -spread / 2 + spread * index / (orderedLinks.length - 1)
              : 0;
            const startX = accountRect.right - rootLeft;
            const startY = accountRect.top + accountRect.height / 2 + offset - rootTop;
            const endX = (goalCardRect?.left ?? goalRect.left) - rootLeft;
            const endY = goalRect.top + goalRect.height / 2 - rootTop;
            const gap = Math.max(0, endX - startX);
            const bend = Math.min(100, gap * 0.44);
            nextPaths.push({
              id: allocation.id,
              color: colorForAccount(assetId),
              d: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
              startX,
              startY,
              endX,
              endY,
            });
          });
        });
        setPaths(nextPaths);
      });
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(root);
    root.querySelectorAll<HTMLElement>("[data-allocation-account], [data-allocation-row]").forEach((node) => resizeObserver.observe(node));
    const mutationObserver = new MutationObserver(() => {
      root.querySelectorAll<HTMLElement>("[data-allocation-account], [data-allocation-row]").forEach((node) => resizeObserver.observe(node));
      measure();
    });
    // Watch content, not the SVG: observing our own path updates would
    // schedule another measurement on every frame indefinitely.
    if (contentRef.current) {
      mutationObserver.observe(contentRef.current, { attributes: true, childList: true, subtree: true });
    }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    measure();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [allocationKey, allocations]);

  return (
    <div ref={rootRef} className="relative">
      {dimensions.width > 0 && paths.length > 0 && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-0 hidden overflow-visible lg:block"
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="none"
        >
          {paths.map((path) => (
            <g key={path.id}>
              <path d={path.d} fill="none" stroke={path.color} strokeWidth="2" strokeOpacity="0.52" strokeLinecap="round" />
              <circle cx={path.startX} cy={path.startY} r="3" fill={path.color} fillOpacity="0.7" />
              <circle cx={path.endX} cy={path.endY} r="3" fill={path.color} fillOpacity="0.7" />
            </g>
          ))}
        </svg>
      )}
      <div ref={contentRef} className="relative z-[1]">{children}</div>
    </div>
  );
}
