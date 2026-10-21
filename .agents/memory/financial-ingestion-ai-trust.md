---
name: Financial ingestion AI trust boundary
description: Reliability rules for AI categorization and later user corrections during financial imports.
---

AI may suggest one exact database category for an extracted row, but it must never overwrite source financial values or control row identity. Never invent a category: persist exact canonical labels rather than derived slugs.

For transaction-file ingestion, a missing, malformed, or unusable AI categorization result must not drop an otherwise valid transaction or abort the upload. Save unresolved rows as unassigned and explicitly alert the user that category review is needed.

Transaction-file classification order is a product rule: first reuse the user's explicit category choice for the same normalized merchant and transaction type; next match canonical category fields supplied in the ingested record; next use a recognized merchant's type-compatible canonical profile; then ask AI using every available field; finally persist any remainder as unassigned. A new explicit manual selection and the reviewer's final selection remain authoritative.

User corrections to transaction parent category, category, need/want, or recurring status are authoritative. Track both a user-modified flag and old/new audit history; automated imports and recurring detection must not overwrite those corrected fields.

**Why:** Model output can omit or alter amounts, caller-controlled transport fields can associate a category with the wrong record, and categorization quality must not cause valid financial records to disappear. Later automated syncs can also erase an intentional user correction. A brand's usual expense category is not a reason to turn its refund into an expense.

**How to apply:** Preserve that priority for file ingestion. Manual and bank flows should try user preferences before known profiles or heuristic guesses, without replacing explicit selections. Treat category audit history and manual entries as explicit user merchant choices; do not infer category preference from a flag that may only reflect recurrence or Need/Want edits. Keep source rows authoritative, require merchant profiles to match the source income/expense direction, validate AI output against the live lookup table, count and surface unassigned imports, and exclude user-modified fields from automated overwrite paths.

For reviewed financial file imports (assets, liabilities, and transactions), show every nonblank source row even if category recognition fails or a required field is missing. Make an unmatched source category visible alongside any suggestion so the reviewer can correct it. Transaction categories remain optional: unresolved rows may save as unassigned.

**Why:** Omitting sparse rows or hiding an uploaded category behind an automatic guess can turn a fixable import into silent data loss or incorrect categorization.

**How to apply:** Treat suggestions as editable, not authoritative. Only the reviewer may remove a row; require valid fields before saving. Reject oversized files rather than presenting a truncated preview.

Save a reviewed financial file all-or-nothing and keep the review intact if saving fails.

**Why:** Partial writes followed by a retry can duplicate the successful entries while the skipped entries disappear from the review.

**How to apply:** Validate the whole reviewed batch first, then commit in a single transaction; report a failed save without clearing the review.

Recurrence frequency should come from an explicit source/reviewer choice or consistent transaction history, not an AI guess based on merchant identity. Keep unknown frequency `NULL` and preserve existing frequency choices during automatic sync.

**Why:** A subscription brand does not establish a customer's billing schedule, and short histories can make biweekly and semi-monthly schedules indistinguishable.

**How to apply:** Require multiple observed intervals before assigning an inferred frequency. Prefer leaving the frequency unknown over guessing, and never replace an explicit imported or user-selected frequency with a detector's estimate.