# FinVision360 Architecture

This document describes the application as it is implemented in this repository. It is intended to help developers trace a request, locate the relevant code, and understand the current authentication and data-isolation model.

Reviewed against repository code: **2026-10-18**. [Documentation index](README.md).

## 1. Technology stack

| Area | Technology | How it is used |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite | The browser application is built from `client/`; Vite serves it in development and produces static assets for production. |
| Client routing | Wouter | `client/src/App.tsx` maps browser paths to React page components without full document navigations. |
| UI and styling | Tailwind CSS 4, Radix UI, shared UI components | Tailwind's Vite plugin compiles styles; `client/src/index.css` explicitly loads the legacy theme configuration and compatibility defaults. |
| API server | Express 5, TypeScript, Node.js | `server/index.ts` creates the HTTP server, registers API routes, and serves the frontend. |
| Database | PostgreSQL, `pg`, Drizzle ORM | The server connects using `DATABASE_URL`; `server/db.ts` creates a `pg` pool and a Drizzle client. The Replit environment provisions PostgreSQL for this app. |
| Schema and types | Drizzle schema plus shared TypeScript/Zod definitions | `shared/schema.ts` declares most database tables and related types. It is also used by Drizzle and parts of the client/server. |
| Authentication | Supabase Auth | Supabase manages user sign-in and sessions. The frontend obtains an access token; protected API routes validate it on the server. |
| Data fetching | TanStack Query and `fetch` | `client/src/lib/queryClient.ts` centralizes API requests and adds the current Supabase access token when available. |
| Financial institution data | Plaid | Plaid API client configuration and related API routes support account linking and transaction import. |
| Charts | Recharts and custom SVG/HTML | Most financial charts use Recharts. Liability Map uses a custom Gantt timeline and SVG bubble plot, not a generic chart template. |
| Homepage carousel | Embla Carousel | Three mounted slides, horizontal looping transition, six-second autoplay, centered dots; pauses on hover/focus and respects reduced motion. |
| Notifications | Resend HTTP API | Feedback/contact are saved before notification; a project-specific server key keeps FinVision360 separate from FinQuest360. |

### PostgreSQL connection and schema management

The application reads `DATABASE_URL` in `server/db.ts` and passes it to the Node `pg` connection pool. Database access is therefore provider-agnostic at runtime: the app connects to whichever PostgreSQL database that variable points to in the active environment. Replit configures PostgreSQL for this project; use the app's `DATABASE_URL` connection as the source of truth when checking which database the running app uses.

Drizzle's schema source is `shared/schema.ts`, configured in `drizzle.config.ts`. The `db:push` package script invokes Drizzle Kit. Some additive application tables and compatibility changes are also initialized during startup in `server/index.ts` and specialized schema helpers. Review those paths before changing the schema; do not assume that publishing alone applies arbitrary database changes.

## 2. File and directory map

### Root

| Path | Purpose |
| --- | --- |
| `package.json` | Lists runtime/development dependencies and the dev, build, production, database, and test commands. |
| `package-lock.json` | Locks the npm dependency graph for repeatable installs. |
| `docs/FinVision360_Architecture.md`, `docs/README.md` | This architecture overview and the documentation index. |
| `replit.md` | Project context and operating constraints; verify implementation when changing behavior. |
| `.replit` | Replit environment, workflow, port, development/production frontend configuration, and deployment settings. |
| `vite.config.ts` | Vite plugins, client root, module aliases, and frontend build settings. |
| `drizzle.config.ts` | Drizzle Kit configuration, PostgreSQL dialect, schema source, and migration output location. |
| `tailwind.config.ts`, `vite.config.ts`, `client/src/index.css`, `components.json` | Theme configuration, Tailwind 4 Vite integration/compatibility styles, and UI component generator configuration. |
| `blog_articles.json` | Static article content consumed by the blog pages. |
| `client/` | Browser application source and public static files. |
| `server/` | Express server, authentication middleware, API routes, data access, and domain services. |
| `shared/` | Database schema, shared domain types, validators, and logic used on both client and server. |
| `docs/` | Feature-specific engineering documentation, including AI response flow, transaction ingestion, historical budget planning, and this architecture guide. |
| `scripts/`, `script/` | Maintenance, setup, and development/test scripts. |
| `attached_assets/` | Project images and other imported assets referenced by the application. |
| `artifacts/` | Workspace artifacts and isolated mockup-sandbox content; not part of the core API implementation. |
| `dist/` | Generated production build output. Do not edit generated files as the source of application behavior. |

