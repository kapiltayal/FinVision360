# Financial Transaction Ingestion and Processing

*Implementation guide, updated October 9, 2026.*

This guide covers the two transaction sources exposed in the Finance Tracker: user-uploaded files and transactions imported on request from Plaid-connected accounts. It follows each path from the user's selection through parsing, quality checks, categorization, preview or confirmation, and database persistence.

## At a glance

```text
File upload
Choose file → validation → processing/categorization → duplicate check
→ editable review → final validation and duplicate recheck → atomic save → complete

Plaid
Choose institution/account and dates → server fetches Plaid pages
→ filters and categorizes each transaction → insert-or-update by Plaid ID
→ recurring detection → import summary
```

The key user-facing difference is that **file uploads are previewed and edited before saving**, while **Plaid rows are written immediately after the user clicks Import**. Files use source IDs when available and conservative content matching otherwise; Plaid retains its existing ID-based upsert behavior.

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
| Upload identity | Source transaction ID and account context, when supplied by the file; `upload_identity` is a hash of that account context plus source ID. |
| `notes`, timestamps | Optional notes and database-managed creation/update timestamps. |

The database constrains transaction type, Need/Want value, recurring type, and source. Amount is stored as `NUMERIC(12,2)`. Partial unique indexes protect `(user_id, plaid_transaction_id)` and `(user_id, upload_identity)` when those identities are present. Content-based similarities are deliberately not database uniqueness constraints: identical-looking charges can be legitimate.

## How transaction categorization works

Categorization produces a suggestion from the app's canonical categories, not a free-form label. The allowed values come from `transaction_type_list`, including each category's transaction type, parent category, display label, Need/Want default, and description. Before a category is saved, the server resolves it against that list and stores the database's canonical parent/category labels. A user can still correct the suggestion in the file review.

The import methods intentionally differ:

| Source | Categorization method | AI used? |
|---|---|---|
| Uploaded file | Saved user merchant preference → matching category supplied by the file → AI for unresolved rows → leave unresolved for review | Only for unresolved rows |
| Plaid | Plaid personal-finance category mapping → description rules as fallback → skip if no canonical category can be resolved | No |
| Manually entered transaction | Use the user's selected canonical category; if omitted, apply description rules | No |

### Uploaded-file categorization, step by step

1. **Establish the row's initial type and text.** The parser reads explicit type labels when present. Otherwise, a debit column implies expense and a credit column implies income; when it cannot infer either, it initially treats the row as an expense. Merchant defaults to the uploaded merchant or description.
2. **Look for a saved merchant preference.** The server checks this user's manual transactions and transactions with a recorded explicit parent/category edit. It matches by transaction type and a normalized merchant key derived from the merchant, or the description when merchant is absent. The normalization lowercases text, removes punctuation/asterisks, and uses the first three words. When multiple saved choices match, recorded category edits and the newest matching choices take precedence. A preference is reused only if it still maps to a valid canonical category.
3. **Try the uploaded category.** If the file has a `Category` or `Subcategory` value, it is matched against the canonical list for the row's current type. A supplied parent category further narrows that match. Matching ignores case and punctuation, but the value saved is the canonical database label. An unknown or type-incompatible source label remains visible in review; it is not silently stored as a category.
4. **Ask AI only for rows still unresolved.** The server sends the unresolved raw source rows and the allowed canonical category list—including each category's type, parent, label, Need/Want default, and description—to the configured, non-streaming JSON classification call. The prompt asks for a transaction type and one exact category from the supplied list, and says to classify only clear transactions. The system message requires JSON only, with no markdown or commentary. The provider currently uses the shared `ADVISOR_MODEL` setting (currently `gpt-5.6-luna`), JSON-object response mode, and a maximum of 1,800 completion tokens; the shared provider caps total request content at 28,000 characters.
5. **Validate the answer before using it.** Each returned `sourceIndex` must refer to a row sent in that call and may appear only once. The type must be `income` or `expense`, and the category must resolve to a canonical category for that type. Invalid, duplicate, missing, or unrecognized model results are ignored. The server applies only the validated type/category suggestion (and eligible canonical Need/Want default); it does not let AI replace the source date, amount, description, merchant, or server-created review-row identity.
6. **Keep uncertainty reviewable.** If AI is unavailable or returns no usable classification, the upload preview continues. The category stays blank in review and is optional at save; if the user saves it without a category, it is stored as `unassigned`. This fallback prevents a categorization outage from dropping an otherwise valid transaction.

