---
name: Radix submenu placement
description: Interaction constraints for nested Radix dropdown submenus.
---

Use the full parent row as the Radix submenu trigger anchor. When a right-aligned root menu runs out of room, Radix flips the submenu to the left; anchoring only to a small trailing chevron makes the submenu extend across the root menu.

When a `DropdownMenuSubTrigger` wrapper uses `asChild`, pass exactly one child element. Put the chevron inside that child instead of appending a sibling from the wrapper.

**Why:** Narrow trigger geometry caused visible overlap, and the wrapper-added icon caused a `React.Children.only` runtime error after switching to `asChild`.

**How to apply:** Preserve the full-row anchor and single-child contract when changing nested navigation menus or their trigger wrapper.