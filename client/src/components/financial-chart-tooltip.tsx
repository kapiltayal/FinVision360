import { formatCurrency } from "@/lib/format";

type FinancialChartTooltipProps = {
  active?: boolean;
  payload?: Array<any>;
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueSuffix?: string;
};

export function FinancialChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueSuffix = "",
}: FinancialChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const formattedLabel =
    label === undefined || label === null
      ? ""
      : labelFormatter
        ? labelFormatter(label)
        : String(label);

  return (
    <div className="min-w-[160px] space-y-1 rounded-md border border-border bg-popover px-3 py-2 shadow-md">
      {formattedLabel && (
        <p className="text-xs font-semibold text-muted-foreground">{formattedLabel}</p>
      )}
      {payload.map((entry, index) => (
        <div key={`${entry.dataKey ?? entry.name ?? "value"}-${index}`} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: entry.color ?? entry.payload?.fill ?? "hsl(var(--primary))" }}
            />
            <span className="text-xs">{entry.name ?? entry.dataKey ?? "Value"}</span>
          </div>
          <span className="text-xs font-medium">
            {formatCurrency(Number(entry.value))}
            {valueSuffix}
          </span>
        </div>
      ))}
    </div>
  );
}