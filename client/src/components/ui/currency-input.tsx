import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  value: string | number;
  onChange: (raw: string) => void;
}

/**
 * A text input that displays a numeric value with thousand-place commas
 * (e.g. 25000 → "25,000"). Strips commas before calling onChange so
 * downstream state always receives a plain numeric string.
 */
export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
  const [focused, setFocused] = React.useState(false);

  // Strip commas from a string, keep digits and a single leading minus
  const strip = (v: string) => v.replace(/,/g, "");

  // Format with commas, preserving a trailing decimal point the user is typing
  const format = (v: string | number): string => {
    const s = String(v);
    const stripped = strip(s);
    const num = parseFloat(stripped);
    if (isNaN(num)) return stripped; // keep whatever they're typing
    const [intPart, decPart] = stripped.split(".");
    const formatted = parseInt(intPart || "0", 10).toLocaleString("en-US");
    return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only digits, commas, dots, and a leading minus
    const raw = strip(e.target.value.replace(/[^0-9.,\-]/g, ""));
    onChange(raw);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      className={cn(className)}
      value={focused ? strip(String(value)) : format(value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={handleChange}
    />
  );
}
