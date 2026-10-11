# Database Tables, Keys, Columns, and Purpose

This is a code-based reference for the PostgreSQL tables used by FinVision360. It covers the Drizzle declarations in `shared/schema.ts` and `shared/models/chat.ts`, along with tables and indexes initialized directly by the server. Column names below are PostgreSQL names; `camelCase` application properties are shown in parentheses where useful.

> **Schema caveat:** this document describes the schema declared by the current application code, not a live introspection of a particular database. The running application connects to the PostgreSQL database in `DATABASE_URL`. Some tables/constraints are created or amended by startup SQL in `server/index.ts` and `server/transaction-import-schema.ts`; the live database can differ from Drizzle declarations if schema setup has not been applied. Verify changes against the app's actual database connection.

## Conventions and key types

- `SERIAL` is an auto-incrementing integer identifier. `PK` means primary key; `FK` means foreign key.
- `NUMERIC(p,s)` stores exact decimal values, commonly used for dollars and percentages. It is not a floating-point type.
- `JSONB` stores structured JSON data; its internal shape is defined by the feature code, not necessarily by PostgreSQL constraints.
- `TIMESTAMP` is timestamp without time zone; `TIMESTAMPTZ` is timestamp with time zone.
- Unless stated otherwise, a column is nullable when the table declaration does not mark it `NOT NULL`.
- The application generally scopes user-owned rows using `user_id` and the authenticated user's local `users.id`. PostgreSQL Row-Level Security policies are not declared in this repository; see [Database isolation](#database-isolation-and-relationships).

## Table inventory

### Users and core financial records

#### `users`
**Purpose:** Local application profile linked to a Supabase Auth identity; parent record for most user-owned finance data.

**Columns:** `id VARCHAR` (PK, generated UUID string); `full_name TEXT`; `email TEXT`; `is_admin BOOLEAN` (not null, default `false`); `supabase_id TEXT` (unique); `created_at TIMESTAMP` (not null, default current time); `date_of_birth DATE`; `street_address TEXT`; `city TEXT`; `state TEXT`; `postal_code TEXT`; `country TEXT` (default `"USA"`).

**Keys:** PK `id`; unique `supabase_id`. Other user-owned tables commonly reference `users.id` with `ON DELETE CASCADE`.

#### `assets`
**Purpose:** User-entered or imported assets used for net-worth and retirement calculations.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `name TEXT` (not null); `category TEXT` (not null); `value NUMERIC(15,2)` (not null); `interest_rate NUMERIC(5,2)` (default `0`); `institution TEXT`; `notes TEXT`; `created_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`).

#### `liabilities`
**Purpose:** User-entered or imported debts, balances, rates, and payment details.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `name TEXT` (not null); `category TEXT` (not null); `balance NUMERIC(15,2)` (not null); `interest_rate NUMERIC(5,2)` (default `0`); `minimum_payment NUMERIC(10,2)` (default `0`); `maturity_date DATE`; `institution TEXT`; `notes TEXT`; `created_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`).

#### `Asset_type_list`
**Purpose:** Shared list of asset type/category hierarchy and projection return assumptions.

**Columns:** `id SERIAL` (PK); `type TEXT` (not null); `parent_category TEXT` (not null); `category TEXT` (not null; application property `subCategory`); `description TEXT` (not null); `rate_of_return NUMERIC(10,8)` (not null); `rate_of_return_inflation_adjusted NUMERIC(10,8)` (not null).

**Keys:** Unique index `asset_type_list_hierarchy_unique` on `(parent_category, category)`.

#### `liabilities_type_list`
**Purpose:** Shared liability type/category hierarchy.

**Columns:** `id SERIAL` (PK); `type TEXT` (not null); `parent_category TEXT` (not null); `category TEXT` (not null; application property `subCategory`); `description TEXT` (not null).

**Keys:** Unique index `liabilities_type_list_hierarchy_unique` on `(parent_category, category)`.

#### `transaction_type_list`
**Purpose:** Shared transaction category hierarchy, including need/want defaults and descriptions.

**Columns:** `id SERIAL` (PK); `type TEXT` (not null; expected income/expense); `parent_category TEXT` (not null); `category TEXT` (not null); `need_vs_want TEXT`; `description TEXT` (not null).

