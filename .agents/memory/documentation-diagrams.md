---
name: Documentation diagram compatibility
description: Why transaction-ingestion flowcharts must not depend on Mermaid rendering.
---

Keep documentation flowcharts visible without requiring a Mermaid renderer. Provide a local image plus a readable text equivalent; editable diagram source can remain secondary.

**Why:** The user reported that the ingestion guide's Mermaid-only flowcharts did not display in their documentation viewer.

**How to apply:** When changing ingestion flows, update the visible diagram, numbered steps and optional source together. Check local image paths and render the image, rather than validating Mermaid syntax alone.
