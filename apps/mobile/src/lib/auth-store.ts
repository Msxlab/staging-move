/**
 * Mobile auth store — keeps the signed-in user in memory + SecureStore.
 *
 * The mobile login/exchange endpoints issue a JWT that we treat as an opaque bearer token. We:
 *   1. Receive it from /api/mobile/auth/login or /api/mobile/auth/exchange
 *   2. Persist it with expo-secure-store (keychain/keystore-backed)
 *   3. Attach it as Authorization: Bearer <jwt> on every API call
 *
 * Tokens are long-lived (30 days) so there's no refresh — we just re-login
 * on 401 via the middleware error. This matches the web app session cookie.
 */

import { create } from "zustand";
import { tokenCache } from "@/lib/auth";

const TOKEN_KEY = "locateflow.session";
const AUTH_REFRESH_TIMEOUT_MS = 12_000;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  emailVerified: boolean;
  hasPasswordLogin?: boolean;
  mfaEnabled: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  setSession: (token: string, user: AuthUser) => Promise<void>;
  clearSession: () => Promise<void>;
  refreshUser: (apiBaseUrl: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: true,

  async hydrate() {
    try {
      const token = await tokenCache.getToken(TOKEN_KEY);
      set({ token, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async setSession(token, user) {
    await tokenCache.saveToken(TOKEN_KEY, token);
    set({ token, user, loading: false });
  },

  async clearSession() {
    await tokenCache.clearToken(TOKEN_KEY);
    set({ token: null, user: null, loading: false });
  },

  async refreshUser(apiBaseUrl) {
    const { token } = get();
    if (!token) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AUTH_REFRESH_TIMEOUT_MS);
    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-client-type": "mobile",
        },
        signal: controller.signal,
      });
      if (res.status === 401) {
        await get().clearSession();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data?.user) set({ user: data.user });
    } catch {
      /* network error — keep prior state */
    } finally {
      clearTimeout(timeout);
    }
  },
}));

export async function getToken(): Promise<string | null> {
  return tokenCache.getToken(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await tokenCache.saveToken(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await tokenCache.clearToken(TOKEN_KEY);
}