**Keys:** Unique index `transaction_type_list_hierarchy_unique` on `(type, parent_category, category)`.

#### `transactions`
**Purpose:** User's manual, uploaded, imported, and Plaid-synced income/expense transactions.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `date DATE` (not null); `description TEXT` (not null); `merchant TEXT`; `amount NUMERIC(12,2)` (not null); `type TEXT` (not null); `parent_category TEXT`; `subcategory TEXT` (not null, default `"unassigned"`); `needs_want TEXT`; `is_user_modified BOOLEAN` (not null, default `false`); `is_recurring BOOLEAN` (default `false`); `recurring_type TEXT`; `source TEXT` (not null, default `"manual"`); `plaid_transaction_id TEXT`; `plaid_account_id TEXT`; `plaid_account_name TEXT`; `plaid_institution_name TEXT`; `upload_source_id TEXT`; `upload_source_account TEXT`; `upload_identity TEXT`; `notes TEXT`; `created_at TIMESTAMPTZ` (default current time); `updated_at TIMESTAMPTZ` (default current time).

**Keys and indexes:** PK `id`; indexes on `user_id`, `date`, and `type`; partial unique index `(user_id, plaid_transaction_id)` when the Plaid transaction ID is not null; partial unique index `(user_id, upload_identity)` when upload identity is not null. `user_id` is not declared as a foreign key in the shared schema or startup DDL.

**Checks:** `type` is `income` or `expense`; `needs_want` is `need`, `want`, or `na`; `recurring_type` is `subscription` or `recurring_bill`; `source` is `manual`, `plaid`, `upload`, or `import`.

#### `transaction_import_receipts`
**Purpose:** Idempotency receipts for reviewed transaction imports; records the result for a user's import request so a retry does not repeat inserts.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `request_id VARCHAR(36)` (not null); `payload_hash TEXT` (not null); `result JSONB` (not null); `created_at TIMESTAMPTZ` (not null, default current time).

**Keys:** Unique index `idx_transaction_import_receipt_unique` on `(user_id, request_id)`. `user_id` is not declared as a foreign key.

#### `transaction_change_history`
**Purpose:** Audit trail of transaction field changes, with the prior and new values.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `transaction_id INTEGER` (not null); `field TEXT` (not null); `old_value TEXT`; `new_value TEXT`; `created_at TIMESTAMPTZ` (not null, default current time).

**Keys:** Index `idx_transaction_change_history_transaction` on `transaction_id`. Neither `user_id` nor `transaction_id` is declared as a foreign key in the shared schema/startup DDL.

#### `ai_advisor_history`
**Purpose:** Saved AI Advisor question and response history for a user.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `query_type TEXT` (not null); `query_text TEXT` (not null); `response_text TEXT` (not null); `created_at TIMESTAMPTZ` (not null, default current time).

**Keys:** Index `idx_ai_advisor_history_user_date` on `(user_id, created_at)`. `user_id` is not declared as a foreign key.

**Checks:** `query_type` is `scenario`, `debt_strategy`, or `forecast`.

### Insurance and recommendations

#### `insurance_policies`
**Purpose:** User's auto, home, life, and annuity policy details.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `type TEXT` (not null); `name TEXT` (not null); `provider TEXT`; `policy_number TEXT`; `premium NUMERIC(10,2)`; `premium_frequency TEXT` (default `"monthly"`); `coverage_amount NUMERIC(15,2)`; `deductible NUMERIC(10,2)`; `renewal_date TEXT`; `vehicle_year INTEGER`; `vehicle_make TEXT`; `vehicle_model TEXT`; `property_address TEXT`; `life_type TEXT`; `death_benefit NUMERIC(15,2)`; `cash_value NUMERIC(15,2)`; `beneficiary TEXT`; `annuity_type TEXT`; `current_value NUMERIC(15,2)`; `monthly_payout NUMERIC(10,2)`; `interest_rate NUMERIC(5,2)`; `surrender_period INTEGER`; `notes TEXT`; `created_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`). Type-specific values are stored in nullable columns on this shared table.