The classifier receives the complete raw source row for unresolved entries, so any columns present in that row—including descriptions, amounts, notes, account metadata, or other exported fields—can be included in the request. It does not receive the signed-in user's database ID or a Plaid access token. Rows resolved from a saved preference or a valid uploaded category are not sent for AI classification. Treat files as financial data and avoid adding unrelated sensitive columns to an export when they are not needed.

When an uploaded row contains a valid Need/Want value, that value is preserved. Otherwise, the selected canonical category's Need/Want default is suggested when available; unresolved categories use `na` until the user changes it. The reviewer can edit both the category and Need/Want value before saving.

### Plaid categorization, step by step

Plaid imports do not call the AI classifier or use the saved merchant-preference map. After transfer, pending, currency, account, and amount checks, the server determines transaction type from Plaid's amount sign (negative is income, otherwise expense), then uses Plaid's `personal_finance_category`:

| Plaid category condition | FinVision360 category suggestion |
|---|---|
| Income detail contains `WAGES`, `DIVIDEND`, `INTEREST_EARNED`, or `TAX_REFUND`/`REFUND` | Salary, dividend, interest, or refund respectively |
| Income primary is `INCOME` and no more specific income detail matched | Description-rule match, or Other Income if the description rules find nothing |
| Expense primary is `RENT_AND_UTILITIES` | Housing for rent/mortgage details; otherwise utilities |
| Expense primary is `FOOD_AND_DRINK` | Groceries for grocery details; otherwise dining out |
| Expense primary is `ENTERTAINMENT`, `TRANSPORTATION`, `MEDICAL`, `PERSONAL_CARE`, `TRAVEL`, `GENERAL_MERCHANDISE`, `HOME_IMPROVEMENT`, `LOAN_PAYMENTS`, or `BANK_FEES` | Entertainment, transportation, healthcare, personal care, travel, shopping, housing, debt payment, or other expense respectively |
| Government/non-profit primary with a tax detail | Taxes |
| No listed mapping applies | Description-rule fallback |

The description fallback checks transaction text against ordered income and expense keyword/merchant rules. The first matching rule wins, so when a description contains terms from more than one row below, the earlier row takes precedence.

