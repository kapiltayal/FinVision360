import * as React from "react";
import { Input } from "@/components/ui/input";

type FormattedNumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  | "type"
  | "value"
  | "defaultValue"
  | "onChange"
  | "onFocus"
  | "onBlur"
  | "min"
  | "max"
  | "step"
> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "";

  const valueString = String(value);
  const [integerPart, decimalPart] = valueString.split(".");
  const sign = integerPart.startsWith("-") ? "-" : "";
  const digits = sign ? integerPart.slice(1) : integerPart;
  const groupedDigits = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${sign}${groupedDigits}${decimalPart === undefined ? "" : `.${decimalPart}`}`;
}

function parseNumber(value: string): number | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function FormattedNumberInput({
  value,
  onValueChange,
  min,
  max,
  step,
  onKeyDown,
  ...inputProps
}: FormattedNumberInputProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const clamp = (number: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, number));

  return (
    <Input
      {...inputProps}
      type="text"
      inputMode="decimal"
      value={editing ? draft : formatNumber(value)}
      min={undefined}
      max={undefined}
      step={undefined}
      onFocus={() => {
        setDraft(formatNumber(value));
        setEditing(true);
      }}
      onChange={(event) => {
        const nextDraft = event.currentTarget.value;
        setDraft(nextDraft);
        const parsed = parseNumber(nextDraft);
        if (parsed !== null) onValueChange(clamp(parsed));
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || !step || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;

        event.preventDefault();
        const current = parseNumber(editing ? draft : formatNumber(value)) ?? value;
        const direction = event.key === "ArrowUp" ? 1 : -1;
        const next = clamp(Number((current + direction * step).toFixed(10)));
        setDraft(String(next));
        setEditing(true);
        onValueChange(next);
      }}
      onBlur={() => {
        const parsed = parseNumber(draft);
        if (parsed !== null) {
          onValueChange(clamp(parsed));
        } else if (draft.trim() === "") {
          onValueChange(clamp(min ?? 0));
        }
        setEditing(false);
      }}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number.isFinite(value) ? value : undefined}
      role="spinbutton"
    />
  );
}