#### `recommendation_settings`
**Purpose:** Per-user thresholds used for financial recommendations and the user's preferred AI Advisor name.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `interest_earning_threshold NUMERIC(15,2)`; `debt_interest_payment_reduction_threshold NUMERIC(15,2)`; `insurance_premium_savings_threshold NUMERIC(15,2)`; `ai_advisor_name TEXT` (not null, default `"Whizzy"`); `updated_at TIMESTAMP` (not null, default current time).

**Keys:** `user_id` is unique; FK `user_id → users.id` (`ON DELETE CASCADE`).

### Retirement planning

#### `retirement_401k_goals`
**Purpose:** One user's core 401(k) projection inputs.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `current_age INTEGER` (not null, default `35`); `current_balance NUMERIC(15,2)` (not null, default `25000`); `annual_salary NUMERIC(15,2)` (not null, default `80000`); `contribution_pct NUMERIC(5,2)` (not null, default `10`); `employer_match_pct NUMERIC(5,2)` (not null, default `4`); `employer_match_limit NUMERIC(5,2)` (not null, default `50`); `expected_return NUMERIC(5,2)` (not null, default `7`); `tax_bracket NUMERIC(5,2)` (not null, default `22`); `roth_tax_rate NUMERIC(5,2)` (not null, default `20`); `created_at TIMESTAMP` (not null, default current time).

**Keys:** `user_id` is unique; FK `user_id → users.id` (`ON DELETE CASCADE`).

#### `retirement_planner_settings`
**Purpose:** Per-user retirement age and life-expectancy assumptions.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `retirement_age INTEGER` (not null, default `65`); `life_expectancy INTEGER` (not null, default `85`); `updated_at TIMESTAMP` (not null, default current time).

**Keys:** `user_id` is unique; FK `user_id → users.id` (`ON DELETE CASCADE`).

#### `retirement_income_expense_settings`
**Purpose:** User-level expected monthly expense input for retirement-income/expense projections.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `expected_monthly_expenses NUMERIC(15,2)` (not null, default `0`); `updated_at TIMESTAMP` (not null, default current time).

**Keys:** `user_id` is unique; FK `user_id → users.id` (`ON DELETE CASCADE`).

**Checks:** Expected monthly expenses must be nonnegative.

#### `retirement_income_expense_entries`
**Purpose:** User-defined income or expense entries for a retirement projection.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `kind TEXT` (not null); `name TEXT` (not null); `amount NUMERIC(15,2)` (not null); `notes TEXT`; `created_at TIMESTAMP` (not null, default current time); `updated_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`); index `retirement_income_expense_entries_user_kind_idx` on `(user_id, kind)`.

**Checks:** `kind` is `income` or `expense`; `amount >= 0`.

#### `retirement_account_withdrawal_rates`
**Purpose:** Per-user withdrawal-rate and early-access overrides for a particular asset/account.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `asset_id INTEGER` (not null); `withdrawal_rate NUMERIC(5,2)` (not null, default `4`); `early_withdrawal_unlocked BOOLEAN` (not null, default `false`); `updated_at TIMESTAMP` (not null, default current time).

**Keys:** Unique index on `(user_id, asset_id)`; FKs `user_id → users.id` and `asset_id → assets.id`, both `ON DELETE CASCADE`.

**Checks:** `withdrawal_rate` is between `0` and `100`.

#### `retirement_asset_projection_overrides`
**Purpose:** User-specific assumed rate of return for a specific asset in retirement projections.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `asset_id INTEGER` (not null); `rate_of_return NUMERIC(6,3)` (not null); `updated_at TIMESTAMP` (not null, default current time).

**Keys:** Unique index on `(user_id, asset_id)`; FKs to `users.id` and `assets.id`, both `ON DELETE CASCADE`.

#### `retirement_projection_entries`
**Purpose:** Additional user-entered assets or liabilities included in retirement projections without being part of the primary assets/liabilities lists.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `kind TEXT` (not null); `name TEXT` (not null); `parent_category TEXT` (not null); `category TEXT` (not null); `amount NUMERIC(15,2)` (not null); `notes TEXT`; `created_at TIMESTAMP` (not null, default current time); `updated_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`); index `retirement_projection_entries_user_kind_idx` on `(user_id, kind)`.