### Frontend: `client/`

| Path | Purpose |
| --- | --- |
| `client/src/main.tsx` | Browser entry point: mounts the React `App` into the root HTML element and loads global styles. |
| `client/src/App.tsx` | Sets up providers and top-level route selection. It separates public pages from the authenticated app shell and selects the page component for each URL. |
| `client/src/pages/` | Page-level screens, including snapshot/net worth, income and expenses, transactions, retirement, goals, AI Advisor, settings, authentication, and public pages. |
| `client/src/components/` | Shared application components such as the authenticated header/footer, public-page layout, import review flows, and feature widgets. |
| `client/src/components/ui/` | Reusable low-level UI controls, including buttons, forms, menus, tables, and dialogs. |
| `client/src/hooks/` | React hooks, including `use-auth.ts` for the client auth state and `use-seo.ts` for page metadata. |
| `client/src/lib/` | Client-side API/query setup, Supabase client/session helpers, formatting, validation, and domain utilities. |
| `client/src/index.css` | Global styles and theme variables. |
| `client/public/` | Static files copied or served with the frontend. |
| `client/replit_integrations/` | Replit-provided client integration code used by the app. |

### Backend: `server/`

| Path | Purpose |
| --- | --- |
| `server/index.ts` | Express application entry point. Installs body parsing and request logging, performs startup schema setup, registers routes, installs error handling, serves Vite/static content, and listens on the configured port. |
| `server/routes.ts` | Main API route registration for assets, liabilities, retirement, AI Advisor, Plaid, estate planning, feedback, goals, and related features. |
| `server/finance-tracker-routes.ts` | Transaction, transaction-import, and budgeting-plan API routes, including associated SQL operations. |
| `server/auth.ts` | Creates the Supabase admin client; exposes auth setup, token authentication, `requireAuth`, and `requireAdmin`; provisions and updates local user records. |
| `server/db.ts` | Creates the shared PostgreSQL `pg` pool and Drizzle database client. |
| `server/storage.ts` | `DatabaseStorage` data-access layer for user profiles, assets, liabilities, settings, Plaid records, estate planning, and goals. |
| `server/types.d.ts` | Express request type augmentation for authenticated user data. |
| `server/static.ts`, `server/vite.ts` | Production static-file serving and development Vite middleware/SPA fallback behavior. |
| `server/transaction-import.ts`, `server/transaction-import-schema.ts`, `server/transaction-duplicates.ts` | Transaction import processing, import receipt/schema support, and duplicate matching helpers. |
| `server/asset-liability-ingestion.ts` | File parsing, validation, classification, and preview logic for asset/liability ingestion. |
| `server/monthly-backup.ts`, `server/budget-history.ts`, `server/goal-history.ts` | Monthly backup orchestration and historical budget/goal data logic. |
| `server/plaid.ts` | Plaid API client construction and configuration. |
| `server/ai/provider.ts` | AI Advisor provider interface and request/response streaming behavior. |
| `server/retirement-projection.ts`, `server/retirement-income-expense-projection.ts` | Retirement projection calculations. |
| `server/goal-allocation.ts` | Ownership-checked allocation writes, funding view, serialized budget-safe earmarking. |
| `server/retirement-account-inclusion.ts`, `server/retirement-item-inclusion.ts` | Independent inclusion preferences for physical accounts and custom/built-in retirement items. |
| `server/feedback.ts`, `server/contact.ts`, `server/feedback-email.ts` | Save-first submissions, validation, and separate-account email transport. |
| `server/api-logging.ts` | Route-template/status/duration logs and redacted error summaries. |
| `server/seed.ts`, `server/seed-data/` | Development seed data and category/type lists. |
| `server/replit_integrations/` | Server-side Replit integrations, including chat storage. |
| `server/*.test.ts` | Server-side test files for imports, duplicate detection, backup/history, and related behavior. |

### Shared code: `shared/`

| Path | Purpose |
| --- | --- |
| `shared/schema.ts` | Drizzle PostgreSQL table definitions, inferred TypeScript types, and validation schemas for most application data. |
| `shared/models/chat.ts` | Drizzle model definitions for chat integration tables. |
| `shared/budget-period.ts`, `shared/goal-monthly-savings.ts` | Shared date-period and goal contribution calculations. |
| `shared/transaction-import.ts`, `shared/transaction-duplicates.ts` | Shared transaction import contracts and duplicate logic. |
| `shared/profile-options.ts` | Shared profile option values such as country/state selections. |

## 3. Request lifecycle and routing

