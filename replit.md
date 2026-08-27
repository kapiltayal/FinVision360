# FinVision360 - Personal Finance Tracker

## Overview
A comprehensive personal finance application that helps users track assets, liabilities, calculate net worth, plan for retirement, get AI-powered financial advice, and monitor real-time bank interest rates via a configurable web scraper.

## Architecture
- **Frontend**: React + TypeScript with Vite, TailwindCSS, shadcn/ui components
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM (Replit built-in)
- **AI**: Replit AI Integrations (managed OpenAI-compatible ModelFarm provider for AI Advisor features)
- **Auth**: Passport.js with local strategy, session-based with pg-session-store

## Key Features
- User authentication (register/login)
- Asset management (bank accounts, savings, investments, property, cash, retirement funds)
- Liability management (credit cards, mortgage, personal/student/auto loans)
- Net Worth dashboard with charts (net worth, asset allocation, liability breakdown, interest rates)
- Income & Expenses tracking with cash flow analysis
- Insurance & Annuities policy management
- Retirement planning with interactive projections (Retirement Planner + 401k Calculator)
- AI-powered financial advisor (scenario planning, debt reduction strategies, net worth forecasting)
- Estate & Legacy Planning (beneficiary designations per asset, document checklist, key contacts)
- Account settings (profile, password change)
- Dark mode support
- "Last updated" timestamps on all data-entry pages
- CSV / Excel / PDF export on all data pages (Net Worth, Assets, Liabilities, Income & Expenses, Insurance, Retirement Planner, 401k Calculator)

## Data Model
- `users` - User accounts with auth
- `assets` - Financial assets with categories, values, interest rates
- `liabilities` - Debts with categories, balances, interest rates, minimum payments
- `retirement_goals` - Retirement planning parameters per user
- `estate_beneficiaries` - Per-asset beneficiary designation records
- `estate_documents` - Estate planning document checklist (8 document types)
- `estate_contacts` - Key estate contacts (attorney, executor, advisor, etc.)

## Demo Account
- Username: `demo` / Password: `demo123`

## Project Structure
- `shared/schema.ts` - Database schema and types
- `server/routes.ts` - API routes (CRUD + AI endpoints)
- `server/auth.ts` - Authentication setup
- `server/storage.ts` - Database storage layer
- `server/seed.ts` - Demo data seeder
- `server/db.ts` - Database connection
- `client/src/pages/` - Page components (dashboard, assets, liabilities, retirement, ai-advisor, settings, auth)
- `client/src/components/` - Reusable components (app-header, theme-provider, export-menu)
- `client/src/hooks/` - Custom hooks (use-auth, use-toast)
- `client/src/lib/` - Utilities (queryClient, format helpers, export: CSV/Excel/PDF via xlsx + jspdf)

## Environment
- `DATABASE_URL` - PostgreSQL connection (auto-configured by Replit)
- `SESSION_SECRET` - Session encryption key (auto-configured by Replit)
- Replit injects native AI Integration configuration for the server at runtime; no separately managed AI key is required for AI Advisor.

## Running the App
- **Dev**: `npm run dev` (starts Express + Vite dev server on port 5000)
- **Build**: `npm run build` (builds frontend to dist/public)
- **Production**: `node dist/index.cjs`
- **DB Schema**: `npm run db:push`

## Bank Rate Monitor (Admin Only)
- Admin-only feature. Grant admin: `UPDATE users SET is_admin = true WHERE username = 'xxx'`
- Two scrape modes: `html` (CSS selectors + cheerio) and `json` (dot-notation JSON path extraction)
- Default configs: Ally Bank savings page (FDIC national average via HTML) + Bankrate HYSA comparison page (top market rates via HTML auto-detection)
- Manual rate entry available for banks whose sites block scraping (403) or use JavaScript-rendered rates
- Delete individual rate records from the history tab
- Scraper (`server/scraper.ts`) auto-detects APY% patterns as a fallback when selectors find nothing
- DB tables: `bank_configs` (scraper configs) and `bank_rates` (rate history)

## Notes
- The app runs on port 5000 (both API and frontend via Vite middleware in dev)
- AI Advisor uses the centralized Replit-native AI provider. Keep provider/model configuration in that server utility rather than adding model identifiers or client setup to routes or UI.
- Demo data is seeded automatically in development mode
- Most major bank websites (Ally, Marcus, Discover) use JavaScript-rendered rates that can't be scraped via static HTML — use manual entry for specific bank APYs
