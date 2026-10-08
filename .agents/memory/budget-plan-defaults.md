---
name: Budget plan defaults
description: Product expectations for suggested amounts versus explicitly saved monthly budget values.
---

For current and future months, treat suggested monthly amounts as the effective starting budget until the user saves an override. Inputs, section subtotals, summary cards, and variances must agree. A saved zero is intentional, not a missing amount. Historical months instead require preserved period values; never apply today's suggestions to fill archive gaps.

**Why:** The user reported populated income and living-expense amounts alongside $0 Plan subtotals. Displaying a suggestion as the monthly plan while excluding it from totals misrepresents the budget.

Keep viewing a month read-only: suggestions are not automatically persisted merely because the page is opened. Persist an override through an explicit edit or save/copy action.

**Why:** Existing debt and goal suggestions are computed defaults, and silently writing defaults on reads would modify monthly plans without a deliberate user action.

**How to apply:** Use the same effective values throughout the budget. Any future action that freezes defaults should clearly distinguish it from overwriting already-saved amounts, including zero.

For current and future budget months, carry the Goals page's current monthly savings requirement unchanged through the goal's deadline month. Stop suggesting contributions after that month; preserve explicitly saved monthly overrides.

**Why:** The user requested using the monthly amount from the goal's page for future months until its goal date, rather than increasing the amount every time a later budget month is selected.

**How to apply:** Changing the selected future budget month must not change the contribution rate. Changes to the underlying goal may change the Goals-page amount, which then becomes the updated default.
