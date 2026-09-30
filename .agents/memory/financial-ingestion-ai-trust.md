---
name: Financial ingestion AI trust boundary
description: Reliability rules for AI categorization and later user corrections during financial imports.
---

AI may suggest one exact database category for an extracted row, but it must never overwrite source financial values or control row identity. Never invent a category: persist exact canonical labels rather than derived slugs.

For transaction-file ingestion, a missing, malformed, or unusable AI categorization result must not drop an otherwise valid transaction or abort the upload. Save unresolved rows as unassigned and explicitly alert the user that category review is needed.

Transaction ingestion classification order is a product rule: first reuse the user's explicit category choice for the same normalized merchant and transaction type; next match canonical category fields supplied in the ingested record; then ask AI using every available field; finally persist any remainder as unassigned.

User corrections to transaction parent category, category, need/want, or recurring status are authoritative. Track both a user-modified flag and old/new audit history; automated imports and recurring detection must not overwrite those corrected fields.

**Why:** Model output can omit or alter amounts, caller-controlled transport fields can associate a category with the wrong record, and categorization quality must not cause valid financial records to disappear. Later automated syncs can also erase an intentional user correction.

**How to apply:** Preserve that four-stage order for file and API ingestion. Treat category audit history and manual entries as explicit user merchant choices; do not infer category preference from a flag that may only reflect recurrence or Need/Want edits. Keep source rows authoritative, validate AI output against the live lookup table, count and surface unassigned imports, and exclude user-modified fields from automated overwrite paths.

For reviewed asset and liability file imports, show every nonblank source row even if category recognition fails or a required field is missing. Make an unmatched source category visible alongside any suggestion so the reviewer can correct it.

**Why:** Omitting sparse rows or hiding an uploaded category behind an automatic guess can turn a fixable import into silent data loss or incorrect categorization.

**How to apply:** Treat suggestions as editable, not authoritative. Only the reviewer may remove a row; require valid fields before saving.

Save a reviewed financial file all-or-nothing and keep the review intact if saving fails.

**Why:** Partial writes followed by a retry can duplicate the successful entries while the skipped entries disappear from the review.

**How to apply:** Validate the whole reviewed batch first, then commit in a single transaction; report a failed save without clearing the review.