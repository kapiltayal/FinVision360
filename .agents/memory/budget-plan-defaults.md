---
name: Budget plan defaults
description: Product expectations for suggested amounts versus explicitly saved monthly budget values.
---

Treat suggested monthly amounts as the effective starting budget until the user saves an override. Inputs, section subtotals, summary cards, and variances must agree. A saved zero is intentional, not a missing amount.

**Why:** The user reported populated income and living-expense amounts alongside $0 Plan subtotals. Displaying a suggestion as the monthly plan while excluding it from totals misrepresents the budget.

Keep viewing a month read-only: suggestions are not automatically persisted merely because the page is opened. Persist an override through an explicit edit or save/copy action.

**Why:** Existing debt and goal suggestions are computed defaults, and silently writing defaults on reads would modify monthly plans without a deliberate user action.

**How to apply:** Use the same effective values throughout the budget. Any future action that freezes defaults should clearly distinguish it from overwriting already-saved amounts, including zero.
