---
name: Retirement net-worth projections
description: Durable assumptions for projecting account values and debt balances at retirement.
---

Asset type default returns are stored as decimal fractions, while account rates and user projection overrides are percentages. Use a saved override first, then a meaningful account rate, then the asset type default.

**Why:** Mixing fraction and percentage units produces materially incorrect compound growth, and legacy account rows use zero where an account-specific return was not provided.

**How to apply:** Convert asset type defaults to percentages before display or compounding. Keep user overrides separate from source account data so resetting an override restores the account/category assumption.

Liability projections must carry the current balance to retirement when required inputs are missing or contradictory. A past maturity date with a positive balance is contradictory, not proof that the debt is paid.

**Why:** Assuming zero interest or trusting a stale maturity date can understate retirement liabilities and overstate projected net worth.

**How to apply:** Mark the account projection as unknown and retain its current balance when APR/payment information is insufficient or a maturity date has passed while a balance remains. A future maturity on or before retirement can support a paid-off result.