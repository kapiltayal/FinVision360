---
name: Historical budget policy
description: Product rules for frozen monthly plans, period-tagged closes, and missing historical data.
---

Budget periods before the current month are read-only. Historical income and living-expense rows must leave trend, monthly-average, and copy cells empty.

**Why:** The user explicitly requested immutable past plans and no current-based metrics that could misrepresent an older month.

**How to apply:** Protect both the interface and server writes. Keep monthly navigation usable and leave current/future editing unchanged.

Prefer a new period-tagged close. For older monthly backups, accept a legacy month only when exactly one shared debt-and-goal backup timestamp exists on the first UTC calendar day immediately following that period; never choose a merely nearby snapshot. Rebuild unsaved income/expense defaults from the preceding 12 complete transaction months and let explicit saved rows override them. Disclose that these plan defaults are reconstructed, plus the archive capture time.

**Why:** The development database has paired legacy backups and period-dated transactions, but no original per-month snapshots of unsaved plan defaults. The user expects the following month's scheduled backup to represent the completed period.

**How to apply:** This narrowly defined legacy match can power a read-only reconstructed view; do not use live debts/goals, current rolling averages, older archives, or zero to fill gaps. If the paired first-day archive is absent or ambiguous, keep missing details unavailable.

Keep deliberately saved monthly amounts visible and counted even when the matching debt/goal snapshot is missing or the live entity has been deleted. Distinguish known saved subtotals from unavailable complete totals.

**Why:** The user specifically raised changed debt/goal plan amounts when a backup fails; missing entity history must not hide those adjustments or imply an empty budget.

**How to apply:** Retain identifying labels independently of live entities. Missing detail fields are unavailable, not zero, while a deliberately saved zero remains valid.
