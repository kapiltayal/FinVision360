import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;
let configPromise: Promise<SupabaseClient> | null = null;

async function fetchConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to fetch Supabase config");
  const { supabaseUrl, supabaseAnonKey } = await res.json();
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return supabaseInstance;
}

export function getSupabase(): Promise<SupabaseClient> {
  if (supabaseInstance) return Promise.resolve(supabaseInstance);
  if (!configPromise) configPromise = fetchConfig();
  return configPromise;
}

export async function getAccessToken(): Promise<string | null> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
