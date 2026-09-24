---
name: Retirement net-worth projections
description: Durable assumptions for projecting account values and debt balances at retirement.
---

Asset type default returns are stored as decimal fractions, while account rates and user projection overrides are percentages. Use a saved override first, then a meaningful account rate, then the asset type default.

**Why:** Mixing fraction and percentage units produces materially incorrect compound growth, and legacy account rows use zero where an account-specific return was not provided.

**How to apply:** Convert asset type defaults to percentages before display or compounding. Keep user overrides separate from source account data so resetting an override restores the account/category assumption.

When a valid birth date is available, calculate time to retirement from the exact calendar-day difference to the retirement date and convert that duration to fractional years; only use whole age-based years as the fallback.

**Why:** Month-based rounding can materially over- or understate compound growth for accounts whose retirement date falls partway through a month.

**How to apply:** Normalize both dates to UTC calendar days, divide the day count by 365.25 for annual compounding, use the same day count for liability payoff timing with a prorated final monthly period, and preserve the existing current-age fallback when no birth date is available.

Liability projections must carry the current balance to retirement when required inputs are missing or contradictory. A past maturity date with a positive balance is contradictory, not proof that the debt is paid.

**Why:** Assuming zero interest or trusting a stale maturity date can understate retirement liabilities and overstate projected net worth.

**How to apply:** Mark the account projection as unknown and retain its current balance when APR/payment information is insufficient or a maturity date has passed while a balance remains. A future maturity on or before retirement can support a paid-off result.