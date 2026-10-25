---
name: Financial ingestion AI trust boundary
description: Reliability rules for AI categorization and later user corrections during financial imports.
---

AI may suggest one exact database category for an extracted row, but it must never overwrite source financial values or control row identity. Never invent a category: persist exact canonical labels rather than derived slugs.

For transaction-file ingestion, a missing, malformed, or unusable AI categorization result must not drop an otherwise valid transaction or abort the upload. Save unresolved rows as unassigned and explicitly alert the user that category review is needed.

Requested ingestion classification policy: identify the merchant first, then reuse the user's explicit category choice for that merchant and transaction type; next use the global merchant's type-compatible category; next match supplied source categories; then batch unresolved rows for AI using lookup IDs and descriptions. AI returns a validated lookup ID or an Uncategorized result, not an invented category. A new explicit manual selection and the reviewer's final selection remain authoritative.

User corrections to transaction parent category, category, need/want, or recurring status are authoritative. Track both a user-modified flag and old/new audit history; automated imports and recurring detection must not overwrite those corrected fields.

**Why:** Model output can omit or alter amounts, caller-controlled transport fields can associate a category with the wrong record, and categorization quality must not cause valid financial records to disappear. Later automated syncs can also erase an intentional user correction. A brand's usual expense category is not a reason to turn its refund into an expense.

**How to apply:** Apply the requested priority to file and Plaid ingestion after validation/parsing but before duplicate handling and subscription detection. Treat category audit history and manual entries as explicit user merchant choices; do not infer category preference from a flag that may only reflect recurrence or Need/Want edits. Keep source rows authoritative, require merchant profiles and AI IDs to match the source income/expense direction, validate AI output against the live lookup table, count and surface unresolved imports, and exclude user-modified fields from automated overwrite paths.

For reviewed financial file imports (assets, liabilities, and transactions), show every nonblank source row even if category recognition fails or a required field is missing. Make an unmatched source category visible alongside any suggestion so the reviewer can correct it. Transaction categories remain optional: unresolved rows may save as unassigned.

**Why:** Omitting sparse rows or hiding an uploaded category behind an automatic guess can turn a fixable import into silent data loss or incorrect categorization.

**How to apply:** Treat suggestions as editable, not authoritative. Only the reviewer may remove a row; require valid fields before saving. Reject oversized files rather than presenting a truncated preview.

Save a reviewed financial file all-or-nothing and keep the review intact if saving fails.

**Why:** Partial writes followed by a retry can duplicate the successful entries while the skipped entries disappear from the review.

**How to apply:** Validate the whole reviewed batch first, then commit in a single transaction; report a failed save without clearing the review.

Recurrence frequency should come from an explicit source/reviewer/provider choice or consistent transaction history, not an AI guess based on merchant identity. Keep unknown frequency `NULL` and preserve explicit reviewer choices during automatic sync.

**Why:** A subscription brand does not establish a customer's billing schedule, and short histories can make biweekly and semi-monthly schedules indistinguishable.

**How to apply:** Require multiple observed intervals before assigning an inferred frequency. Priority is user overrides (including negative choices), then this user's saved positive merchant tags, then Plaid signals, then explicit merchant-only profiles, then temporal/amount heuristics. Reuse saved tags exactly, including unknown frequency; later amount/interval variation must not silently reclassify an already recurring merchant. Merchant-only profiles can establish type without history, but not a guessed frequency.

File-upload detection must happen after standardization and duplicate checking, before preview, with no writes. Final review choices must not be redetected on save.

**Why:** The user explicitly requested a chance to correct algorithmic suggestions; running detection after review would silently undo those choices. Excluded duplicates must not manufacture recurrence evidence.

**How to apply:** Combine included incoming rows with only that user's history, audit recurrence-specific review edits, and reuse those explicit tags on future imports. If historical overrides conflict, use the most recent explicit choice for new rows while preserving each already-corrected row.

Confirmed recurring merchant tags must also reach eligible historical transactions, scoped to the same user and merchant, while preserving already user-modified rows.

**Why:** The user wants a merchant's ledger to have consistent recurrence tags once detection establishes a classification, not only the newest imported rows. Explicit user corrections remain authoritative.

**How to apply:** Plaid detection scopes affected merchant groups from imported IDs and backfills their history. File preview does not write; file save backfills history from final reviewed positive tags in the same transaction, without redetecting or changing any reviewed row. Resolve conflicting saved automatic tags by newest transaction date, then highest ID, but always prefer explicit user overrides.