### Browser page request

1. A browser requests the app's origin, for example `/snapshot` or `/privacy`.
2. The request reaches the Express server created in `server/index.ts`.
3. Express installs JSON parsing (5 MB limit, with the raw body retained), URL-encoded form parsing, and an API request logger.
4. `registerRoutes()` registers API endpoints and starts the route setup in `server/routes.ts` and `server/finance-tracker-routes.ts`.
5. In development, `server/vite.ts` attaches Vite middleware and a frontend fallback after the API routes. In production, `server/static.ts` serves `dist/public` and returns the SPA entry document for frontend paths.
6. The browser loads `client/src/main.tsx`, which mounts `App`.
7. `client/src/App.tsx` uses Wouter to select a React page based on the current URL. It does not perform a separate full HTML-page load for each app route.

The top-level route behavior is:

- `/about`, `/privacy`, `/terms`, `/faq`, `/contact`, `/pricing`, `/blog`, `/blog/:slug`, and `/reset-password` are handled as public routes.
- Other routes are rendered inside the authenticated application shell when `useAuth()` resolves to a user.
- When there is no authenticated user, unmatched application paths fall back to the public landing page.
- In the authenticated shell, Wouter routes paths such as `/snapshot`, `/`, `/assets`, `/liabilities`, `/finance-tracker`, `/income-expenses`, `/retirement`, `/goals`, and `/ai-advisor` to their page components. Several URL aliases intentionally share a page component.

### API request

1. A page or hook makes a request through `apiRequest()` or TanStack Query in `client/src/lib/queryClient.ts`.
2. The client retrieves the current Supabase access token using the Supabase helper and, when available, adds `Authorization: Bearer <token>`.
3. The request reaches the Express API route. Route handlers are registered in `server/routes.ts` or `server/finance-tracker-routes.ts`.
4. Protected routes include `requireAuth`. That middleware calls Supabase Auth's `getUser(token)` using the server-side Supabase admin client. Invalid or expired tokens receive HTTP 401. A valid Supabase identity is mapped to a local row in `users` by `supabase_id`; if needed, the local row and default settings are created.
5. The local user is attached to `req.user`. The route uses `req.user.id` as the application database `user_id` for data operations.
6. Route errors flow to the Express error handler in `server/index.ts`, which returns a JSON error response unless headers have already been sent.

`useAuth()` queries `/api/auth/user` to get the current application user. The Supabase session listener in `useSupabaseSession()` responds to sign-in/sign-out changes and refreshes or clears the query cache.

### Middleware currently active

Global Express middleware installed in `server/index.ts`:

- `express.json()` with a 5 MB body limit and raw-body capture.
- `express.urlencoded({ extended: false })`.
- An API logger recording method, matched route template, status, and duration only. It does not log request/response bodies, query strings, concrete route IDs, tokens, or financial values. Error summaries retain safe type/code rather than private provider responses.
- A final error handler for JSON API errors and oversized upload requests.
- Development Vite middleware or production static-file middleware, installed after API routes.

Authentication is **not** installed globally for every request. API protection is route-specific: handlers opt into `requireAuth` or `requireAdmin`. `authenticateSupabase` is also used directly where a route needs authenticated identity. Public endpoints such as contact submission and public content routes are intentionally not behind `requireAuth`.

Route-specific middleware also includes Multer for multipart file uploads (in-memory buffering with route-defined size/count limits) and authentication middleware on protected API endpoints.

The current request setup does not install Passport sessions, a global `express-session` middleware, or a global database row-security context. Dependencies from an earlier auth design may remain in the package list; the active auth implementation is Supabase bearer-token validation in `server/auth.ts`.

**Logging note:** the current API logger captures JSON response bodies. Since some API responses contain personal or financial data, avoid adding sensitive fields to responses and consider changing this logger to record metadata only or to redact sensitive payloads.

## 4. Database access and user-data isolation

### Where SQL and database operations live

| File or group | Database responsibility |
| --- | --- |
| `server/db.ts` | Shared `pg` pool and Drizzle connection initialized from `DATABASE_URL`. |
| `shared/schema.ts`, `shared/models/chat.ts` | Declarative Drizzle table definitions and database-related types. These define structure; they do not themselves execute application queries. |
| `server/storage.ts` | Reusable Drizzle and parameterized SQL operations behind `DatabaseStorage`. |
| `server/routes.ts` | Feature API handlers; some use `storage`, while others run Drizzle or parameterized SQL directly. |
| `server/finance-tracker-routes.ts` | Direct SQL and Drizzle operations for transactions, imports, and budget plans. |
| `server/replit_integrations/chat/storage.ts` | Storage operations for the chat integration. |
| `server/index.ts` | Startup-time table/index/compatibility setup and transaction-import schema initialization. |
| `server/seed.ts` and `scripts/` | Development or maintenance inserts and schema/seed helper operations. |

