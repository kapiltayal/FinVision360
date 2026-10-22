import type { ReactNode } from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FinancialChartTooltip } from "@/components/financial-chart-tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { formatCurrency } from "@/lib/format";

export type MerchantChargeHistoryPoint = {
  date: string;
  amount: string | number;
  charge_count: string | number;
};

function formatChargeDate(value: string | number): string {
  const dateValue = String(value);
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateValue
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatChargeTick(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MerchantChargeHistoryHover({
  merchant,
  charges,
  frequencies,
  children,
}: {
  merchant: string;
  charges?: MerchantChargeHistoryPoint[];
  frequencies?: string[];
  children: ReactNode;
}) {
  const history = charges ?? [];
  const chartData = history
    .map((charge) => ({
      ...charge,
      amount: Math.abs(Number(charge.amount)),
    }))
    .filter((charge) => Number.isFinite(charge.amount));
  const maxCharge = chartData.reduce((max, charge) => Math.max(max, charge.amount), 0);
  const yAxisMax = maxCharge > 0 ? maxCharge * 1.1 : 1;
  const frequencyLabel = !frequencies?.length
    ? "Not set"
    : frequencies.length === 1
      ? frequencies[0]
      : `Mixed (${frequencies.join(", ")})`;

  return (
    <HoverCard openDelay={180} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${merchant}. Hover or focus to see charge history.`}
          className="block w-full rounded-sm bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
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
          className="w-[min(320px,calc(100vw-2rem))] p-3"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{merchant}</p>
              <p className="text-xs text-muted-foreground">Charges over time</p>
            </div>
            <div className="max-w-[140px] shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Frequency</p>
              <p className="text-xs font-semibold leading-tight">{frequencyLabel}</p>
            </div>
          </div>
          {chartData.length ? (
            <div className="h-36 w-full" aria-label={`Charge history chart for ${merchant}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 6, right: 8, bottom: 2, left: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChargeTick}
                    interval="preserveStartEnd"
                    minTickGap={12}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    width={62}
                    domain={[0, yAxisMax]}
                    tickCount={5}
                    tickFormatter={(value) => formatCurrency(Number(value))}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<FinancialChartTooltip labelFormatter={formatChargeDate} />} />
                  <Bar
                    dataKey="amount"
                    name="Charged"
                    fill="hsl(var(--primary))"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No charge history in this date range.</p>
          )}
        </HoverCardContent>
      </HoverCardPrimitive.Portal>
    </HoverCard>
  );
}
