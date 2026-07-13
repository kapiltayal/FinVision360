import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { getSupabase, getAccessToken, clearCachedToken } from "@/lib/supabase";
import { useLocation } from "wouter";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  return { user: user as any, isLoading, isAuthenticated: !!user };
}

export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    let sub: any;
    getSupabase().then((sb) => {
      setSupabase(sb);
      sb.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      }).catch(() => setLoading(false));
      const { data: { subscription } } = sb.auth.onAuthStateChange((_event, s) => {
        setSession(s);
        if (!s) {
          queryClient.setQueryData(["/api/auth/user"], null);
          queryClient.clear();
        } else {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        }
      });
      sub = subscription;
    }).catch(() => setLoading(false));
    return () => sub?.unsubscribe();
  }, []);

  return { session, loading, supabase };
}

export function useLogin() {
  const [, setLocation] = useLocation();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const sb = await getSupabase();
      const { error, data } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/snapshot");
    },
  });
}

export function useRegister() {
  const [, setLocation] = useLocation();
  return useMutation({
    mutationFn: async ({ email, password, fullName }: { email: string; password: string; fullName?: string }) => {
      const sb = await getSupabase();
      const { error, data } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw new Error(error.message);
      // Provision the local users row immediately after signup so it exists
      // even when email confirmation is required (no session yet)
      if (data.user) {
        try {
          await apiRequest("POST", "/api/auth/provision", { supabaseId: data.user.id });
        } catch {
          // Non-fatal — middleware will create the row on first authenticated request
        }
      }
      return data;
    },
    onSuccess: async (data) => {
      if (data.session) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setLocation("/snapshot");
      }
    },
  });
}

export function useLogout() {
  const [, setLocation] = useLocation();
  return useMutation({
    mutationFn: async () => {
      // Clear the cached token FIRST so any re-fetch triggered by onSuccess
      // goes out without a token and gets 401 → null (prevents race condition)
      clearCachedToken();
      try {
        const sb = await getSupabase();
        await sb.auth.signOut();
      } catch {
        // Remote signout failed — local session already cleared above
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
      setLocation("/");
    },
    onError: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
      setLocation("/");
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async ({ newPassword }: { newPassword: string }) => {
      const sb = await getSupabase();
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
    },
  });
}
