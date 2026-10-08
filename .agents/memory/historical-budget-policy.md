---
name: Historical budget policy
description: Product rules for frozen monthly plans, period-tagged closes, and missing historical data.
---

Budget periods before the current month are read-only. Historical income and living-expense rows must leave trend, monthly-average, and copy cells empty.

**Why:** The user explicitly requested immutable past plans and no current-based metrics that could misrepresent an older month.

**How to apply:** Protect both the interface and server writes. Keep monthly navigation usable and leave current/future editing unchanged.

Use the designated close's explicit budget period, not a nearest timestamp, to associate archived data with a month. Disclose the actual capture time: post-close capture is not a retroactive reconstruction of exact month-end state.

**Why:** Monthly runs can happen after month-end, and the user questioned what happens when a run is missed. Late live data cannot reliably recreate a prior state.

**How to apply:** Do not silently replace missing closes with live records, older snapshots, or zero. Verified historical sources may later be associated explicitly; do not fabricate them from late live-table retries.

Keep deliberately saved monthly amounts visible and counted even when the matching debt/goal snapshot is missing or the live entity has been deleted. Distinguish known saved subtotals from unavailable complete totals.

**Why:** The user specifically raised changed debt/goal plan amounts when a backup fails; missing entity history must not hide those adjustments or imply an empty budget.

**How to apply:** Retain identifying labels independently of live entities. Missing detail fields are unavailable, not zero, while a deliberately saved zero remains valid.
