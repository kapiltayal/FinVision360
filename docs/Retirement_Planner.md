# Retirement Planner account inclusion

Reviewed against repository code: **2026-10-18**. [Documentation index](README.md).

## Controls

The Retirement Planner supports independent account/item selections for **Net Worth** and **Income & Expense**. Checkboxes sit beside the existing rows, including user-added custom rows; there is no separate large account-selector section.

- Physical assets and liabilities can be included or excluded independently for each projection.
- Custom Net Worth assets/debts, custom income/expense entries, pensions, Social Security and the expected-expense baseline are selectable.
- The notice above a projection lists the count and names of excluded accounts/items.
- Its small Reset action re-includes all physical and custom/built-in items for that projection only.
- An excluded row stays visible and editable with zero calculation contribution. Editing uses the saved/configured amount, not the zero display contribution.
- Inclusion does not override eligibility rules: an ordinary non-income asset or a loan already paid off before retirement does not suddenly generate retirement cash flow.

## Persistence and boundaries

`retirement_account_projection_preferences` stores separate physical-account flags. `retirement_projection_item_preferences` handles custom/built-in items; absent preferences mean included. Polymorphic custom-item references are ownership-checked, and deleted custom entries/pensions have preferences cleaned up.

`POST /api/retirement/account-inclusion/reset` accepts `{ "projection": "net-worth" }` or `{ "projection": "income-expense" }` and atomically resets only that user's selected projection.

These are projection preferences, not account deletion or global exclusion. They do not change balances, transactions, budget plans, goal allocations, historical snapshots, or the AI Advisor's independently assembled context.

## Rates and access assumptions

Missing live asset returns or debt APRs remain unknown, while explicit 0% is a real zero rate. Retirement models can use documented category-return fallback assumptions and projection-specific overrides; do not write those assumptions back as actual account rates.

Net Worth and Income/Expense use their own projection services. Early access to pretax retirement accounts follows account/category inference and the persisted early-withdrawal override; excluding an account is distinct from unlocking it.

## Implementation and verification

- `client/src/pages/retirement-planner.tsx`: projection tables, checkboxes and notices.
- `server/retirement-account-inclusion.ts`, `server/retirement-item-inclusion.ts`: additive preferences and ownership checks.
- `server/retirement-inclusion-display.ts`: retained rows and configured-value display.
- `server/retirement-projection.ts`, `server/retirement-income-expense-projection.ts`: calculations and contributions.
- `npm run test:retirement`: projection/inclusion regression command.

See [Database schema](Database_schema_tables.md) for preference constraints and [AI Lab](AI_Lab.md) for its separate context policy.
