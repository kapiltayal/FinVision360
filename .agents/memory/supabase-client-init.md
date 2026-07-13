---
name: Supabase client initialization
description: How and why the Supabase client is initialized synchronously in the frontend
---

# Supabase Client Initialization

## The rule
Initialize `supabaseClient` as a **synchronous singleton** in `client/src/lib/supabase.ts` — hardcode the public anon key and URL directly, do NOT fetch them via `/api/config`.

## Why
The previous approach fetched `/api/config` to get credentials. During Vite HMR, module-level variables reset (`supabaseInstance = null`), triggering a new `fetchConfig()`. If the fetch caught an HTML response (Vite shell served before Express registered routes), `configPromise` was reset to null. The next call (e.g. user clicking "Register") would fail with "Unexpected token '<', <!DOCTYPE... is not valid JSON". Adding retry logic to `fetchConfig()` helped but introduced a different bug: multiple simultaneous `fetchConfig()` calls overwrote the shared `tokenReadyResolve` closure, causing `tokenReadyPromise` to never resolve, permanently blocking the loading skeleton.

## How to apply
- Dev credentials: URL=`https://xejzamzpvrcdmakfkulp.supabase.co`, anon key=`sb_publishable_UAUWx1cp75DIwFx7zPz2UQ_UE-cHKGa`
- Prod credentials: URL=`https://xctcvwqcqntwmupijckb.supabase.co`, anon key=`sb_publishable_55-QGIk1VcZuuueqN6TR-w_CuU1EKxv`
- Use `import.meta.env.MODE === "production"` to switch
- Anon keys are intentionally public — security is enforced by Supabase RLS and the server-side `authenticateSupabase` middleware using the service role key
- The `/api/config` server endpoint can be kept for reference but is no longer called by the frontend
