import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle,
  Info,
  BarChart2,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { type Asset, type Liability, ASSET_CATEGORIES, LIABILITY_CATEGORIES } from "@shared/schema";
import { formatCurrency, formatPercent, getCategoryLabel } from "@/lib/format";
import { ExportMenu } from "@/components/export-menu";
import { useAuth } from "@/hooks/use-auth";
import { getQueryFn } from "@/lib/queryClient";

type OpenSection = "netWorth" | "assets" | "liabilities" | "interest" | null;
type HistoryChartType = "line" | "bar";
type HistorySeries = "assets" | "liabilities" | "netWorth";

interface NetWorthHistoryPoint {
  date: number;
  assets: number;
  liabilities: number;
  netWorth: number;
  isCurrent?: boolean;
}

function StatCard({
  title, value, extraLine, subtitle, icon: Icon, trend, testId, color, onClick, isExpanded, infoText, expandedAccent,
}: {
  title: string;
  value: string;
  extraLine?: React.ReactNode;
  subtitle?: string;
  icon: any;
  trend?: "up" | "down" | "neutral";
  testId: string;
  color?: "green" | "red" | "default";
  onClick?: () => void;
  isExpanded?: boolean;
  infoText?: React.ReactNode;
  expandedAccent?: string;
}) {
  const iconBg =
    color === "green" ? "bg-emerald-500/10" :
    color === "red" ? "bg-red-500/10" :
    "bg-primary/10";
  const iconColor =
    color === "green" ? "text-emerald-600 dark:text-emerald-400" :
    color === "red" ? "text-red-600 dark:text-red-400" :
    "text-primary";
  const valueColor =
    color === "green" ? "text-emerald-700 dark:text-emerald-300" :
    color === "red" ? "text-red-700 dark:text-red-300" :
    "";
  const cardVariant =
    color === "green" ? "stat-card-3d stat-card-3d-green border" :
    color === "red" ? "stat-card-3d stat-card-3d-red border" :
    "stat-card-3d";

  return (
    <Card
      data-testid={testId}
      className={`${cardVariant} ${onClick ? "cursor-pointer select-none" : ""} ${isExpanded ? (expandedAccent ?? "ring-2 ring-primary/30") : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-1">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-muted-foreground">{title}</p>
              {infoText && (
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-64 p-3 text-xs leading-relaxed">
                    {infoText}
                  </TooltipContent>
                </UITooltip>
              )}
            </div>
            <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
            {extraLine && <div>{extraLine}</div>}
            {subtitle && (
              <div className="flex items-center gap-1">
                {trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
                {trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className={`flex h-10 w-10 items-center justify-center rounded-md ${iconBg}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            {onClick && (
              isExpanded
                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CHART_COLORS = [
  "hsl(220, 85%, 48%)",
  "hsl(180, 75%, 38%)",
  "hsl(280, 70%, 42%)",
  "hsl(30, 85%, 48%)",
  "hsl(150, 75%, 35%)",
  "hsl(340, 70%, 45%)",
  "hsl(60, 75%, 40%)",
];

const INTEREST_EARNED_COLORS = [
  "hsl(150, 70%, 38%)",
  "hsl(160, 65%, 45%)",
  "hsl(140, 75%, 32%)",
  "hsl(170, 60%, 40%)",
  "hsl(130, 70%, 42%)",
];

const INTEREST_PAID_COLORS = [
  "hsl(0, 75%, 50%)",
  "hsl(10, 70%, 45%)",
  "hsl(350, 75%, 48%)",
  "hsl(20, 65%, 50%)",
  "hsl(340, 70%, 45%)",
];

function InterestTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const p = payload[0];
    const rate: number = p?.payload?.rate ?? 0;
    return (
      <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md">
        <p className="text-sm font-medium">{p.name}</p>
        <p className="text-sm text-muted-foreground">{formatCurrency(p.value)}/yr</p>
        {rate > 0 && <p className="text-xs text-muted-foreground">Rate: {rate.toFixed(2)}%</p>}
      </div>
    );
  }
  return null;
}

function DonutChartWithLegend({
  data, colors, label, emptyText, testId, accentColor, rateNote, weightedAvgRate,
}: {
  data: { name: string; value: number; rate: number }[];
  colors: string[];
  label: string;
  emptyText: string;
  testId: string;
  accentColor: "emerald" | "red";
  rateNote?: string;
  weightedAvgRate?: number;
}) {
  const totalInterest = data.reduce((sum, d) => sum + d.value, 0);

  const headerValueClass = accentColor === "emerald"
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";

  return (
    <div data-testid={testId}>
      <p className="text-sm font-medium text-center mb-1 text-muted-foreground">{label}</p>
      {data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">{emptyText}</div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="text-center">
              <p className={`text-lg font-bold leading-tight ${headerValueClass}`}>{formatCurrency(totalInterest)}/yr</p>
              {weightedAvgRate !== undefined && (
                <p className="text-xs text-muted-foreground">Weighted avg. rate: {weightedAvgRate.toFixed(2)}%</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-1/2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={65}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<InterestTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-2">
              {data.map((item, i) => (
                <div key={item.name} className="flex items-start gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm shrink-0 mt-0.5" style={{ backgroundColor: colors[i % colors.length] }} />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs truncate block">{item.name}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium">{formatCurrency(item.value)}/yr</span>
                      <span className="text-xs text-muted-foreground">@ {item.rate.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground/70 pt-1 leading-tight">
                {rateNote ?? "% shown is the rate for that account"}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CollapsibleSection({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
      <div className="overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function StackedRateBar({
  items, colors, barLabel,
}: {
  items: { name: string; value: number; rate: number }[];
  colors: string[];
  barLabel: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0 || items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{barLabel}</p>
      <div className="flex w-full h-10 rounded-lg overflow-hidden" style={{ gap: "2px" }}>
        {items.map((item, i) => {
          const pct = (item.value / total) * 100;
          const showLabel = pct >= 8;
          return (
            <div
              key={i}
              title={`${item.name}: ${formatCurrency(item.value)}${item.rate > 0 ? ` · Rate: ${item.rate.toFixed(2)}%` : ""}`}
              className="relative flex items-center justify-center hover:brightness-110 transition-all cursor-default"
              style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
            >
              {showLabel && (
                <span className="text-white text-[10px] font-bold select-none whitespace-nowrap leading-none">
                  {item.rate > 0 ? `${item.rate.toFixed(1)}%` : "—"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 min-w-0">
            <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">{item.name}</span>
            {item.rate > 0 && (
              <span className="text-[10px] font-semibold text-foreground whitespace-nowrap">{item.rate.toFixed(2)}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Net Worth History Chart ───────────────────────────────────────────────────
const NW_ASSET_COLOR = "hsl(220, 85%, 52%)";
const NW_LIABILITY_COLOR = "hsl(0, 72%, 52%)";
const NW_NET_COLOR = "hsl(150, 65%, 42%)";

function NetWorthHistoryChart({ data }: { data: NetWorthHistoryPoint[] }) {
  const [chartType, setChartType] = useState<HistoryChartType>("line");
  const [activeSeries, setActiveSeries] = useState<Set<HistorySeries>>(
    new Set<HistorySeries>(["assets", "liabilities", "netWorth"]),
  );

  const toggleSeries = (s: HistorySeries) =>
    setActiveSeries((prev) => {
      const next = new Set(prev);
      if (next.has(s)) { if (next.size > 1) next.delete(s); }
      else next.add(s);
      return next;
    });

  const seriesConfig: { key: HistorySeries; label: string; color: string }[] = [
    { key: "assets", label: "Assets", color: NW_ASSET_COLOR },
    { key: "liabilities", label: "Liabilities", color: NW_LIABILITY_COLOR },
    { key: "netWorth", label: "Net Worth", color: NW_NET_COLOR },
  ];

  const formatHistoryMonth = (value: number) =>
    new Date(value).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  const formatHistoryTick = (value: number) =>
    data.find((point) => point.date === value)?.isCurrent ? "Current" : formatHistoryMonth(value);

  const HistoryTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md space-y-1 min-w-[160px]">
        <p className="text-xs font-semibold text-muted-foreground">{formatHistoryTick(Number(label))}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="text-xs">{p.name}</span>
            </div>
            <span className="text-xs font-medium">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const commonProps = {
    data,
    margin: { top: 4, right: 8, left: 8, bottom: 0 },
  };

  const xAxis = (
    <XAxis
      dataKey="date"
      type="number"
      scale="time"
      domain={["dataMin", "dataMax"]}
      ticks={data.map((point) => point.date)}
      interval="preserveStartEnd"
      minTickGap={12}
      tick={{ fontSize: 11 }}
      tickLine={false}
      axisLine={false}
      tickFormatter={formatHistoryTick}
    />
  );
  const yAxis = (
    <YAxis
      tick={{ fontSize: 11 }}
      tickLine={false}
      axisLine={false}
      tickFormatter={(v: number) =>
        v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}k` : `$${v}`
      }
      width={56}
    />
  );
  const grid = <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />;
  const tooltip = <Tooltip content={<HistoryTooltip />} />;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Series toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {seriesConfig.map(({ key, label, color }) => {
            const active = activeSeries.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleSeries(key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  active
                    ? "text-white border-transparent shadow-sm"
                    : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground"
                }`}
                style={active ? { backgroundColor: color, borderColor: color } : {}}
              >
                <div
                  className="h-2 w-2 rounded-sm shrink-0"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.8)" : color }}
                />
                {label}
              </button>
            );
          })}
        </div>
        {/* Chart type toggle */}
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-muted/40">
          <button
            onClick={() => setChartType("line")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all ${
              chartType === "line" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LineChartIcon className="h-3.5 w-3.5" />
            Line
          </button>
          <button
            onClick={() => setChartType("bar")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all ${
              chartType === "bar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Bar
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (
            <LineChart {...commonProps}>
              {grid}{xAxis}{yAxis}{tooltip}
              {activeSeries.has("assets") && (
                <Line type="monotone" dataKey="assets" name="Assets" stroke={NW_ASSET_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              )}
              {activeSeries.has("liabilities") && (
                <Line type="monotone" dataKey="liabilities" name="Liabilities" stroke={NW_LIABILITY_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              )}
              {activeSeries.has("netWorth") && (
                <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke={NW_NET_COLOR} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} strokeDasharray="0" />
              )}
            </LineChart>
          ) : (
            <BarChart {...commonProps} barGap={2}>
              {grid}{xAxis}{yAxis}{tooltip}
              {activeSeries.has("assets") && (
                <Bar dataKey="assets" name="Assets" fill={NW_ASSET_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32} />
              )}
              {activeSeries.has("liabilities") && (
                <Bar dataKey="liabilities" name="Liabilities" fill={NW_LIABILITY_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32} />
              )}
              {activeSeries.has("netWorth") && (
                <Bar dataKey="netWorth" name="Net Worth" fill={NW_NET_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32} />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [openSection, setOpenSection] = useState<OpenSection>(null);
  const [excludedAssetIds, setExcludedAssetIds] = useState<Set<number>>(new Set());
  const [excludedLiabilityIds, setExcludedLiabilityIds] = useState<Set<number>>(new Set());

  const { data: assets = [], isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });
  const { data: liabilities = [], isLoading: liabilitiesLoading } = useQuery<Liability[]>({
    queryKey: ["/api/liabilities"],
  });
  const { data: netWorthHistory = [] } = useQuery<NetWorthHistoryPoint[]>({
    queryKey: ["/api/history/net-worth"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user,
    staleTime: 0,   // always re-fetch fresh on mount; overrides global Infinity
    gcTime: 0,      // never serve a stale [] from a previous unauthenticated fetch
    select: (d: any) => (Array.isArray(d) ? d : []),
  });

  const isLoading = assetsLoading || liabilitiesLoading;

  const includedAssets = assets.filter((a) => !excludedAssetIds.has(a.id));
  const includedLiabilities = liabilities.filter((l) => !excludedLiabilityIds.has(l.id));

  const anyExcluded = excludedAssetIds.size > 0 || excludedLiabilityIds.size > 0;

  const toggleAsset = (id: number) => {
    setExcludedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleLiability = (id: number) => {
    setExcludedLiabilityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const resetAll = () => {
    setExcludedAssetIds(new Set());
    setExcludedLiabilityIds(new Set());
  };

  const totalAssets = includedAssets.reduce((sum, a) => sum + parseFloat(a.value || "0"), 0);
  const totalLiabilities = includedLiabilities.reduce((sum, l) => sum + parseFloat(l.balance || "0"), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Dollar-weighted avg rate over ALL included items (0%-rate items count toward denominator)
  const weightedAssetRate =
    totalAssets > 0
      ? includedAssets.reduce((sum, a) => sum + parseFloat(a.value || "0") * parseFloat(a.interestRate || "0"), 0) / totalAssets
      : 0;
  const weightedLiabilityRate =
    totalLiabilities > 0
      ? includedLiabilities.reduce((sum, l) => sum + parseFloat(l.balance || "0") * parseFloat(l.interestRate || "0"), 0) / totalLiabilities
      : 0;

  const earnedAnnual = includedAssets.reduce(
    (sum, a) => sum + (parseFloat(a.value || "0") * parseFloat(a.interestRate || "0")) / 100,
    0,
  );
  const paidAnnual = includedLiabilities.reduce(
    (sum, l) => sum + (parseFloat(l.balance || "0") * parseFloat(l.interestRate || "0")) / 100,
    0,
  );
  const netAnnualReturn = earnedAnnual - paidAnnual;

  const assetsByCategory = Array.from(new Set(includedAssets.map((asset) => asset.category))).map((category) => ({
    name: getCategoryLabel(ASSET_CATEGORIES, category),
    value: includedAssets
      .filter((asset) => asset.category === category)
      .reduce((sum, asset) => sum + parseFloat(asset.value || "0"), 0),
  })).filter((category) => category.value > 0);

  const liabilitiesByCategory = Array.from(new Set(includedLiabilities.map((liability) => liability.category))).map((category) => ({
    name: getCategoryLabel(LIABILITY_CATEGORIES, category),
    value: includedLiabilities
      .filter((liability) => liability.category === category)
      .reduce((sum, liability) => sum + parseFloat(liability.balance || "0"), 0),
  })).filter((category) => category.value > 0);

  const assetBarItems = [...includedAssets]
    .sort((a, b) => parseFloat(b.value || "0") - parseFloat(a.value || "0"))
    .map((a) => ({ name: a.name, value: parseFloat(a.value || "0"), rate: parseFloat(a.interestRate || "0") }))
    .filter((a) => a.value > 0);

  const liabilityBarItems = [...includedLiabilities]
    .sort((a, b) => parseFloat(b.balance || "0") - parseFloat(a.balance || "0"))
    .map((l) => ({ name: l.name, value: parseFloat(l.balance || "0"), rate: parseFloat(l.interestRate || "0") }))
    .filter((l) => l.value > 0);

  const interestEarnedBySource = includedAssets
    .map((a) => ({
      name: a.name,
      value: Math.round(parseFloat(a.value || "0") * parseFloat(a.interestRate || "0") / 100),
      rate: parseFloat(a.interestRate || "0"),
    }))
    .filter((a) => a.value > 0);

  const interestPaidBySource = includedLiabilities
    .map((l) => ({
      name: l.name,
      value: Math.round(parseFloat(l.balance || "0") * parseFloat(l.interestRate || "0") / 100),
      rate: parseFloat(l.interestRate || "0"),
    }))
    .filter((l) => l.value > 0);

  const toggleSection = (section: OpenSection) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md">
          <p className="text-sm font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const spreadPct = weightedAssetRate - weightedLiabilityRate;

  const exportData = {
    filename: "Net Worth Summary",
    sheets: [
      {
        name: "Summary",
        columns: ["Metric", "Value"],
        rows: [
          ["Net Worth", formatCurrency(netWorth)],
          ["Total Assets", formatCurrency(totalAssets)],
          ["Total Liabilities", formatCurrency(totalLiabilities)],
          ["Weighted Asset Rate", formatPercent(weightedAssetRate)],
          ["Weighted Liability Rate", formatPercent(weightedLiabilityRate)],
          ["Interest Spread", `${spreadPct.toFixed(2)}%`],
        ],
      },
      {
        name: "Assets",
        columns: ["Name", "Category", "Value ($)", "Interest Rate (%)", "Institution", "Notes"],
        rows: assets.map((a) => [
          a.name,
          getCategoryLabel(ASSET_CATEGORIES, a.category),
          parseFloat(a.value || "0"),
          parseFloat(a.interestRate || "0"),
          a.institution || "",
          a.notes || "",
        ]),
      },
      {
        name: "Liabilities",
        columns: ["Name", "Category", "Balance ($)", "Interest Rate (%)", "Min Payment ($)", "Institution", "Notes"],
        rows: liabilities.map((l) => [
          l.name,
          getCategoryLabel(LIABILITY_CATEGORIES, l.category),
          parseFloat(l.balance || "0"),
          parseFloat(l.interestRate || "0"),
          parseFloat(l.minimumPayment || "0"),
          l.institution || "",
          l.notes || "",
        ]),
      },
    ],
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap page-header-gradient">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Net Worth</h1>
          <p className="text-muted-foreground">Your complete net worth picture</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportMenu data={exportData} />
          {anyExcluded && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs text-amber-700 dark:text-amber-300">
                {excludedAssetIds.size + excludedLiabilityIds.size} item{excludedAssetIds.size + excludedLiabilityIds.size !== 1 ? "s" : ""} excluded from calculations
              </span>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2 border-amber-300 dark:border-amber-700" onClick={resetAll}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset All
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Net Worth"
          value={formatCurrency(netWorth)}
          subtitle={`${netWorth >= 0 ? "Positive net worth" : "Negative net worth"} · click to expand`}
          icon={netWorth >= 0 ? TrendingUp : TrendingDown}
          trend={netWorth >= 0 ? "up" : "down"}
          color={netWorth >= 0 ? "green" : "red"}
          testId="card-net-worth"
          onClick={() => toggleSection("netWorth")}
          isExpanded={openSection === "netWorth"}
          expandedAccent="ring-2 ring-emerald-400/50 stat-card-accent-green"
          infoText={
            <div className="space-y-1.5">
              <p className="font-semibold">How Net Worth is calculated</p>
              <p>Net Worth = Total Assets − Total Liabilities</p>
              <p className="text-muted-foreground">Only items you have checked in the Assets and Liabilities panels count toward this total. Uncheck any item below to temporarily exclude it from the calculation.</p>
            </div>
          }
        />
        <StatCard
          title="Total Assets"
          value={formatCurrency(totalAssets)}
          subtitle={`${assets.length} account${assets.length !== 1 ? "s" : ""}${excludedAssetIds.size > 0 ? ` · ${excludedAssetIds.size} excluded` : ""} · click to expand`}
          icon={Wallet}
          trend="up"
          testId="card-total-assets"
          onClick={() => toggleSection("assets")}
          isExpanded={openSection === "assets"}
          expandedAccent="ring-2 ring-primary/50 stat-card-accent-primary"
          infoText={
            <div className="space-y-1.5">
              <p className="font-semibold">How Total Assets is calculated</p>
              <p>Sum of the current value of every asset you have checked in the Assets panel below.</p>
              <p className="text-muted-foreground">Uncheck any asset to exclude it from this total and from all other dashboard calculations.</p>
            </div>
          }
        />
        <StatCard
          title="Total Liabilities"
          value={formatCurrency(totalLiabilities)}
          subtitle={`${liabilities.length} account${liabilities.length !== 1 ? "s" : ""}${excludedLiabilityIds.size > 0 ? ` · ${excludedLiabilityIds.size} excluded` : ""} · click to expand`}
          icon={CreditCard}
          trend="down"
          testId="card-total-liabilities"
          onClick={() => toggleSection("liabilities")}
          isExpanded={openSection === "liabilities"}
          expandedAccent="ring-2 ring-red-400/50 stat-card-accent-red"
          infoText={
            <div className="space-y-1.5">
              <p className="font-semibold">How Total Liabilities is calculated</p>
              <p>Sum of the outstanding balances of every liability you have checked in the Liabilities panel below.</p>
              <p className="text-muted-foreground">Uncheck any liability to exclude it from this total and from all other dashboard calculations.</p>
            </div>
          }
        />
        <StatCard
          title="Net Return on Assets"
          value={`${netAnnualReturn >= 0 ? "+" : ""}${formatCurrency(netAnnualReturn)}/yr`}
          color={netAnnualReturn >= 0 ? "green" : "red"}
          extraLine={
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <p>Earning {formatCurrency(earnedAnnual)} ({weightedAssetRate.toFixed(2)}%)</p>
              <p>Paying {formatCurrency(paidAnnual)} ({weightedLiabilityRate.toFixed(2)}%)</p>
            </div>
          }
          subtitle="click to expand"
          icon={TrendingUp}
          trend={netAnnualReturn >= 0 ? "up" : "down"}
          testId="card-interest-spread"
          onClick={() => toggleSection("interest")}
          isExpanded={openSection === "interest"}
          expandedAccent="ring-2 ring-violet-400/50 stat-card-accent-violet"
          infoText={
            <div className="space-y-1.5">
              <p className="font-semibold">How Net Return on Assets is calculated</p>
              <p><strong>Net $/yr</strong> = (Σ asset value × its rate) − (Σ liability balance × its rate)</p>
              <p><strong>Spread %</strong> = Weighted avg. asset return rate − Weighted avg. liability interest rate</p>
              <p className="text-muted-foreground">Each rate is weighted by the balance of that account. A positive figure means your money is earning more than your debt costs you.</p>
            </div>
          }
        />
      </div>

      {/* Net Worth History — conditional mount so Recharts measures real dimensions */}
      {openSection === "netWorth" && (
        <Card data-testid="card-net-worth-history" className="mt-1 border-t-[3px] border-t-emerald-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Net Worth History</CardTitle>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <TrendingUp className="h-3 w-3" />
                18-Month Trend
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {netWorthHistory.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                No history data yet — snapshots are taken monthly.
              </div>
            ) : (
              <NetWorthHistoryChart data={netWorthHistory} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Collapsible: Asset Allocation */}
      <CollapsibleSection open={openSection === "assets"}>
        <Card data-testid="card-asset-breakdown" className="mt-1 border-t-[3px] border-t-primary overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Asset Allocation</CardTitle>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary border border-primary/20">
                <Wallet className="h-3 w-3" />
                Total Assets
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {assetsByCategory.length === 0 && includedAssets.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No assets added yet</div>
            ) : assetsByCategory.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">All assets excluded from calculations</div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <div className="w-1/2 h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={assetsByCategory}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {assetsByCategory.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-2.5">
                    {assetsByCategory.map((cat, i) => (
                      <div key={cat.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-xs truncate">{cat.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-medium whitespace-nowrap">{formatCurrency(cat.value)}</span>
                          <span className="text-xs text-muted-foreground ml-1">({totalAssets > 0 ? Math.round(cat.value / totalAssets * 100) : 0}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {assetBarItems.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <StackedRateBar
                      items={assetBarItems}
                      colors={CHART_COLORS}
                      barLabel="Rate of Return by Asset"
                    />
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* Collapsible: Liability Breakdown */}
      <CollapsibleSection open={openSection === "liabilities"}>
        <Card data-testid="card-liability-breakdown" className="mt-1 border-t-[3px] border-t-red-500 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Liability Breakdown</CardTitle>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-950/40 px-3 py-0.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                <CreditCard className="h-3 w-3" />
                Total Liabilities
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {liabilitiesByCategory.length === 0 && includedLiabilities.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No liabilities added yet</div>
            ) : liabilitiesByCategory.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">All liabilities excluded from calculations</div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <div className="w-1/2 h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={liabilitiesByCategory}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {liabilitiesByCategory.map((_, i) => (
                            <Cell key={i} fill={INTEREST_PAID_COLORS[i % INTEREST_PAID_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-2.5">
                    {liabilitiesByCategory.map((cat, i) => (
                      <div key={cat.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: INTEREST_PAID_COLORS[i % INTEREST_PAID_COLORS.length] }} />
                          <span className="text-xs truncate">{cat.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-medium whitespace-nowrap">{formatCurrency(cat.value)}</span>
                          <span className="text-xs text-muted-foreground ml-1">({totalLiabilities > 0 ? Math.round(cat.value / totalLiabilities * 100) : 0}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {liabilityBarItems.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <StackedRateBar
                      items={liabilityBarItems}
                      colors={INTEREST_PAID_COLORS}
                      barLabel="Interest Rate by Liability"
                    />
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* Collapsible: Interest Spread Detail */}
      <CollapsibleSection open={openSection === "interest"}>
        <Card data-testid="card-interest-detail" className="mt-1 border-t-[3px] border-t-violet-500 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Net Return on Assets — Annual Breakdown</CardTitle>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/40 px-3 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                <Percent className="h-3 w-3" />
                Net Return on Assets
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DonutChartWithLegend
                data={interestEarnedBySource}
                colors={INTEREST_EARNED_COLORS}
                label="Returns Earned"
                emptyText="No assets with a rate of return"
                testId="chart-interest-earned"
                accentColor="emerald"
                weightedAvgRate={weightedAssetRate}
                rateNote="% shown is the rate of return for that asset"
              />
              <DonutChartWithLegend
                data={interestPaidBySource}
                colors={INTEREST_PAID_COLORS}
                label="Interest Paid"
                emptyText="No interest-bearing liabilities"
                testId="chart-interest-paid"
                accentColor="red"
                weightedAvgRate={weightedLiabilityRate}
                rateNote="% shown is the interest rate for that liability"
              />
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* Assets & Liabilities panels with selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assets panel */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Assets</CardTitle>
                <Badge variant="secondary">{assets.length} total</Badge>
                {excludedAssetIds.size > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 text-xs">
                    {excludedAssetIds.size} excluded
                  </Badge>
                )}
              </div>
              {excludedAssetIds.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setExcludedAssetIds(new Set())}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Check items to include in calculations</p>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No assets yet. Add your first asset to get started.</p>
            ) : (
              <div className="space-y-2">
                {[...assets]
                  .sort((a, b) => parseFloat(b.value || "0") - parseFloat(a.value || "0"))
                  .map((asset) => {
                    const excluded = excludedAssetIds.has(asset.id);
                    return (
                      <div
                        key={asset.id}
                        className={`flex items-center gap-3 rounded-md p-2 transition-all cursor-pointer hover:bg-muted/60 ${excluded ? "opacity-40" : ""}`}
                        onClick={() => toggleAsset(asset.id)}
                        data-testid={`asset-row-${asset.id}`}
                      >
                        <Checkbox
                          checked={!excluded}
                          onCheckedChange={() => toggleAsset(asset.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <TrendingUp className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${excluded ? "line-through" : ""}`}>{asset.name}</p>
                          <p className="text-xs text-muted-foreground">{getCategoryLabel(ASSET_CATEGORIES, asset.category)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{formatCurrency(asset.value)}</p>
                          {parseFloat(asset.interestRate || "0") > 0 && (
                            <p className="text-xs text-emerald-500">{formatPercent(asset.interestRate || "0")}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Liabilities panel */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Liabilities</CardTitle>
                <Badge variant="secondary">{liabilities.length} total</Badge>
                {excludedLiabilityIds.size > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 text-xs">
                    {excludedLiabilityIds.size} excluded
                  </Badge>
                )}
              </div>
              {excludedLiabilityIds.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setExcludedLiabilityIds(new Set())}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Check items to include in calculations</p>
          </CardHeader>
          <CardContent>
            {liabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No liabilities yet. Add your first liability to track.</p>
            ) : (
              <div className="space-y-2">
                {[...liabilities]
                  .sort((a, b) => parseFloat(b.balance || "0") - parseFloat(a.balance || "0"))
                  .map((liability) => {
                    const excluded = excludedLiabilityIds.has(liability.id);
                    return (
                      <div
                        key={liability.id}
                        className={`flex items-center gap-3 rounded-md p-2 transition-all cursor-pointer hover:bg-muted/60 ${excluded ? "opacity-40" : ""}`}
                        onClick={() => toggleLiability(liability.id)}
                        data-testid={`liability-row-${liability.id}`}
                      >
                        <Checkbox
                          checked={!excluded}
                          onCheckedChange={() => toggleLiability(liability.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                        <div className="h-8 w-8 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${excluded ? "line-through" : ""}`}>{liability.name}</p>
                          <p className="text-xs text-muted-foreground">{getCategoryLabel(LIABILITY_CATEGORIES, liability.category)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{formatCurrency(liability.balance)}</p>
                          {parseFloat(liability.interestRate || "0") > 0 && (
                            <p className="text-xs text-red-500">{formatPercent(liability.interestRate || "0")}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
