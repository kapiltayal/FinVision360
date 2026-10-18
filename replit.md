# FinVision360 - Personal Finance Tracker

## Overview
A comprehensive personal finance application that helps users track assets, liabilities, calculate net worth, plan for retirement, get AI-powered financial advice, and review administrator-maintained bank interest rates.

## Architecture
- **Frontend**: React 18 + TypeScript, Vite 7, Tailwind CSS 4 with its Vite plugin, Radix/shadcn UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM; the application's `DATABASE_URL` determines the active database
- **AI**: Replit AI Integrations (managed OpenAI-compatible ModelFarm provider for AI Advisor features)
- **Auth**: Supabase Auth; server validates bearer tokens and maps identities to local users. Legacy Passport/session packages are not the active authentication system.

## Key Features
- User authentication (register/login)
- Asset management (bank accounts, savings, investments, property, cash, retirement funds)
- Liability management (credit cards, mortgage, personal/student/auto loans)
- Net Worth dashboard with charts (net worth, asset allocation, liability breakdown, interest rates)
- Liability Map with a shared-scale Gantt timeline and pan/zoom 2D balance-sized bubbles
- Goals and Goals Allocation: many-to-many cash-account earmarking, not transfers
- Income & Expenses tracking with cash flow analysis
- Insurance & Annuities policy management
- Retirement planning with interactive projections, per-account/item inclusion checkboxes, and independent Net Worth/Income & Expense preferences
- AI-powered financial advisor (scenario planning, debt reduction strategies, net worth forecasting)
- Estate & Legacy Planning (beneficiary designations per asset, document checklist, key contacts)
- Account settings (profile, password change)
- Dark mode support
- Public Pricing and Blog share the marketing navigation; homepage has a looping three-slide carousel
- Feedback and Contact Us save first, then notify contactus@finvision360.com through a dedicated FinVision360 Resend account
- "Last updated" timestamps on all data-entry pages
- CSV / Excel / PDF export on all data pages (Net Worth, Assets, Liabilities, Income & Expenses, Insurance, Retirement Planner, 401k Calculator)

## Data Model
- `users` - User accounts with auth
- `assets` - Financial assets with categories, values, interest rates
- `liabilities` - Debts with categories, balances, interest rates, minimum payments
- `retirement_401k_goals`, `retirement_planner_settings` - Retirement planning parameters
- `transactions`, `merchants`, `transaction_type_list` - Ledger, canonical merchant profiles, and category dictionary
- `user_goals`, `goal_allocations`, `goal_funding` (view) - Legacy funding plus account allocations
- `budget_plans`, `budget_month_closes`, `budget_close_runs` - Saved monthly plans and historical closes
- `estate_beneficiaries` - Per-asset beneficiary designation records
- `estate_documents` - Estate planning document checklist (8 document types)
- `estate_contacts` - Key estate contacts (attorney, executor, advisor, etc.)

The complete schema reference is [Database schema](docs/Database_schema_tables.md). Missing account rates remain `NULL`; explicit zero means 0%, including historical snapshots.

## Authentication and development data
- Use Supabase sign-in. Do not rely on legacy local username/password examples.
- Development seed code is not a production account-provisioning mechanism.

## Project Structure
- `shared/schema.ts` - Database schema and types
- `server/routes.ts` - API routes (CRUD + AI endpoints)
- `server/auth.ts` - Authentication setup
- `server/storage.ts` - Database storage layer
- `server/seed.ts` - Development financial data/category seeder
- `server/db.ts` - Database connection
- `client/src/pages/` - Page components (dashboard, assets, liabilities, retirement, ai-advisor, settings, auth)
- `client/src/components/` - Reusable components (app-header, theme-provider, export-menu)
- `client/src/hooks/` - Custom hooks (use-auth, use-toast)
- `client/src/lib/` - Utilities (queryClient, format helpers, export: CSV/Excel/PDF via xlsx + jspdf)

## Environment
- `DATABASE_URL` - PostgreSQL connection (auto-configured by Replit)
- Supabase service-role configuration is server-only; public frontend anon configuration is selected in `client/src/lib/supabase.ts`
- `RESEND_API_KEY` - Server-only key from the separate FinVision360 Resend account
- Replit injects native AI Integration configuration for the server at runtime; no separately managed AI key is required for AI Advisor.

## Running the App
- **Dev**: `npm run dev` (starts Express + Vite dev server on port 5000)
- **Build**: `npm run build` (builds frontend to dist/public)
- **Production**: `node dist/index.cjs`
- **DB Schema**: `npm run db:push` only after verifying the target and reviewing drift/destructive prompts. Feature-specific additive startup migrations also exist.
- **Tests and documentation**: [Documentation index](docs/README.md)

## Bank Rate Monitor (Admin Only)
- Admin-only feature, guarded by `requireAdmin` and the local user's `is_admin` flag. Do not use legacy `username` SQL examples; that column is not in the current user schema.
- Bank rates are maintained manually. Do not fetch bank websites, scrape rates, or add automatic rate-refresh jobs.
- Admins can add, edit, delete, or upload rates from files using the Bank Rates page.
- DB tables: `bank_configs` (institution grouping) and `bank_rates` (rate history).
- Legacy `bank_url`, `selectors_json`, and `scraped_at` column names are retained for compatibility and existing data. New manual institutions use an empty URL and empty selectors; the UI labels the timestamp "Recorded At".

## Notes
- The app runs on port 5000 (both API and frontend via Vite middleware in dev)
- AI Advisor uses the centralized Replit-native AI provider. Keep provider/model configuration in that server utility rather than adding model identifiers or client setup to routes or UI.
- Demo data is seeded automatically in development mode
