---
name: Liability Map visualizations
description: Financial meaning and scenario scope for the Gantt and two-axis, 3D-styled bubble views.
---

The Liability Map's Gantt and bubble views are two presentations of the same planning scenario, not different financial models. Switching views or panning/zooming must not change balances, duration overrides, or interest totals.

**Why:** The user wants to switch representations to explore debts; camera gestures are not financial edits. Separate estimation paths could make the same debt show conflicting interest amounts.

**How to apply:** Reuse the shared exposure and amortized-interest calculations. The user explicitly clarified that the chart must have ONLY TWO axes: remaining months (X) and APR (Y), with bubble area representing balance (minimum visible size disclosed). Three-dimensional appearance comes from sphere shading, not a Z axis, perspective, or orbit controls. Remaining interest belongs in debt details, not a spatial axis. Keep unavailable axis measurements out of plotted coordinates and explain why those debts are unplotted, without removing them from portfolio totals.

Axes, axis titles, and tick positions must remain stationary during pan and zoom; only the interior plot changes. Recompute tick values from the visible range and clip bubbles to the plot boundary.

**Why:** The user explicitly corrected the moving-axis behavior; navigation should change the data viewport, not move the coordinate frame.

On initial load/reset, each nonzero axis maximum is 105% of its highest plotted value. Gantt-only sorting controls must not appear in Bubble view.

**Why:** The user requested 5% upper headroom and clarified that row-order sorting does not apply to a scatter/bubble plot.

Bubble tooltips belong next to the hovered or selected sphere, not in a fixed corner. Convert SVG positions to CSS pixels, flip near edges, and update the anchor with pan/zoom and resizing.

**Why:** The user specifically asked for the details box to remain near the bubble.
