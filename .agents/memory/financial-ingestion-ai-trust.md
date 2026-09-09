---
name: Financial ingestion AI trust boundary
description: Reliability rules for AI categorization and later user corrections during financial imports.
---

AI may decide whether an extracted row is a financial entry and assign one exact database category, but it must never overwrite source financial values or control row identity. A completed empty, malformed, or unreadable AI response is a visible ingestion failure, not permission to invent or silently fall back. Persist exact canonical category labels rather than derived slugs.

User corrections to transaction parent category, category, need/want, or recurring status are authoritative. Track both a user-modified flag and old/new audit history; automated imports and recurring detection must not overwrite those corrected fields.

**Why:** Model output can omit or alter amounts, caller-controlled transport fields can associate a category with the wrong record, and later automated syncs can erase an intentional user correction.

**How to apply:** Keep source rows authoritative, send bounded copies under server-owned row identifiers, validate AI categories against the live lookup table, make edit plus audit writes atomic, and exclude user-modified classification fields from automated overwrite paths.