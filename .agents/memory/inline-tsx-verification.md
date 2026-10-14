---
name: TypeScript verification constraints
description: Runtime and compiler compatibility pitfalls when verifying TypeScript changes.
---

Inline `tsx -e` commands compile through a CommonJS output path in this project, so top-level `await` fails. The active Node runtime also does not provide `Object.groupBy`.

**Why:** Database verification initially failed before executing because of top-level `await`, and a later read-only verification failed when it used `Object.groupBy`.

**How to apply:** Wrap asynchronous inline checks in an async IIFE and use broadly supported loops or `reduce` for grouping.

Build success does not imply compatibility with the project's TypeScript checking target. Use array materialization when iterating Map/Set values rather than changing compiler settings as an incidental feature fix.

**Why:** Modern runtime tests and bundling accepted iterator loops that the project's older type-checking target rejected, also producing cascading inference errors.

**How to apply:** Run the project type check alongside builds, separate newly introduced diagnostics from unrelated baseline failures, and keep feature edits compatible with the existing compiler configuration.