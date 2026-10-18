---
name: Liability Map visualizations
description: Financial meaning and scenario scope for the Gantt and interactive 3D bubble views.
---

The Liability Map's Gantt and 3D bubble views are two presentations of the same planning scenario, not different financial models. Switching views or moving the camera must not change balances, duration overrides, or interest totals.

**Why:** The user wants to switch representations to explore debts; camera gestures are not financial edits. Separate estimation paths could make the same debt show conflicting interest amounts.

**How to apply:** Reuse the shared exposure and amortized-interest calculations. The 3D view uses remaining months, APR, and estimated remaining interest as spatial axes, with bubble area representing balance (minimum visible size disclosed). Keep unavailable measurements out of plotted coordinates and explain why those debts are unplotted, without removing them from portfolio totals.