Use parameterized SQL values rather than concatenating user-controlled input into SQL. When adding a user-owned query, apply the authenticated local user ID in the read/update/delete predicate, not only in the request body.

### Current tenant separation model

The application uses a shared PostgreSQL database. It does **not** create a separate database or schema per customer. Most user-owned tables carry a `user_id` column that associates each record with the local `users.id`; many Drizzle table definitions also declare a foreign key to `users.id`. The `users` table maps that local ID to a unique Supabase user ID in `supabase_id`.

For a protected request, the intended isolation path is:

1. `requireAuth` validates the Supabase bearer token on the server.
2. The verified Supabase ID resolves to a local user row.
3. The handler takes `req.user.id` as the trusted owner ID.
4. Data queries filter by `user_id = req.user.id`; item-specific mutations commonly filter by both the record ID and owner ID.

For example, asset queries use both `id` and `userId` for single-record operations in `server/storage.ts`; transaction and budget queries in `server/finance-tracker-routes.ts` bind the authenticated user ID as a SQL parameter. Client-supplied user IDs should not be used as the authority for these operations.

Some tables contain shared/reference data (for example, category/type lists or manually maintained bank-rate institutions), and administrator-only routes use `requireAdmin` instead of per-user ownership. Public contact-submission operations are also not user-owned records. Bank rates are entered, edited, or uploaded by admins; there is no web scraper or automatic bank-rate retrieval.

### Important security boundary: no database RLS found

The repository does not define PostgreSQL Row-Level Security policies (`ENABLE ROW LEVEL SECURITY` / `CREATE POLICY`) for the application tables. The effective user-data boundary is therefore currently enforced in the Express API and its database predicates, not independently by PostgreSQL.

This distinction matters: a missing `user_id` filter in a protected route could expose or modify another user's row because the server's database connection has broader table access than an individual user. Keep authentication and ownership checks in every user-owned API route, and consider adding database-level RLS as a separate defense-in-depth project only after designing and testing how the server connection sets the authenticated database identity.

## 5. Running and checking the application

- Development: `npm run dev` starts Express and Vite on the configured port.
- Production build: `npm run build` builds the frontend into `dist/public` and bundles the server.
- Production server: `npm start` runs the built server bundle.
- Type check: `npm run check`.
- Drizzle schema push: `npm run db:push`; verify the target database and review any proposed destructive changes before applying.

The app requires `DATABASE_URL` and Supabase service-role secrets on the server. The frontend creates a Supabase client in `client/src/lib/supabase.ts` using the selected development/production URL and public anon key; the service-role key remains server-side. Public anon keys are not credentials, but database access must still be protected by server authorization and any applicable Supabase policies. Never put database passwords, service-role keys, or other private credentials in this document or client code.

## 6. Current feature boundaries

- [Transaction ingestion](Transaction_ingestion_%26_processing.md): reviewed file batches with atomic writes/receipts; explicit Plaid imports; manual entry; merchant categories reference `transaction_type_list.id`. Recurrence detection is monthly and has no Transactions-page button.
- [Goal Allocation](Goal_Allocation.md): combined legacy and allocated funding affects unsaved goal savings suggestions, not cash flow or already saved budgets.
- [Retirement Planner](Retirement_Planner.md): projection-only exclusions; no changes to account balances or other pages.
- [Liability Map](Liability_Map.md): identical debt calculations across Gantt and bubble views; missing rates are unknown, not 0%.
- [Pricing](Pricing_page.md): marketing packaging, not billing or enforced plan limits.
- [Notifications](Resend_feedback_notifications.md): database success does not guarantee email delivery; there is no durable retry queue.
- Bank rates are manual/admin maintained. The bank-rate scraper and scraper-only dependencies have been removed; no Firecrawl integration is used for bank rates.
- [Public pages](Public_Pages.md): consistent marketing navigation and replaceable carousel slide sources.

Focused commands include `npm run test:budget`, `npm run test:goal-allocation`,
`npm run test:retirement`, `npm run test:liability-map`, and
`npm run test:spreadsheet-security`. See the security review for dated audit
evidence; those results are not a claim that a new audit was run whenever docs change.