**Checks:** `kind` is `asset` or `liability`; `amount >= 0`.

#### `retirement_pensions`
**Purpose:** User-entered pension benefit assumptions.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `name TEXT` (not null); `amount NUMERIC(15,2)` (not null); `frequency TEXT` (not null, default `"monthly"`); `start_age INTEGER` (not null, default `65`); `notes TEXT`; `created_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`).

#### `social_security_settings`
**Purpose:** User's Social Security benefit and life-age assumptions.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `fra_monthly_benefit NUMERIC(10,2)` (default `2000`); `expected_life_age INTEGER` (default `85`); `updated_at TIMESTAMP` (not null, default current time).

**Keys:** `user_id` is unique; FK `user_id → users.id` (`ON DELETE CASCADE`).

**Checks:** `fra_monthly_benefit >= 0`.

### Bank rates and Plaid connections

#### `bank_configs`
**Purpose:** Shared/admin-managed bank-rate scraper configuration.

**Columns:** `id SERIAL` (PK); `bank_name TEXT` (not null); `bank_url TEXT` (not null); `selectors_json TEXT` (not null); `notes TEXT`; `is_active BOOLEAN` (not null, default `true`); `created_at TIMESTAMP` (not null, default current time).

**Keys:** PK `id`; no user owner key.

#### `bank_rates`
**Purpose:** Scraped or manually entered bank product rates over time.

**Columns:** `id SERIAL` (PK); `config_id INTEGER` (not null); `bank_name TEXT` (not null); `bank_type TEXT` (not null, default `"Standard Bank"`); `rate_type TEXT` (not null); `rate_name TEXT` (not null); `rate_value TEXT` (not null); `scraped_at TIMESTAMP` (not null, default current time).

**Keys:** FK `config_id → bank_configs.id` (`ON DELETE CASCADE`).

#### `plaid_items`
**Purpose:** Plaid institution connections for a user, including the server-side access token and sync state.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `access_token TEXT` (not null; sensitive credential); `item_id TEXT` (not null, unique); `institution_id TEXT`; `institution_name TEXT`; `created_at TIMESTAMP` (not null, default current time); `last_synced TIMESTAMP`.

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`); unique `item_id`.

#### `plaid_accounts`
**Purpose:** Accounts returned for a Plaid item, with balances and optional links to a user's asset or liability.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `plaid_item_id INTEGER` (not null); `plaid_account_id TEXT` (not null, unique); `name TEXT` (not null); `official_name TEXT`; `type TEXT` (not null); `subtype TEXT`; `current_balance NUMERIC(15,2)`; `available_balance NUMERIC(15,2)`; `linked_asset_id INTEGER`; `linked_liability_id INTEGER`; `last_updated TIMESTAMP` (not null, default current time).

**Keys:** FKs `user_id → users.id` and `plaid_item_id → plaid_items.id` (`ON DELETE CASCADE`); unique `plaid_account_id`. The linked asset/liability IDs are not declared as foreign keys in the shared schema.

### Estate and legacy planning

#### `estate_beneficiaries`
**Purpose:** Per-asset beneficiary designation status and notes.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `asset_id INTEGER` (not null); `has_beneficiary BOOLEAN` (not null, default `false`); `beneficiary_name TEXT`; `notes TEXT`.

**Keys:** FKs to `users.id` and `assets.id`, both `ON DELETE CASCADE`. Startup SQL adds a unique constraint on `(user_id, asset_id)`.

#### `estate_beneficiary_entries`
**Purpose:** Individual beneficiary names and allocation percentages under a designation.

**Columns:** `id SERIAL` (PK); `designation_id INTEGER` (not null); `user_id VARCHAR` (not null); `asset_id INTEGER` (not null); `beneficiary_name TEXT` (not null); `allocation_percentage NUMERIC(5,2)` (not null); `notes TEXT`.

**Keys:** FKs `designation_id → estate_beneficiaries.id`, `user_id → users.id`, and `asset_id → assets.id`, all `ON DELETE CASCADE`; index on `designation_id`.

**Checks:** `allocation_percentage > 0` and `allocation_percentage <= 100`.

#### `estate_documents`
**Purpose:** Per-user checklist status and notes for estate documents.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `document_type TEXT` (not null); `is_complete BOOLEAN` (not null, default `false`); `notes TEXT`; `updated_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`). Startup SQL adds a unique constraint on `(user_id, document_type)`.

#### `estate_contacts`
**Purpose:** User's estate-planning contacts, such as an attorney, executor, trustee, advisor, or accountant.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `name TEXT` (not null); `role TEXT` (not null); `phone TEXT`; `email TEXT`; `firm TEXT`; `notes TEXT`.

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`).

