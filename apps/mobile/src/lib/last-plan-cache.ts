/**
 * LAST-KNOWN PLAN CACHE — a tiny, best-effort hint to kill the launch flash.
 *
 * Problem this solves: on cold start the dashboard mounts with no entitlement
 * yet, so it briefly rendered the FREE upsell card before the live entitlement
 * resolved and swapped in the Pro/paid layout ("önce unlock çıkıyor, sonra Pro
 * olduğunu fark edip modal kartlar yükleniyor"). This caches the last RESOLVED
 * premium flag + plan tier so the next mount can SEED its initial state toward
 * the correct layout (or stay neutral when unknown) instead of flashing free.
 *
 * Contract (deliberately mirrors dashboard-snapshot.ts):
 *   - The cache is ONLY a HINT to pick the initial render. The live entitlement
 *     is always authoritative and overwrites the hint the moment it resolves.
 *   - Best-effort + NON-BLOCKING: every read/write is wrapped; a failure returns
 *     null / false and never disturbs the dashboard.
 *   - Shape-guarded read-back: a malformed / old payload yields `null`, never a
 *     crash.
 *
 * PRIVACY: stores only a boolean + a plan-tier string the user already sees on
 * their own screen (no tokens, no other-user data). Device-keyed, so it is wiped
 * on logout/delete via clearSensitiveLocalState (see lib/local-cleanup.ts).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

/** AsyncStorage key. Versioned so a shape change can bump without colliding. */
export const LAST_PLAN_CACHE_KEY = "locateflow.lastPlan.v1";

/** The cached entitlement hint. `premium` drives which hero seeds on mount. */
export interface LastPlanHint {
  /** Last RESOLVED effective-premium flag. */
  premium: boolean;
  /** Last RESOLVED plan tier (e.g. "FAMILY", "PRO", "FREE_TRIAL"), or null. */
  planTier: string | null;
}

/** Coerce to a trimmed non-empty string or null. */
function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Persist the last-known plan hint. Best-effort: returns false (never throws) on
 * any failure so the dashboard load is never disturbed. Only call this AFTER a
 * successful live entitlement resolve — never from a guess.
 */
export async function persistLastPlanHint(hint: LastPlanHint): Promise<boolean> {
  try {
    const payload: LastPlanHint = {
      premium: hint.premium === true,
      planTier: str(hint.planTier),
    };
    await AsyncStorage.setItem(LAST_PLAN_CACHE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the last-known plan hint back, FULLY shape-guarded. Returns `null` when
 * absent, unparseable, or malformed (so the caller falls back to the neutral
 * loading state). Never throws.
 */
export async function readLastPlanHint(): Promise<LastPlanHint | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_PLAN_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    // `premium` must be a real boolean; anything else means a corrupt/old payload
    // and we'd rather show the neutral skeleton than trust a bad hint.
    if (typeof o.premium !== "boolean") return null;
    return { premium: o.premium, planTier: str(o.planTier) };
  } catch {
    return null;
  }
}

/**
 * Clear the cached hint (best-effort). Wired into clearSensitiveLocalState so a
 * signed-out / switched account never seeds off the previous user's plan.
 */
export async function clearLastPlanHint(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_PLAN_CACHE_KEY);
  } catch {
    /* non-blocking */
  }
}
