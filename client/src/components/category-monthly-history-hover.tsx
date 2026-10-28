import type { ReactNode } from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FinancialChartTooltip } from "@/components/financial-chart-tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { formatCurrency } from "@/lib/format";

export type CategoryMonthlyHistoryPoint = {
  month: string;
  amount: number | string;
};

function formatMonth(value: string | number): string {
  const month = String(value);
  const date = new Date(`${month}-01T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? month
    : date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatMonthTick(value: string): string {
  const date = new Date(`${value}-01T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function CategoryMonthlyHistoryHover({
  category,
  type,
  history,
  children,
}: {
  category: string;
  type: "income" | "expense";
  history?: CategoryMonthlyHistoryPoint[];
  children: ReactNode;
}) {
  const chartData = (history ?? [])
    .map((point) => ({ ...point, amount: Math.abs(Number(point.amount)) }))
    .filter((point) => Number.isFinite(point.amount));
  const maxAmount = chartData.reduce((max, point) => Math.max(max, point.amount), 0);
  const yAxisMax = maxAmount > 0 ? maxAmount * 1.1 : 1;
  const seriesLabel = type === "expense" ? "Spending" : "Income";
  const color = type === "expense" ? "#dc2626" : "#16a34a";

  return (
    <HoverCard openDelay={180} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${category}. Hover or focus to see monthly ${seriesLabel.toLowerCase()}.`}
          className="block w-full rounded-sm bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardPrimitive.Portal>
        <HoverCardContent
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={12}
          className="w-[min(340px,calc(100vw-2rem))] p-3"
        >
          <div className="mb-2 min-w-0">
            <p className="truncate text-sm font-semibold">{category}</p>
            <p className="text-xs text-muted-foreground">Monthly {seriesLabel.toLowerCase()}</p>
          </div>
          {chartData.length ? (
            <div
              className="h-36 w-full"
              role="img"
              aria-label={`${seriesLabel} by month for ${category}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 6, right: 8, bottom: 2, left: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthTick}
                    interval="preserveStartEnd"
                    minTickGap={14}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    width={62}
                    domain={[0, yAxisMax]}
                    tickCount={4}
                    tickFormatter={(value) => formatCurrency(Number(value))}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<FinancialChartTooltip labelFormatter={formatMonth} />} />
                  <Bar
                    dataKey="amount"
                    name={seriesLabel}
                    fill={color}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No monthly history available for this category.
            </p>
          )}
        </HoverCardContent>
      </HoverCardPrimitive.Portal>
    </HoverCard>
  );
}
