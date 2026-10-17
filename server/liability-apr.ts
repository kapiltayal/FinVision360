export type ParsedOptionalInterestRate =
  | { value: string | null; error?: never }
  | { value?: never; error: string };

const MAX_INTEREST_RATE = 999.99;

/** Blank rates are unknown; asset returns may also be explicitly negative. */
export function parseOptionalInterestRate(value: unknown, options: { allowNegative?: boolean } = {}): ParsedOptionalInterestRate {
  const minimum = options.allowNegative ? -MAX_INTEREST_RATE : 0;
  const error = `Interest rate must be a number from ${minimum} to 999.99, or blank`;
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    return { value: null };
  }
  if (typeof value !== "string" && typeof value !== "number") {
    return { error };
  }
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < minimum || rate > MAX_INTEREST_RATE) {
    return { error };
  }
  return { value: rate.toFixed(2) };
}
