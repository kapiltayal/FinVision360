import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

// Public anon keys — safe to include in client code.
// The secret (service role) keys never leave the server.
const SUPABASE_URL =
  import.meta.env.MODE === "production"
    ? "https://xctcvwqcqntwmupijckb.supabase.co"
    : "https://xejzamzpvrcdmakfkulp.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.MODE === "production"
    ? "sb_publishable_55-QGIk1VcZuuueqN6TR-w_CuU1EKxv"
    : "sb_publishable_UAUWx1cp75DIwFx7zPz2UQ_UE-cHKGa";

// Singleton created synchronously — no fetch, no HMR race conditions
export const supabaseClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

let cachedToken: string | null = null;

// Keep cachedToken in sync
supabaseClient.auth.onAuthStateChange((_event: string, session: Session | null) => {
  cachedToken = session?.access_token ?? null;
});

// Kept for backward compatibility with hooks that call getSupabase()
export function getSupabase(): Promise<SupabaseClient> {
  return Promise.resolve(supabaseClient);
}

export async function getAccessToken(): Promise<string | null> {
  try {
    if (cachedToken !== null) return cachedToken;
    const { data } = await supabaseClient.auth.getSession();
    cachedToken = data.session?.access_token ?? null;
    return cachedToken;
  } catch {
    return null;
  }
}

export function getCachedToken(): string | null {
  return cachedToken;
}

export function clearCachedToken(): void {
  cachedToken = null;
}
