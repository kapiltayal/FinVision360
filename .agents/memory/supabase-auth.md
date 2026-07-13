---
name: Supabase Auth Migration
description: How auth works after migrating from Passport.js session auth to Supabase JWT auth.
---

## Architecture

**Backend:**
- `server/auth.ts` — Supabase Admin client (`supabaseAdmin`) + `authenticateSupabase` middleware + `requireAuth` / `requireAdmin` helpers. No passport, no sessions.
- Middleware extracts `Authorization: Bearer <token>`, calls `supabaseAdmin.auth.getUser(token)`, looks up or auto-creates local user by `supabase_id`.
- `/api/config` endpoint returns `supabaseUrl` + `supabaseAnonKey` to frontend (avoids VITE_ env var complexity).
- `server/types.d.ts` — global Express `Request` type augmentation adding `user?: User`.

**Frontend:**
- `client/src/lib/supabase.ts` — lazy singleton Supabase client initialized from `/api/config` response.
- `client/src/lib/queryClient.ts` — all requests attach `Authorization: Bearer <token>` from `getAccessToken()`.
- `client/src/hooks/use-auth.ts` — exports `useAuth`, `useLogin`, `useRegister`, `useLogout`, `useChangePassword`, `useSupabaseSession`.

**Schema:**
- `users.supabase_id` — nullable TEXT UNIQUE column added to `users` table.
- `users.password` — made nullable (Supabase manages passwords).

## Env vars / secrets
- Dev: `SUPABASE_SERVICE_ROLE_KEY_DEV` secret + hardcoded dev URL in `server/auth.ts`.
- Prod: `SUPABASE_SERVICE_ROLE_KEY_PROD` secret + hardcoded prod URL in `server/auth.ts`.
- Env selection via `process.env.NODE_ENV === "production"`.

## Key decisions
- New users auto-get a local username from `email_prefix + random suffix` (email prefix is required as `username NOT NULL`).
- Demo account (`demo`/`demo123`) is retired — users must register via Supabase.
- Password reset: frontend calls `sb.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`. `/reset-password` page calls `sb.auth.updateUser({ password })`.
- Password change in Settings: uses `useChangePassword` which calls `sb.auth.updateUser({ password })` directly.

**Why:** Supabase handles token rotation, password hashing, email verification, and OAuth — avoids maintaining custom session tables and scrypt password logic.
