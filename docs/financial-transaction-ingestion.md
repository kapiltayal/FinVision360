# Financial Transaction Ingestion and Processing

*Implementation guide, verified against the application code on October 8, 2026.*

This guide covers the two transaction sources exposed in the Finance Tracker: user-uploaded files and transactions imported on request from Plaid-connected accounts. It follows each path from the user's selection through parsing, quality checks, categorization, preview or confirmation, and database persistence.

## At a glance

```text
File upload
Choose file → server parses and suggests fields/categories → editable review
→ server validates every reviewed row → one database transaction → import summary

Plaid
Choose institution/account and dates → server fetches Plaid pages
→ filters and categorizes each transaction → insert-or-update by Plaid ID
→ recurring detection → import summary
```

The key user-facing difference is that **file uploads are previewed and edited before saving**, while **Plaid rows are written immediately after the user clicks Import**. Plaid provides an ID for reliable re-import matching; uploaded files do not have a comparable duplicate key.

## Common transaction record

Both flows write to the `transactions` table. The signed-in user's ID is assigned by the server, not taken from an uploaded row or browser-supplied transaction identity.

| Field | What is stored |
|---|---|
| `date`, `description`, `merchant` | Transaction date and display/search text. Merchant falls back to description when needed. |
| `amount`, `type` | A positive numeric amount and a separate `income` or `expense` type. |
| `parent_category`, `subcategory` | Canonical category values; the parent may be empty for unassigned transactions. |
| `needs_want` | `need`, `want`, or `na`. |
| `is_recurring`, `recurring_type` | Recurrence flag and, when set, `subscription` or `recurring_bill`. |
| `source` | `upload` for file imports or `plaid` for connected-account imports. Manual transactions use a separate source. |
| Plaid metadata | Plaid transaction ID, account ID/name, and institution name; populated only for Plaid rows. |
| `notes`, timestamps | Optional notes and database-managed creation/update timestamps. |

The database constrains transaction type, Need/Want value, recurring type, and source. Amount is stored as `NUMERIC(12,2)`. The database has a partial unique index on `(user_id, plaid_transaction_id)` when the Plaid ID is present; it does **not** impose a comparable uniqueness rule on file uploads.

# File uploads

## 1. User selects a file

The Finance Tracker file-import panel accepts `.csv`, `.tsv`, `.txt`, `.xls`, and `.xlsx` files, one file at a time, up to 5 MiB. The browser checks the extension and size before enabling **Preview File**. The server repeats the size check and verifies the extension against the MIME type; XLS/XLSX files also need the expected file signature.

Uploads are handled in memory. The current flow does not save the original file as a permanent document.

## 2. Server parses and bounds the file

The authenticated preview request is `POST /api/transactions/ingest/preview`, with the file in multipart form data. The server:

1. Rejects unsupported or mismatched file types and unreadable/corrupt content.
2. Parses CSV/TSV/TXT as UTF-8 text, or reads the workbook for XLS/XLSX. A delimited file uses its first nonblank record as the header; columns may be in any order. Header matching ignores case, spaces, and punctuation.
3. Recognizes date headers such as `Date`, `Transaction Date`, and `Posted Date`; description headers such as `Description`, `Merchant`, `Name`, `Memo`, and `Text`; and amount headers such as `Amount`, `Value`, `Debit`, and `Credit`.
4. Excludes completely blank rows and counts them for the review screen. A nonblank row is retained even if required values are missing or invalid, so the user can correct it.
5. Rejects an import with more than 500 nonblank rows instead of silently previewing only part of the file. It also rejects empty or corrupt files.

For delimited files, records are limited to 20,000 characters. XLSX archives are bounded during parsing. Invalid dates, descriptions, amounts, or categories are not silently considered valid just because a parser produced a row.

## 3. Server maps source fields into review rows

Each nonblank source row becomes an editable transaction draft. The importer normalizes fields for the preview:

- **Date:** ISO and US-style dates are normalized when valid. Dates that cannot be normalized remain visible for correction and fail save validation until fixed.
- **Description and merchant:** The source description is retained; merchant defaults to the source merchant or description.
- **Amount and type:** Currency symbols and grouping commas are accepted for parsing. Parentheses and minus signs are recognized as negative source notation, but the stored amount is a positive magnitude; income versus expense is a separate field. Type comes from an explicit type column or debit/credit layout when available, and otherwise defaults to expense. Type labels such as credit/deposit and debit/withdrawal are recognized.
- **Need/Want and recurrence:** Recognized values are normalized. Missing Need/Want becomes `na`; recurrence can be reviewed as false/true and, when true, assigned a supported recurrence type.
- **Source category:** An uploaded category is retained separately in the preview so the reviewer can compare it with the selected canonical category. The raw source category is not a transaction-table column.

The preview drafts receive temporary row numbers for editing. These numbers are not database transaction IDs.

## 4. Category suggestions are prepared

The server loads the user's canonical transaction categories and prior merchant-category preferences. For each row it uses this order:

1. **Reuse the user's explicit merchant preference.** Preferences come from manual transactions or transactions with an explicit category/parent-category edit, keyed by normalized merchant and transaction type.
2. **Match the uploaded category.** A source category is used only if it matches a canonical category for that income/expense type and, when present, its parent category.
3. **Ask AI to classify unresolved rows.**
4. **Leave it unassigned** if no usable canonical suggestion is available.

The AI request is a separate, non-streaming JSON classification call. It receives only the rows still needing classification plus the allowed canonical category list. The prompt asks for an exact category from that list and a transaction type; the server validates each returned source-row index and verifies the type/category against the live canonical list. AI output cannot replace the row's date, amount, description, merchant, or temporary row identity.

If the AI service is unavailable, returns malformed output, or cannot identify a valid category, the preview still proceeds. The row remains available for review and may be saved as unassigned. Valid uploaded Need/Want data is kept; otherwise, a canonical category's Need/Want value may be suggested.

Because the classifier receives the complete source row for unresolved categories, that row can include uploaded fields such as descriptions, amounts, notes, or other columns. Rows already matched by user preference or source category are not sent for AI categorization. Plaid transaction imports use Plaid categories and deterministic rules instead; they do not call this AI classifier.

## 5. User reviews the preview

The browser receives the draft rows and displays an editable table. Nothing has been written to `transactions` yet. The user can:

- Edit date, description, merchant, amount, type, category, Need/Want, recurring status/type, and notes.
- See the original source category separately when it differs from the current category choice.
- Remove unwanted rows or add a new row.
- Discard the review and choose another file.

Completely blank rows are reported as excluded. Invalid nonblank rows remain in the table and show field-level errors. Category is optional: the user can choose a canonical category or leave the transaction unassigned.

## 6. Server validates the reviewed batch

When the user clicks **Save**, the browser posts the edited rows to `POST /api/transactions/import-reviewed`. The server does not trust browser validation; it checks the whole batch again before opening a database connection:

- Batch must contain 1–500 entries.
- Date must be a real calendar date.
- Description is required.
- Amount must be positive, nonzero, have no more than two decimal places, and not exceed `$9,999,999,999.99`.
- Type must be `income` or `expense`.
- Any selected category must match a canonical category for the chosen type and parent; a parent cannot be supplied without a category.
- Need/Want must be `need`, `want`, or `na`.
- Recurring status must be boolean. A recurring row must have type `subscription` or `recurring_bill`; a non-recurring row must not have a recurring type.

If any row fails, the server returns field-specific validation errors (`422`) for the batch. No rows are written, and the review remains available so the user can correct it. A category-list loading error also disables the UI's save button.

## 7. File rows are committed atomically

After the entire batch validates, the server begins a PostgreSQL transaction and inserts every reviewed row with `source='upload'`. Canonical category values are stored; a category-less row is stored with `subcategory='unassigned'` and no parent category. The database generates the permanent row ID and timestamps.

- If every insert succeeds, the server commits the batch.
- If any insert fails, it rolls back the entire batch; the user does not get a partially saved reviewed import.
- The original upload is not retained. Only the reviewed transaction fields are saved.
- The reviewed path does not run automatic recurring detection; it saves recurrence values selected in the review.

On success, the result reports inserted and uncategorized counts. The reviewed path returns `skipped=0`: rows are either removed by the user before saving or the validated batch is saved in full. The Finance Tracker shows the result and any unassigned categories, then refreshes the list so the imported dates are visible.

## File-upload duplicate behavior

The current reviewed file flow does not compare transactions with one another or with existing database rows by date, description, merchant, or amount. Uploading the same file twice—or including the same source row twice—can create duplicate transaction rows. File rows have no Plaid ID and no file-import fingerprint.

### Additional immediate-save API

The server also exposes authenticated `POST /api/transactions/ingest`. The current Finance Tracker file-upload UI does **not** call this endpoint; it uses the two-step preview and `import-reviewed` flow above.

The direct endpoint parses, categorizes, and saves without the editable preview. It skips invalid rows and commits the remaining valid rows as one database transaction; if no valid row can be inserted, it rolls back and returns an error. It does not deduplicate file rows. It also runs recurring detection after a successful save. New interactive file-import clients should use the explicit preview/review path.

# Plaid-connected transactions

## 1. User chooses institution, account, and date range

The connected-account import panel lets the user choose all institutions or one institution, all eligible accounts or one account, and a start/end date. The browser submits only those selections to `POST /api/transactions/import-from-plaid`; Plaid access tokens remain server-side. There is no per-transaction editable preview in this flow.

The server requires valid dates, prevents a future end date, limits the range to two years, and verifies that the selected institution/account belongs to the signed-in user. At least one connected institution is required.

## 2. Server retrieves transactions from Plaid

For each selected Plaid Item, the server calls Plaid's date-range transaction endpoint using the stored Item access token. Results are fetched in pages of 500 until the reported total is reached. If an account was selected, the Plaid request is restricted to that account.