### Feedback and audit/history snapshots

#### `feedback`
**Purpose:** Feedback submitted by an authenticated user.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `message TEXT` (not null); `created_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`).

#### `contactus`
**Purpose:** Public contact form submissions; these rows are not associated with an application user.

**Columns:** `id SERIAL` (PK); `name TEXT` (not null); `email TEXT` (not null); `subject TEXT` (not null); `message TEXT` (not null); `created_at TIMESTAMP` (not null, default current time).

#### `asset_history`
**Purpose:** Point-in-time copies of asset values and descriptive fields for net-worth history.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `asset_id INTEGER` (not null; source asset ID retained as a value); `name TEXT` (not null); `category TEXT` (not null); `value NUMERIC(15,2)` (not null); `interest_rate NUMERIC(5,2)` (default `0`); `institution TEXT`; `notes TEXT`; `snapshot_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`). `asset_id` is not declared as an FK so the snapshot can remain independent of later changes to the source record.

#### `liability_history`
**Purpose:** Point-in-time copies of liability balances and descriptive/payment fields for net-worth history.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `liability_id INTEGER` (not null; source liability ID retained as a value); `name TEXT` (not null); `category TEXT` (not null); `balance NUMERIC(15,2)` (not null); `interest_rate NUMERIC(5,2)` (default `0`); `minimum_payment NUMERIC(10,2)` (default `0`); `maturity_date DATE`; `institution TEXT`; `notes TEXT`; `snapshot_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`); `liability_id` is not a foreign key.

#### `user_goals`
**Purpose:** Current savings or financial goals entered by a user.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `title VARCHAR(200)` (not null); `category VARCHAR(50)` (not null, default `"custom"`); `target_amount NUMERIC(12,2)` (not null); `current_amount NUMERIC(12,2)` (not null, default `0`); `target_date DATE`; `notes TEXT`; `created_at TIMESTAMP` (not null, default current time); `updated_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`).

#### `user_goals_history`
**Purpose:** Point-in-time copies of goal values for monthly history, including the monthly savings requirement calculated at snapshot time.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `goal_id INTEGER` (not null; source goal ID retained as a value); `title VARCHAR(200)` (not null); `category VARCHAR(50)` (not null, default `"custom"`); `target_amount NUMERIC(12,2)` (not null); `current_amount NUMERIC(12,2)` (not null, default `0`); `target_date DATE`; `notes TEXT`; `created_at TIMESTAMP` (not null); `updated_at TIMESTAMP` (not null); `monthly_savings_needed NUMERIC(12,2)`; `snapshot_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`); index `user_goals_history_snapshot_at_idx` on `snapshot_at`. `goal_id` is not an FK so archived goals remain in history after deletion. A null `monthly_savings_needed` means the monthly requirement could not be calculated.

### Budget planning and close snapshots

