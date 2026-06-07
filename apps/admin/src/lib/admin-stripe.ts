/**
 * Shared Stripe client factory + live-key guard for admin billing routes.
 *
 * The same `isBillingProductionLike()` / `requireStripeSecretKey()` pair is
 * inlined in hard-delete-user.ts, the settings route, and the per-user
 * subscription-actions route. The subscription LIFECYCLE routes
 * (cancel / refund / force re-sync) all need the identical guard, so it is
 * centralised here instead of copy-pasted a fourth, fifth, and sixth time.
 *
 * Guarantees (matching the existing inline copies exactly):
 *   - In production-like billing environments the key MUST be `sk_live_`.
 *   - Outside production the key must still be a valid `sk_test_`/`sk_live_`.
 *   - The secret is pulled from the admin runtime config (DB-backed override
 *     or env) via getAdminRuntimeConfigValue, never read directly from a
 *     bare env var, so the same resolution the rest of the app uses applies.
 */

import Stripe from "stripe";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";

// Stripe API version pinned to match every other admin/web Stripe caller.
export const ADMIN_STRIPE_API_VERSION = "2024-06-20" as const;

export function isBillingProductionLike(): boolean {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  if (["development", "dev", "test", "staging", "preview"].includes(appEnv)) return false;
  return appEnv === "production" || (!appEnv && process.env.NODE_ENV === "production");
}

export function requireStripeSecretKey(key: string | null | undefined): string {
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
  if (isBillingProductionLike() && !key.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY must be live in production billing environments");
  }
  if (!isBillingProductionLike() && !key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY has an invalid prefix");
  }
  return key;
}

/**
 * Build a Stripe client from the admin runtime-config secret, enforcing the
 * live-key guard. Throws (caller maps to a 500 with an opaque message) when
 * the key is missing or the prefix is wrong for the environment.
 */
export async function getAdminStripeClient(): Promise<Stripe> {
  const secret = requireStripeSecretKey(
    await getAdminRuntimeConfigValue("STRIPE_SECRET_KEY"),
  );
  return new Stripe(secret, { apiVersion: ADMIN_STRIPE_API_VERSION });
}
