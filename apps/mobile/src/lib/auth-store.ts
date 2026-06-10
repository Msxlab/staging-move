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

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { create } from "zustand";
import { tokenCache } from "@/lib/auth";

const TOKEN_KEY = "locateflow.session";

/**
 * Client-identity headers that MUST accompany every authenticated mobile
 * request. The server derives the session fingerprint from the User-Agent
 * (see generateMobileFingerprint in apps/web/src/lib/user-auth.ts), so a
 * request that omits this descriptive UA gets the raw React Native fetch UA
 * (okhttp / CFNetwork) instead, the recomputed fingerprint no longer matches
 * the `fp` claim minted at login, and getUserSession returns 401 + marks the
 * DB session inactive.
 *
 * The shared ApiClient (apps/mobile/src/lib/api.ts) sends these on every call,
 * but the cold-start /api/auth/me hydration in `refreshUser` uses a bare
 * `fetch`, so it MUST set them too — otherwise the first request after every
 * app restart 401s and logs the user out. Keep these values byte-for-byte in
 * sync with api.ts's CLIENT_* constants.
 */
const CLIENT_VERSION =
  Constants.expoConfig?.version ??
  (Constants as { nativeAppVersion?: string }).nativeAppVersion ??
  "0.0.0";

const CLIENT_IDENTITY_HEADERS: Record<string, string> = {
  "x-client-type": "mobile",
  "x-client-platform": Platform.OS,
  "x-client-version": CLIENT_VERSION,
  "User-Agent": `LocateFlow/${CLIENT_VERSION} (${
    Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Mobile"
  }; Expo)`,
};
// planTier lives in AsyncStorage (NOT SecureStore) alongside the other
// non-secret UI prefs (theme, app-lock). Persisting it lets ThemeProvider
// derive the correct Family/Pro palette on the FIRST render after a cold
// launch — before /api/profile resolves — so the dashboard theme + raccoon
// mascots no longer flash the base Aurora palette.
const PLAN_TIER_KEY = "locateflow.planTier";
const AUTH_REFRESH_TIMEOUT_MS = 12_000;

/**
 * The only plan values that may drive theming. A persisted value outside this
 * set (corruption, a future/renamed tier, a downgraded build) is coerced to
 * `null` so it can never break the palette — `applyPlanPalette` then falls
 * back to the base Aurora theme. "INDIVIDUAL" is valid but renders the base
 * palette (no accent), same as `null`. FREE/FREE_TRIAL drive the candy-coral
 * Free accent (Edition VII: every tier is color-coded, Free included).
 */
const KNOWN_PLAN_TIERS = ["FAMILY", "PRO", "INDIVIDUAL", "FREE", "FREE_TRIAL"] as const;

/** Normalize an arbitrary persisted/server value to a safe plan tier or null. */
function normalizePlanTier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  return (KNOWN_PLAN_TIERS as readonly string[]).includes(upper) ? upper : null;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  emailVerified: boolean;
  hasPasswordLogin?: boolean;
  /**
   * Server-computed: true when the account has at least one OAuth provider
   * linked but no password yet. Single source of truth for the password-setup
   * gate — mirrors `getPostAuthUserState` on the web side. Optional for
   * forward-compat with older API responses; treat undefined as "unknown,
   * don't gate".
   */
  needsPasswordSetup?: boolean;
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
  /**
   * Apply a partial patch to the in-memory user record. Use this after a
   * client-driven mutation (e.g. setting a password from setup-password)
   * so the UI does not have to wait for the next /api/auth/me round-trip
   * and the AuthGuard gate clears immediately without a redirect loop.
   */
  patchUser: (patch: Partial<AuthUser>) => void;
  /**
   * Effective plan tier ("FAMILY" | "PRO" | "INDIVIDUAL" | null), set after the
   * client resolves the user's entitlement (e.g. on the dashboard). Drives
   * per-plan theming in ThemeProvider — kept here (not on AuthUser) because it
   * comes from /api/profile entitlement, not the auth/me user record.
   */
  planTier: string | null;
  setPlanTier: (plan: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: true,
  planTier: null,

  async hydrate() {
    try {
      // Restore the token (SecureStore) and the cached plan tier (AsyncStorage)
      // together so the very first render after launch already has the right
      // plan palette — no flash of the base Aurora theme before /api/profile.
      const [token, storedPlan] = await Promise.all([
        tokenCache.getToken(TOKEN_KEY),
        AsyncStorage.getItem(PLAN_TIER_KEY).catch(() => null),
      ]);
      set({ token, planTier: normalizePlanTier(storedPlan), loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async setSession(token, user) {
    await tokenCache.saveToken(TOKEN_KEY, token);
    set({ token, user, loading: false });
  },

  async clearSession() {
    // CRITICAL: drop the persisted plan tier too. Otherwise a previous user's
    // Family/Pro palette would be restored on the next launch and leak into a
    // new (e.g. Individual) session before /api/profile corrects it.
    await Promise.all([
      tokenCache.clearToken(TOKEN_KEY),
      AsyncStorage.removeItem(PLAN_TIER_KEY).catch(() => {}),
    ]);
    set({ token: null, user: null, planTier: null, loading: false });
  },

  patchUser(patch) {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...patch } });
  },

  setPlanTier(plan) {
    // Validate against the known set so a bad value can never reach theming,
    // then persist (fire-and-forget) so the correct palette survives the next
    // cold launch. The in-memory update is synchronous so the UI reacts now.
    const normalized = normalizePlanTier(plan);
    if (get().planTier !== normalized) {
      set({ planTier: normalized });
    }
    if (normalized === null) {
      void AsyncStorage.removeItem(PLAN_TIER_KEY).catch(() => {});
    } else {
      void AsyncStorage.setItem(PLAN_TIER_KEY, normalized).catch(() => {});
    }
  },

  async refreshUser(apiBaseUrl) {
    const { token } = get();
    if (!token) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AUTH_REFRESH_TIMEOUT_MS);
    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/me`, {
        headers: {
          ...CLIENT_IDENTITY_HEADERS,
          Authorization: `Bearer ${token}`,
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
