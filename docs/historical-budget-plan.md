# Historical Budget Plans

*How closed months are saved, displayed, and updated.*

> **In short:** The plan is frozen for a historical month. Actuals are read from transactions each time that month is loaded, so editing a transaction can change historical actuals without changing the plan.

## The three main records

| Record | What it contains | Scope |
|---|---|---|
| `budget_plans` | Plan lines explicitly saved for a particular month. This includes values a user entered or copied into the plan. | One row per user, month, and plan key. |
| `budget_month_closes` | The closed-month plan plus the debt and goal details captured for that close. Plan lines are stored together in a JSON payload. | One row per user and month. |
| `budget_close_runs` | Whether the monthly backup job completed, with its capture time and result. It also prevents the same period from being closed twice. | One row per month for the entire database—not one row per user. |

`budget_month_closes` does **not** store transaction actuals. Actuals come from `transactions`.

## What happens during a scheduled monthly close

The monthly backup is intended to run on the **first UTC day of the next month**. It closes the previous calendar month.

1. The job takes a database lock and checks `budget_close_runs`. If that month already has a run record, it skips the backup rather than duplicating it.
2. It snapshots assets, debts, and goals into their history tables. Goal history includes the monthly amount needed as calculated at the time of the snapshot.
3. For each user, it builds a plan payload:
   - **Income and living expenses:** Start with category amounts derived from transactions in the preceding 12 complete calendar months. If less history is available, use the shorter available span. Debt-payment and savings-transfer transactions are kept out of living expenses.
   - **Saved plan lines:** Values in `budget_plans` override the transaction-derived amounts. A saved zero is still an intentional value.
   - **Debt payments:** Use the debt minimum-payment values at close time.
   - **Goal contributions:** Use the monthly-savings-needed values calculated from the goal data at close time.
4. It writes one `budget_month_closes` row per user for the month.
5. It removes history and close records older than 24 months, then writes one global `budget_close_runs` result.

These writes are part of one database transaction: either the full backup and success record commit, or none do. The 24-month cleanup does **not** delete `budget_plans` rows.

The close’s `snapshot_at` is the capture time. `period_month` identifies the month the plan is for; for example, an August close is normally captured on September 1 UTC.

## What the historical budget page loads

For a month before the current month, the page is read-only:

1. **Actuals are queried from transactions for the selected month.** They are grouped by transaction type and category. Editing or deleting a historical transaction changes actuals the next time the month is fetched; it does not change the saved plan.
2. **If a `budget_month_closes` row exists,** its plan, debt, and goal payload is used as the frozen record.
3. **If there is no close row,** the app tries a limited legacy reconstruction. It accepts only one matching debt-and-goal history timestamp on the first UTC day immediately after the budget month. It does not select a merely nearby snapshot.
4. **If no unique matching archive exists,** saved `budget_plans` amounts remain visible, but missing historical details and complete totals stay unavailable. The app does not fill gaps from today’s debts, goals, averages, or an assumed zero.

For an accepted legacy reconstruction, income and expense defaults are rebuilt from that period’s preceding transaction history, and any saved `budget_plans` values override those defaults. The result is identified as reconstructed and shows the archive capture time.

Historical income and living-expense rows do not show current trend, monthly-average, or copy values, since those would describe the present rather than the selected past period.

## Editing and persistence

- Historical budget plans cannot be changed through the page or its save/delete endpoints. Current and future months remain editable.
- Closing a month copies the saved plan values into `budget_month_closes`; it does **not** move, delete, or rewrite the original `budget_plans` rows.
- Transaction edits can change historical actuals, but not the frozen plan values.
- If a transaction edit happens while the budget page is already open, that view may need a reload or revisit to show the updated actuals. The page fetches fresh data when opened or when a different month is selected.

## Why the run table is global

`budget_close_runs` has one row per period for the whole database. A success row means the backup job completed for all accounts in that run—not just one user's close. Therefore, a user-specific historical backfill should not add a global success row unless the status for every account can be verified.

## Development-data note — October 8, 2026

The development database has reconstructed `budget_month_closes` for the demo account for **October 2025–June 2026 and August–September 2026**. Those 11 rows use unique matching legacy debt-and-goal archives. **July 2026 is not closed** because its expected August 1 archive is missing. The corresponding `budget_close_runs` records were not backfilled because that table is global and the other development account's historical state could not be verified.

Some older demo goal-history rows had previously been populated by copying current goal values into those historical timestamps. Treat those particular goal values as demo data, not independently verified historical goal states. The earliest reconstructed plan months also have fewer than 12 months of prior transaction history, so their defaults use the shorter available span.

## Code reference

- `server/monthly-backup.ts` — scheduled close, global run guard, and retention.
- `server/budget-history.ts` — close payload construction and legacy reconstruction.
- `server/finance-tracker-routes.ts` — historical month reads and read-only write protections.
- `shared/budget-period.ts` — budget month definitions and category normalization.
- `client/src/pages/budgeting-plan.tsx` — historical page behavior and refreshes.
