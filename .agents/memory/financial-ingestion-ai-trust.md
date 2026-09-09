---
name: Financial ingestion AI trust boundary
description: Reliability rules for AI categorization and later user corrections during financial imports.
---

AI may decide whether an extracted row is a financial entry and assign one exact database category, but it must never overwrite source financial values or control row identity. Never invent a category: persist exact canonical labels rather than derived slugs.

For transaction-file ingestion, a missing, malformed, or unusable AI categorization result must not drop an otherwise valid transaction or abort the upload. Save unresolved rows as unassigned and explicitly alert the user that category review is needed.

User corrections to transaction parent category, category, need/want, or recurring status are authoritative. Track both a user-modified flag and old/new audit history; automated imports and recurring detection must not overwrite those corrected fields.

**Why:** Model output can omit or alter amounts, caller-controlled transport fields can associate a category with the wrong record, and categorization quality must not cause valid financial records to disappear. Later automated syncs can also erase an intentional user correction.

**How to apply:** Keep source rows authoritative, send bounded copies under server-owned row identifiers, validate AI categories against the live lookup table, count and surface unassigned imports, make edit plus audit writes atomic, and exclude user-modified classification fields from automated overwrite paths.