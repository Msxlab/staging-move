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

// ── Server-side price resolution for admin plan changes ──────────────────────
//
// The change-plan route must NEVER trust a client-supplied price id — an
// operator picks a (plan, interval) pair and the server resolves the actual
// Stripe price id from the SAME runtime-config keys the web checkout uses
// (BILLING_PRODUCT_CONFIG_KEYS in packages/shared/src/billing.ts). The web's
// resolver lives in apps/web/src/lib/billing.ts which is not importable from
// this separate admin build (same constraint the other lifecycle routes note),
// so the identical logic is mirrored here against getAdminRuntimeConfigValue.

export const ADMIN_PAID_PLANS = ["INDIVIDUAL", "FAMILY", "PRO"] as const;
export type AdminPaidPlan = (typeof ADMIN_PAID_PLANS)[number];

export type AdminBillingInterval = "MONTH" | "YEAR";

export function isAdminPaidPlan(value: unknown): value is AdminPaidPlan {
  return typeof value === "string" && (ADMIN_PAID_PLANS as readonly string[]).includes(value);
}

/**
 * Resolve the Stripe Price ID for a (plan, interval) pair from runtime config.
 *
 * Mirrors apps/web getStripePriceIdForPlanAndInterval exactly: the legacy
 * monthly-only STRIPE_PRICE_INDIVIDUAL never beats the explicit monthly/yearly
 * keys, and FAMILY/PRO resolve only when their price IDs are configured.
 * Returns null when no price id is configured for the pair (caller 503s).
 */
export async function resolveAdminStripePriceId(
  plan: AdminPaidPlan,
  interval: AdminBillingInterval,
): Promise<string | null> {
  if (plan === "INDIVIDUAL") {
    const [monthly, yearly, legacyMonthly] = await Promise.all([
      getAdminRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_MONTHLY"),
      getAdminRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_YEARLY"),
      getAdminRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL"),
    ]);
    if (interval === "MONTH") return monthly || legacyMonthly || null;
    return yearly || null;
  }
  const monthlyKey = plan === "FAMILY" ? "STRIPE_PRICE_FAMILY_MONTHLY" : "STRIPE_PRICE_PRO_MONTHLY";
  const yearlyKey = plan === "FAMILY" ? "STRIPE_PRICE_FAMILY_YEARLY" : "STRIPE_PRICE_PRO_YEARLY";
  const [monthly, yearly] = await Promise.all([
    getAdminRuntimeConfigValue(monthlyKey),
    getAdminRuntimeConfigValue(yearlyKey),
  ]);
  return interval === "MONTH" ? monthly || null : yearly || null;
}

/**
 * Best-effort reverse map: given a configured Stripe price id, return the
 * (plan, interval) it corresponds to. Mirrors apps/web
 * mapStripePriceIdToPlanAndInterval. Used to derive the subscription's CURRENT
 * plan/interval from its stored stripePriceId when the local `plan`/
 * `billingInterval` columns are stale, and to reject a no-op change.
 */
export async function mapAdminStripePriceId(
  priceId: string | null | undefined,
): Promise<{ plan: AdminPaidPlan; interval: AdminBillingInterval } | null> {
  if (!priceId) return null;
  const [
    indMonthly,
    indYearly,
    indLegacy,
    famMonthly,
    famYearly,
    proMonthly,
    proYearly,
  ] = await Promise.all([
    getAdminRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_MONTHLY"),
    getAdminRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_YEARLY"),
    getAdminRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL"),
    getAdminRuntimeConfigValue("STRIPE_PRICE_FAMILY_MONTHLY"),
    getAdminRuntimeConfigValue("STRIPE_PRICE_FAMILY_YEARLY"),
    getAdminRuntimeConfigValue("STRIPE_PRICE_PRO_MONTHLY"),
    getAdminRuntimeConfigValue("STRIPE_PRICE_PRO_YEARLY"),
  ]);
  if (indMonthly && priceId === indMonthly) return { plan: "INDIVIDUAL", interval: "MONTH" };
  if (indYearly && priceId === indYearly) return { plan: "INDIVIDUAL", interval: "YEAR" };
  if (indLegacy && priceId === indLegacy) return { plan: "INDIVIDUAL", interval: "MONTH" };
  if (famMonthly && priceId === famMonthly) return { plan: "FAMILY", interval: "MONTH" };
  if (famYearly && priceId === famYearly) return { plan: "FAMILY", interval: "YEAR" };
  if (proMonthly && priceId === proMonthly) return { plan: "PRO", interval: "MONTH" };
  if (proYearly && priceId === proYearly) return { plan: "PRO", interval: "YEAR" };
  return null;
}