| Income rule, in order | Example terms in the description | Suggestion |
|---|---|---|
| 1 | Salary, payroll, direct deposit, wages, pay stub | Salary |
| 2 | Bonus | Bonus |
| 3 | Freelance, consulting, contract work, Upwork, Fiverr | Freelance |
| 4 | Dividend, distribution | Dividend |
| 5 | Interest, APY, savings yield | Interest |
| 6 | Rental income, rent received, tenant | Rental |
| 7 | Capital gain, stock sale, security sold | Capital gains |
| 8 | Refund, cash back, rebate | Refund |
| 9 | Business income, revenue, invoice | Business |
| 10 | Gift, Zelle, Venmo, Cash App, PayPal | Gift |
| No match | — | Unassigned (except Plaid's `INCOME` primary category, which falls back to Other Income) |

| Expense rule, in order | Example terms in the description | Suggestion |
|---|---|---|
| 1 | Mortgage, rent (unless “rent received”), HOA fee, property tax, homeowners, house | Housing |
| 2 | Electric, gas/water bill, internet/broadband, listed telecom or energy providers | Utilities |
| 3 | Grocery terms, supermarket, listed grocery stores | Groceries |
| 4 | Uber (exact match), Lyft, gas stations, parking, transit, auto loan/car payment | Transportation |
| 5 | Restaurants, delivery services, cafes and restaurant/food terms | Dining out |
| 6 | Streaming/music services, cinemas, concerts, ticket services, entertainment terms | Entertainment |
| 7 | Pharmacies, hospitals, clinics, doctors, dental, vision, healthcare/medical terms | Healthcare |
| 8 | Insurance or listed insurance providers | Insurance |
| 9 | Tuition, universities, colleges, course services, student loan, Khan Academy | Education |
| 10 | Retailers and marketplaces such as Amazon (not Amazon Web Services), Target, IKEA, or Home Depot | Shopping |
| 11 | Music/cloud/software services, gym memberships, Prime membership, subscription | Subscriptions |
| 12 | Salon, barber, spa, beauty supply, nail or hair-cut terms | Personal care |
| 13 | Airlines, hotels, travel-booking services, Airbnb, VRBO | Travel |
| 14 | Credit-card, card, loan or student-loan payment | Debt payment |
| 15 | Vanguard, Fidelity, Schwab, ETF/mutual-fund/stock purchase, Robinhood, Coinbase, AWS | Investment |
| 16 | IRS, income/state/property tax, tax payment/withholding | Taxes |
| 17 | Transfer to savings, savings deposit/transfer, high-yield savings | Savings transfer |
| No match | — | Unassigned |

These rules are deliberately deterministic, not a confidence-ranked model. Their order matters: for example, the housing rule appears before taxes and includes “property tax,” so a description matching that rule is categorized as housing. If no rule matches, the result is `unassigned`; for Plaid, a row without a resolvable canonical category is counted as invalid and skipped rather than inserted unclassified.

The internal rule labels are mapped to the current canonical category table before insertion. A category's canonical parent and Need/Want default are saved with it; if the category has no Need/Want default, the import uses `na`. On a later Plaid upsert, categorization is refreshed unless the transaction has been marked user-modified; in that case its existing category, parent category, and Need/Want values are preserved.

### Manual choices and future file imports

Manual transaction entry accepts a user-selected canonical category. If the user omits it, the server tries the same description-based deterministic rules and rejects the entry if it still cannot resolve a canonical category. A manual category choice, or an explicit category/parent edit recorded in transaction history, can become the saved merchant preference used by a later file import. This preference is scoped to the signed-in user and transaction type; Plaid categorization continues to follow Plaid's mapping rules.

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
- **Source identity:** `Transaction ID`, `Bank Transaction ID`, or `FITID` is recognized as a transaction identifier. A generic `ID`, row number, or `Reference` is not treated as reliable. Account context comes from `Account ID`, `Account Number`, `Account Name`, or `Account`; absent context uses the user's unqualified source-ID namespace. Temporary review row numbers are never financial duplicate keys.

The preview drafts receive temporary row numbers for editing. These numbers are not database transaction IDs.

## 4. Category suggestions are prepared

The categorization priority, AI request and validation, canonical Need/Want defaults, and unassigned fallback are described in [How transaction categorization works](#how-transaction-categorization-works). In brief, each row tries the user's saved merchant preference first, then a valid category supplied by the file, and then AI classification for unresolved rows. The suggestion is editable and no transaction is stored during preview.

## 5. Duplicate identification, after categorization

The server compares normalized, categorized drafts with earlier included rows in the file and existing transactions owned by the signed-in user. Other users' records are never candidates.

| Finding | Rule | Default and user action |
|---|---|---|
| Stable source ID | Same source transaction ID and normalized account context, even if date/amount/text changed | Excluded; cannot be kept or saved a second time |
| Exact-looking content | Same date, amount to the cent, type, and full normalized description | Excluded by default; explicitly **Keep anyway** only for a separate real transaction |
| Possible content match | Same amount/type and matching normalized merchant or description, on the same date or within two days | Excluded by default; inspect and explicitly keep a legitimate repeat |

Text comparison normalizes case and punctuation, not an aggressive fuzzy match. When both files provide different account contexts, they are not matched to one another. Missing account context does not prove that records belong to different accounts. Source IDs should be stable across exports; account identifiers help avoid ambiguity.
Different reliable IDs in the same account namespace identify separate transactions even when the dates, amounts and descriptions are identical.

Warnings explain the matching rule and identify a stored transaction or earlier review row. Checks never delete, merge, or alter existing transactions.

## 6. User reviews the preview

The browser receives the draft rows and displays an editable table. Nothing has been written to `transactions` yet. The user can:

- Edit date, description, merchant, amount, type, category, Need/Want, recurring status/type, and notes.
- See the original source category separately when it differs from the current category choice.
- Remove unwanted rows or add a new row.
- Discard the review and choose another file.
- Include/exclude rows and explicitly keep legitimate content-based repeats. Reliable-ID repeats remain locked out.

Completely blank rows are reported as excluded. Invalid nonblank rows remain in the table and show field-level errors. Only selected rows must pass validation to save; an excluded invalid row does not block the batch. Category is optional: the user can choose a canonical category or leave the transaction unassigned.

Editing a matching field resets its duplicate override and triggers a version-guarded recheck through `POST /api/transactions/import-reviewed/check`. This endpoint writes nothing. A failed recheck preserves the editable review and blocks saving until the check is retried.

## 7. Server validates the reviewed batch

When the user clicks **Save**, the browser posts all review rows and a UUID `requestId` to `POST /api/transactions/import-reviewed`. The server checks row shape/IDs and validates every selected row before opening a database connection:

- Batch must contain 1–500 entries.
- Date must be a real calendar date.
- Description is required.
- Amount must be positive, nonzero, have no more than two decimal places, and not exceed `$9,999,999,999.99`.
- Type must be `income` or `expense`.
- Any selected category must match a canonical category for the chosen type and parent; a parent cannot be supplied without a category.
- Need/Want must be `need`, `want`, or `na`.
- Recurring status must be boolean. A recurring row must have type `subscription` or `recurring_bill`; a non-recurring row must not have a recurring type.

If any selected row fails, the server returns field-specific validation errors (`422`). No rows are written; the review remains available. Source identities must be text of at most 256 characters. Each review row must have a unique integer ID. A category-list loading error also disables saving.

## 8. File rows are committed atomically

After selected rows validate, the server begins a PostgreSQL transaction and obtains a user-scoped advisory lock. It rechecks selected rows against the current ledger and one another. Stable-ID duplicates always fail; new content matches require explicit keep confirmation. A conflict returns `409 / DUPLICATES_CHANGED`, rolls back, and refreshes duplicate warnings without discarding edits.

Selected rows are inserted with `source='upload'`. Canonical category values are stored; a category-less row uses `subcategory='unassigned'` and no parent category. The database generates permanent row IDs and timestamps.

- If every insert succeeds, the server commits the batch.
- If any insert fails, it rolls back the entire batch; the user does not get a partially saved reviewed import.
- The original upload is not retained. Only the reviewed transaction fields are saved.
- The reviewed path does not run automatic recurring detection; it saves recurrence values selected in the review.

Successful saves write selected rows plus a durable receipt in `transaction_import_receipts` in the same transaction. The receipt records the signed-in user, request UUID, canonical payload hash, and result. Retrying an unchanged request returns the previous result instead of inserting again—even if the first response was lost after commit, or retries arrive concurrently. Reusing a committed UUID with changed data fails with `REQUEST_ID_REUSED`. Changed review payloads get new UUIDs; failed transactions leave no receipt.

Results report inserted, uncategorized, recurring-selected and excluded/skipped counts. Removed rows and completely blank rows are handled separately in review. The Finance Tracker displays the result and refreshes the transaction list.

## Event-driven progress and failures

The interface shows **Validate file → Process & categorize → Check duplicates → Review rows → Save selected → Complete**. Preview requests add `?progress=1` and receive newline-delimited JSON stage events, a preview, or an error. Categorization is a normal JSON model call; progress events are not model-token streaming. Non-streaming clients can still request the JSON preview.

Completed, active, upcoming and failed stages reflect actual work; there are no invented percentage timers. Finalization starts when submitting the save; completion follows a committed result/receipt. Parse, duplicate-check and save errors preserve the file or editable review as appropriate. Retry an uncertain save unchanged before assuming nothing was written.

### Retired immediate-save APIs

`POST /api/transactions/ingest` and legacy CSV/JSON `POST /api/transactions/bulk` now return `409 / REVIEW_REQUIRED` without writing. The single-transaction endpoint rejects `source='upload'`. File-import clients must use preview and reviewed save; manual and Plaid imports retain their existing behavior.

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
- Plaid personal-finance categories are mapped to canonical categories first. The detailed mapping and description-rule fallback are described in [How transaction categorization works](#how-transaction-categorization-works); this path does not call the AI classifier or file-import merchant preferences.
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
| Reviewed file upload | Checks file/ledger duplicates; source-ID duplicates blocked, content matches need explicit keep; unchanged retries return receipts. |
| Direct file-ingest / legacy bulk APIs | Refuse writes with `REVIEW_REQUIRED`; clients must use the reviewed workflow. |
| Plaid date-range import | Matches on `(user_id, plaid_transaction_id)` and updates the existing row; overlapping imports of the same Plaid ID do not create duplicates. |
| File uploaded after Plaid/manual entry | Compares against existing records across all sources using content rules; similar records require review. |
| Plaid imported after a file | Plaid remains ID-based and does not merge file rows. Import order can still matter; existing duplicates are not cleaned up. |

## Main code references

- `client/src/components/finance-tracker/transaction-file-import.tsx` — file selection, editable preview, and save request.
- `client/src/components/finance-tracker/transaction-file-import-validation.ts` — browser-side row validation.
- `client/src/components/finance-tracker/connected-accounts-import.tsx` — Plaid import choices and result display.
- `client/src/pages/finance-tracker.tsx` — import dialogs, success messages, and transaction-list refresh.
- `server/asset-liability-ingestion.ts` — CSV/TSV/TXT and spreadsheet parsing.
- `server/transaction-import.ts` — file-field normalization, server validation, and atomic reviewed-batch inserts.
- `shared/transaction-duplicates.ts` — conservative matching rules and duplicate explanations.
- `server/transaction-duplicates.ts` — owner-scoped checks, locking, receipts, and retry-safe finalization.
- `server/finance-tracker-routes.ts` — preview, direct import, Plaid retrieval, category mapping, deduplication, and recurring detection.
- `server/ai/provider.ts` — shared model provider used for file-category classification.
- `shared/transaction-import.ts` — preview and result contracts.
- `shared/schema.ts` — transaction fields, receipt table, and unique indexes.
- `server/transaction-import-schema.ts` — narrow, additive migration called by the existing application schema bootstrap before routes start. Both `npm run dev` and the published `dist/index.cjs` apply it; concurrent cold starts are serialized, failures stop startup, and no existing transaction data is changed.
- `scripts/transaction-import-schema.ts` — optional standalone runner for the same migration (`npx tsx scripts/transaction-import-schema.ts`); normal application/deployment startup does not depend on running it manually.

## Related documentation

- [AI Lab: How Questions Become Responses](ai-lab-response-flow.md) — AI request boundaries and response handling.
- [Historical Budget Plans](historical-budget-plan.md) — how transaction data feeds historical budget actuals.
