---
name: Budget category authority
description: Product requirement for catalog-driven category rows and stable numeric identity in budgeting.
---

Current and future budget income/expense categories must come from the transaction category catalog, not separately maintained fixed lists. Use category IDs for operations and names for display.

**Why:** The user explicitly requested this after label/key differences caused zero averages and flat trends despite populated transaction history. Adding name normalization alone is not the desired long-term solution.

**How to apply:** Do not introduce a second budget-only category taxonomy. Preserve explicit saved overrides (including zero), unresolved legacy amounts, and already frozen close records. Category renames must not detach saved amounts or transaction history; historical display names remain those captured at close.

For current and future months, order income and expense categories by monthly average, highest first. Do not apply this ordering to historical months.

**Why:** The user explicitly requested average-based ordering in both editable sections, scoped to current and future months.

**How to apply:** Sort by each category's historical monthly average, not its planned amount or selected-month actuals; preserve existing order when averages are equal.
