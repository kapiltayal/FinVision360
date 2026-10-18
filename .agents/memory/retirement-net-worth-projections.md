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

Account inclusion is an independent scenario choice for each Retirement Planner projection. Excluding an account from retirement Net Worth must not implicitly exclude its withdrawal income or debt payment from Income/Expense, or change live balances, budgets, goal funding, or archives.

**Why:** A user may omit an illiquid asset from a net-worth scenario while still needing to model its associated cash-flow commitments. Cross-coupling the selections would silently change a different scenario.

**How to apply:** Default new accounts to included, persist each projection's choice separately, and build each projection from its own selected inputs.

The user wants inclusion checkboxes beside every existing account or item, including custom projection-only assets/debts, custom income/expenses and benefit rows—not a separate account-management section. Keep unchecked items visible and show the number excluded above the calculation.

**Why:** A separate selector takes unnecessary space; removing unchecked rows would also remove the user's way to re-include them.

**How to apply:** Keep presentation rows distinct from calculation inputs, including custom items and accounts that currently have no cash-flow contribution. Excluded rows must not contribute to totals or missing-input callouts. Preserve original saved amounts for editing; a zero excluded contribution must never overwrite an item's configured value.

The exclusion notice names every excluded item. Its Reset action re-includes all items in the active projection only; it does not reset financial assumptions or the other projection's scenario.

**Why:** Net Worth and Income/Expense are independent scenarios. A compact reset should undo exclusions in the view the user is looking at, without silently discarding choices elsewhere.

**How to apply:** Reset physical and custom/built-in items together, scope updates to the authenticated user and current projection, and clear the notice only after refreshed results show no exclusions.