If Plaid cannot return transactions for one institution, that institution is listed as unavailable and the server continues with other selected institutions. This is reported as a partial result, not as a transaction preview.

## 3. Plaid rows pass import checks and are normalized

Each returned row is checked before persistence:

- Pending transactions are skipped.
- Transfers are skipped when Plaid's primary category is `TRANSFER_IN` or `TRANSFER_OUT`, or the detailed category is `LOAN_PAYMENTS_CREDIT_CARD_PAYMENT`.
- Only `USD` is imported; there is no currency conversion.
- The account must be one of the signed-in user's stored Plaid accounts, the amount must be finite and nonzero, and a canonical category must be resolved.

For accepted rows:

- Plaid's amount sign determines type: a negative amount is treated as income, otherwise expense. The stored amount is the absolute value.
- The saved description/merchant uses `merchant_name`, then `name`, then `"Bank transaction"` as a fallback. The request asks Plaid to include its original description, but the current save mapping does not use `original_description`.
- Plaid personal-finance categories are mapped to canonical categories first. Description-based deterministic rules provide fallback categories; this path does not call the AI classifier.
- Parent category and Need/Want come from the matched canonical category, defaulting Need/Want to `na` if it has none.
- The saved row includes `source='plaid'`, Plaid transaction/account IDs, account name, and institution name.

Rows that fail a check are counted under pending, transfer, unsupported currency, or invalid/unavailable reasons and are not inserted.

## 4. Plaid transactions are inserted or updated immediately

The database has a unique key for each non-null Plaid transaction ID within a user. The server uses `INSERT ... ON CONFLICT` with that key:

- A new Plaid ID creates a transaction.
- An existing Plaid ID updates the existing transaction instead of creating a duplicate. Re-importing overlapping date ranges therefore does not duplicate a matching Plaid transaction.
- Date, description, merchant, amount, type, source, and Plaid account metadata are refreshed from the current Plaid result.
- If the existing transaction is marked `is_user_modified`, its category, parent category, and Need/Want values are preserved; otherwise, those classification fields are refreshed from Plaid's category mapping.

The Plaid route issues database upserts row by row and does not wrap the entire multi-institution import in one database transaction. Institution retrieval errors are reported as unavailable and processing continues. An unexpected database error can fail the request after earlier rows have already committed.

The importer upserts rows returned by Plaid; it does not delete existing transactions that are absent from the selected response. It also does not merge a Plaid row with a similar manual or uploaded row because those rows do not share the Plaid transaction ID.

## 5. Recurring detection and import summary

After at least one Plaid row is inserted or updated, the server runs recurring detection across that user's transactions that are not marked `is_user_modified`. It groups normalized descriptions and checks consecutive transactions 20–45 days apart. When at least one such pair is found, it marks the group's rows recurring: amounts less than two cents apart for every qualifying pair are labeled `subscription`; otherwise they are labeled `recurring_bill`.

The UI shows counts for **New**, **Updated**, **Skipped**, and **Unavailable**, plus skip reasons and institutions that could not provide transactions. It also reports how many rows the recurring detector flagged. The transaction list is refreshed after the import.

## Duplicate and retry summary

| Import path | Re-import behavior |
|---|---|
| Reviewed file upload | Inserts every reviewed row. No matching or duplicate check is performed; re-uploading may create duplicate rows. |
| Direct file-ingest API | Inserts valid rows immediately; no matching or duplicate check is performed. |
| Plaid date-range import | Matches on `(user_id, plaid_transaction_id)` and updates the existing row; overlapping imports of the same Plaid ID do not create duplicates. |
| File vs. Plaid | No cross-source matching is performed. A transaction present in both sources may appear twice. |

## Main code references

- `client/src/components/finance-tracker/transaction-file-import.tsx` — file selection, editable preview, and save request.
- `client/src/components/finance-tracker/transaction-file-import-validation.ts` — browser-side row validation.
- `client/src/components/finance-tracker/connected-accounts-import.tsx` — Plaid import choices and result display.
- `client/src/pages/finance-tracker.tsx` — import dialogs, success messages, and transaction-list refresh.
- `server/asset-liability-ingestion.ts` — CSV/TSV/TXT and spreadsheet parsing.
- `server/transaction-import.ts` — file-field normalization, server validation, and atomic reviewed-batch inserts.
- `server/finance-tracker-routes.ts` — preview, direct import, Plaid retrieval, category mapping, deduplication, and recurring detection.
- `server/ai/provider.ts` — shared model provider used for file-category classification.
- `shared/transaction-import.ts` — preview and result contracts.
- `shared/schema.ts` — transaction fields, constraints, and Plaid unique index.

## Related documentation

- [AI Lab: How Questions Become Responses](ai-lab-response-flow.md) — AI request boundaries and response handling.
- [Historical Budget Plans](historical-budget-plan.md) — how transaction data feeds historical budget actuals.
