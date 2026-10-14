---
name: Styling compatibility
description: Preserve the existing design during security-driven styling-toolchain upgrades.
---

Treat a security-driven styling upgrade as a compatibility change, not a redesign. Keep the existing palette and utility behavior unless a visual change is requested.

**Why:** The user approved a major styling-toolchain upgrade to remove an unpatched build dependency. Tailwind's changed defaults and reuse of existing app CSS token names can otherwise silently alter shadows, colors, and focus accessibility. Its compiler can append built-in declarations after same-name custom utilities, so apparent source-level overrides may not actually win.

**How to apply:** Retain compatibility values when simplifying theme code; inline legacy values when app tokens with the same name would override them. Inspect generated CSS, not just utility source. Check public layouts, responsive styles, and forced-colors focus behavior. Do not weaken accessible focus outlines merely to remove a compatibility rule.
