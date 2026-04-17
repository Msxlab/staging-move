"use client";

import { useCallback, useEffect, useState } from "react";

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface UseCurrentUserResult {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Client-side hook: reads /api/auth/me and keeps a single in-flight request.
 * This replaces Clerk's useUser/useAuth.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    // Hard-redirect so the middleware re-runs and we leave any protected page.
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  return { user, loading, refresh, signOut };
}
