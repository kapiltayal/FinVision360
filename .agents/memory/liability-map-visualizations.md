---
name: Liability Map visualizations
description: Financial meaning and scenario scope for the Gantt and flat two-axis bubble views.
---

The Liability Map's Gantt and bubble views are two presentations of the same planning scenario, not different financial models. Switching views or panning/zooming must not change balances, duration overrides, or interest totals.

**Why:** The user wants to switch representations to explore debts; camera gestures are not financial edits. Separate estimation paths could make the same debt show conflicting interest amounts.

**How to apply:** Reuse the shared exposure and amortized-interest calculations. The user explicitly clarified that the chart must have ONLY TWO axes: remaining months (X) and APR (Y), with bubble area representing balance (minimum visible size disclosed). Use flat 2D circles, not shaded spheres, a Z axis, perspective, or orbit controls. Remaining interest belongs in debt details, not a spatial axis. Keep unavailable axis measurements out of plotted coordinates and explain why those debts are unplotted, without removing them from portfolio totals.

**Why:** After trying 3D-styled bubbles, the user explicitly requested 2D because the shading was not adding value. They subsequently requested no bubble outlines, including selection outlines; use non-border keyboard focus feedback.

Axes, axis titles, and tick positions must remain stationary during pan and zoom; only the interior plot changes. Recompute tick values from the visible range and clip bubbles to the plot boundary.

**Why:** The user explicitly corrected the moving-axis behavior; navigation should change the data viewport, not move the coordinate frame.

On initial load/reset, each nonzero axis maximum is 110% of its highest plotted value. Gantt-only sorting controls must not appear in Bubble view.

**Why:** The user increased upper headroom from 5% to 10% and clarified that row-order sorting does not apply to a scatter/bubble plot.

Bubble tooltips belong next to the hovered or selected bubble, not in a fixed corner. Convert SVG positions to CSS pixels, flip near edges, and update the anchor with pan/zoom and resizing.

**Why:** The user specifically asked for the details box to remain near the bubble.

Place the view toggle at the right of the balance/interest summary, and show only the active view's legend.

**Why:** The user wants the switch above the chart and identified duplicated legends in Bubble view.

Bubble view uses its own “Debt landscape” heading and zoom/reset controls; do not also show the Gantt-only “Exposure matrix” heading there.

**Why:** The user asked for the Bubble chart to replace the Exposure matrix section rather than display both headers.

**How to apply:** Keep Exposure matrix and its sorting controls exclusive to Gantt. In Bubble view, show the Debt landscape heading before its single Bubble legend.
