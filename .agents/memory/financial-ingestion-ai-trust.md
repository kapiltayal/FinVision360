---
name: Financial ingestion AI trust boundary
description: Reliability rules for using AI during asset and liability imports.
---

AI may decide whether an extracted row is a financial entry and assign one exact database category, but it must never overwrite source financial values or control row identity. Only provider failures, disconnects, or timeouts permit deterministic fallback; a completed empty, malformed, or unreadable AI result does not.

**Why:** Model output can omit or alter amounts and caller-controlled transport fields can associate a category with the wrong record. Falling back after a completed no-result response also hides semantic AI failures.

**How to apply:** Keep full source rows authoritative, send bounded copies under server-owned row identifiers, require unique in-range identifiers in AI output, and treat response-validation failures separately from provider availability failures.