import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;
let configPromise: Promise<SupabaseClient> | null = null;

// Cached token — updated by onAuthStateChange so queries never block on getSession()
let cachedToken: string | null = null;
let tokenReady = false;
let tokenReadyPromise: Promise<void> | null = null;
let tokenReadyResolve: (() => void) | null = null;

async function fetchConfig(): Promise<SupabaseClient> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to fetch Supabase config");
  const { supabaseUrl, supabaseAnonKey } = await res.json();

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  // Prime the cached token with a 3-second timeout so it never blocks the app
  tokenReadyPromise = new Promise<void>((resolve) => {
    tokenReadyResolve = resolve;
  });

  const timeout = setTimeout(() => {
    if (!tokenReady) {
      tokenReady = true;
      tokenReadyResolve?.();
    }
  }, 3000);

  // Subscribe to session changes — this fires immediately with current session
  supabaseInstance.auth.onAuthStateChange((_event: string, session: Session | null) => {
    cachedToken = session?.access_token ?? null;
    if (!tokenReady) {
      tokenReady = true;
      clearTimeout(timeout);
      tokenReadyResolve?.();
    }
  });

  // Also seed from existing session in localStorage (catches cases where
  // onAuthStateChange fires before this subscribe call)
  supabaseInstance.auth.getSession().then(({ data }) => {
    if (!tokenReady) {
      cachedToken = data.session?.access_token ?? null;
      tokenReady = true;
      clearTimeout(timeout);
      tokenReadyResolve?.();
    }
  }).catch(() => {
    if (!tokenReady) {
      tokenReady = true;
      clearTimeout(timeout);
      tokenReadyResolve?.();
    }
  });

  return supabaseInstance;
}

export function getSupabase(): Promise<SupabaseClient> {
  if (supabaseInstance) return Promise.resolve(supabaseInstance);
  if (!configPromise) {
    configPromise = fetchConfig().catch((err) => {
      configPromise = null; // allow retry on next call
      throw err;
    });
  }
  return configPromise;
}

export async function getAccessToken(): Promise<string | null> {
  // Kick off init if not started
  const initPromise = getSupabase();

  // If token is already ready, return immediately without waiting for getSession
  if (tokenReady) return cachedToken;

  // Wait for supabase to init AND for the initial session check (with timeout)
  await initPromise;
  if (tokenReadyPromise) await tokenReadyPromise;

  return cachedToken;
}

export function getCachedToken(): string | null {
  return cachedToken;
}

export function clearCachedToken(): void {
  cachedToken = null;
  tokenReady = true;
}
