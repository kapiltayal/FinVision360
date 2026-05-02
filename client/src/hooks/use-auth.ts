import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  return { user: user as any, isLoading, isAuthenticated: !!user };
}

export function useLogin() {
  const [, setLocation] = useLocation();
  return useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: (userData) => {
      // First set auth data so the UI knows the user is logged in immediately,
      // then clear all other stale data from any previous session.
      queryClient.setQueryData(["/api/auth/user"], userData);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "/api/auth/user",
      });
      setLocation("/snapshot");
    },
  });
}

export function useRegister() {
  const [, setLocation] = useLocation();
  return useMutation({
    mutationFn: async (data: { username: string; password: string; fullName?: string; email?: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/auth/user"], userData);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "/api/auth/user",
      });
      setLocation("/snapshot");
    },
  });
}

export function useLogout() {
  const [, setLocation] = useLocation();
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Set auth to null first so UI immediately reflects logged-out state,
      // then wipe all other cached data from the previous session.
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "/api/auth/user",
      });
      setLocation("/");
    },
  });
}
