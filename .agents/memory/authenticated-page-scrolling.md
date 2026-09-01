---
name: Authenticated page scrolling
description: The authenticated application uses one document-level scrollbar rather than nested viewport scroll regions.
---

Authenticated pages should grow with their content and use document-level scrolling. Do not constrain the application shell or tab content to a fixed viewport-height scroll region.

**Why:** A scrollable inner content region produced two visible scrollbars and placed the footer inside the inner scroll area, making it appear detached from the outer page.

**How to apply:** Keep page and tab wrappers in normal document flow. Reserve local overflow scrolling for bounded controls such as menus, dialogs, and compact data panels—not whole-page content.