export type ParsedOptionalInterestRate =
  | { value: string | null; error?: never }
  | { value?: never; error: string };

const MAX_INTEREST_RATE = 999.99;

/** Blank APR means unknown; an explicit numeric zero remains a known 0% rate. */
export function parseOptionalInterestRate(value: unknown): ParsedOptionalInterestRate {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    return { value: null };
  }
  if (typeof value !== "string" && typeof value !== "number") {
    return { error: "Interest rate must be a number from 0 to 999.99, or blank" };
  }
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > MAX_INTEREST_RATE) {
    return { error: "Interest rate must be a number from 0 to 999.99, or blank" };
  }
  return { value: rate.toFixed(2) };
}
