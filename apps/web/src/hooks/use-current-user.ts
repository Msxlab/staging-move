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

async function clearServiceWorkerAuthState() {
  if (typeof window === "undefined") return;
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("locateflow-"))
          .map((key) => caches.delete(key)),
      );
    }
    navigator.serviceWorker?.controller?.postMessage({ type: "LOGOUT_CLEAR_CACHES" });
  } catch {
    /* best effort */
  }
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
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
      body: "{}",
      cache: "no-store",
    }).catch(() => {});
    await clearServiceWorkerAuthState();
    setUser(null);
    // Hard-redirect so the middleware re-runs and we leave any protected page.
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  return { user, loading, refresh, signOut };
}