#### `budget_plans`
**Purpose:** Editable per-user monthly plan line items. `plan_key` identifies the type/category or entity represented by each planned amount.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `month DATE` (not null; normalized to the plan month); `plan_key VARCHAR(250)` (not null); `planned_amount NUMERIC(12,2)` (not null, default `0`); `entity_metadata JSONB` (optional `{ name, category }` display metadata); `created_at TIMESTAMP` (not null, default current time); `updated_at TIMESTAMP` (not null, default current time).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`); unique index `budget_plans_user_month_key_unique` on `(user_id, month, plan_key)`.

**Checks:** `planned_amount >= 0`.

#### `budget_close_runs`
**Purpose:** Global run record for a monthly close/backup period. It records whether/how the close job ran, not one user's plan.

**Columns:** `period_month DATE` (PK); `snapshot_at TIMESTAMPTZ` (not null, default current time); `result JSONB` (not null; run status/details).

**Keys:** PK `period_month`; intentionally has no `user_id`.

#### `budget_month_closes`
**Purpose:** Per-user, per-period immutable close snapshot used to show historical monthly budget values and close-period debt/goal context.

**Columns:** `id SERIAL` (PK); `user_id VARCHAR` (not null); `period_month DATE` (not null); `snapshot_at TIMESTAMPTZ` (not null, default current time); `payload JSONB` (not null; saved line items and captured close data).

**Keys:** FK `user_id → users.id` (`ON DELETE CASCADE`); unique index `budget_month_closes_user_period_unique` on `(user_id, period_month)`.

### Chat integration

#### `conversations`
**Purpose:** Conversation metadata for the Replit chat integration.

**Columns:** `id SERIAL` (PK); `title TEXT` (not null); `created_at TIMESTAMP` (not null, default current time).

**Keys:** PK `id`; the schema does not define a user owner column.

#### `messages`
**Purpose:** Messages belonging to a chat integration conversation.

**Columns:** `id SERIAL` (PK); `conversation_id INTEGER` (not null); `role TEXT` (not null); `content TEXT` (not null); `created_at TIMESTAMP` (not null, default current time).

**Keys:** FK `conversation_id → conversations.id` (`ON DELETE CASCADE`). The schema does not define a user owner column.

## Key relationships and constraints at a glance

- **User ownership:** Most user-specific finance tables contain `user_id → users.id`. Deleting a user cascades to many associated rows.
- **Asset links:** Retirement withdrawal/return overrides reference both the owning user and an asset. Estate beneficiary records reference a user and asset; beneficiary entries reference the designation, user, and asset.
- **Plaid:** `plaid_accounts.plaid_item_id → plaid_items.id`; both tables include `user_id`. Plaid item/account identifiers have global unique constraints in the declared schema. Linked asset/liability IDs are application-managed associations, not foreign keys in the shared schema.
- **History:** Asset, liability, and goal history keep source IDs as values rather than foreign keys, allowing historical rows to survive source-record deletion.
- **Budget plan uniqueness:** A user has at most one plan row for a given `(month, plan_key)`.
- **Monthly close uniqueness:** A user has at most one `budget_month_closes` row per `period_month`; `budget_close_runs` is a global run ledger with one row per period.
- **Category hierarchy uniqueness:** Asset and liability category lists are unique by parent/category; transaction categories are unique by type/parent/category.
- **Transaction deduplication keys:** Plaid transactions use `(user_id, plaid_transaction_id)`; uploads use `(user_id, upload_identity)`. Both uniqueness rules are partial and only apply when the respective identity is non-null.

## Database isolation and data handling

The app uses a shared PostgreSQL database, not a separate database per user. Protected API routes validate a Supabase bearer token, map the Supabase identity to a local `users.id`, and are expected to scope user-owned SQL by that local ID. This is application-layer isolation: this repository does not declare PostgreSQL row-level-security policies. All new queries and mutations must derive the owner ID from the authenticated request, not from a client-supplied `user_id`.

Sensitive columns include `plaid_items.access_token`, profile/contact fields, insurance policy details, transaction descriptions, and financial balances. Do not log or expose them unnecessarily. The API logger currently records JSON responses; see `docs/README_ARCHITECTURE.md` for the request and security model.

## Schema implementation sources

- `shared/schema.ts` is the primary Drizzle table/type declaration.
- `shared/models/chat.ts` defines `conversations` and `messages`.
- `server/index.ts` creates or adjusts transactions, transaction history, AI history, estate planning tables, and supporting indexes/constraints during startup.
- `server/transaction-import-schema.ts` adds upload identity columns/indexes and creates import receipts before routes are registered.
- `server/db.ts` connects to PostgreSQL using `DATABASE_URL`.
- `drizzle.config.ts` points Drizzle Kit at `shared/schema.ts`; `npm run db:push` runs the schema push command.

Because the application and schema declarations include both Drizzle and startup SQL, compare both sources when changing a table. Verify the resulting schema using the same database connection used by the running application, and review any proposed destructive schema operation before applying it.
