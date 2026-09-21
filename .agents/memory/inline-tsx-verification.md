---
name: Inline TypeScript verification scripts
description: Runtime constraints for one-off tsx commands used to verify database and calculation changes.
---

Inline `tsx -e` commands compile through a CommonJS output path in this project, so top-level `await` fails. The active Node runtime also does not provide `Object.groupBy`.

**Why:** Database verification initially failed before executing because of top-level `await`, and a later read-only verification failed when it used `Object.groupBy`.

**How to apply:** Wrap asynchronous inline checks in an async IIFE and use broadly supported loops or `reduce` for grouping.