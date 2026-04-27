import { createHash } from "crypto";

export function isBillingProductionLike(env: NodeJS.ProcessEnv = process.env) {
  const appEnv = (env.APP_ENV || env.VERCEL_ENV || "").toLowerCase();
  if (["development", "dev", "test", "staging", "preview"].includes(appEnv)) {
    return false;
  }
  return appEnv === "production" || (!appEnv && env.NODE_ENV === "production");
}

export function validateStripeSecretKeyForEnv(
  key: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): { ok: boolean; reason: string | null } {
  if (!key) return { ok: false, reason: "STRIPE_SECRET_KEY is missing" };
  if (isBillingProductionLike(env) && !key.startsWith("sk_live_")) {
    return {
      ok: false,
      reason: "STRIPE_SECRET_KEY must be a live key in production billing environments",
    };
  }
  if (!isBillingProductionLike(env) && !key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    return { ok: false, reason: "STRIPE_SECRET_KEY has an invalid prefix" };
  }
  return { ok: true, reason: null };
}

export function requireStripeSecretKeyForMutation(
  key: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  const validation = validateStripeSecretKeyForEnv(key, env);
  if (!validation.ok) {
    const err = new Error(validation.reason || "Stripe is not configured");
    err.name = "BILLING_CONFIG_ERROR";
    throw err;
  }
  return key!;
}

export function buildStripeIdempotencyKey(parts: string[]) {
  const hash = createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 32);
  return `locateflow:${hash}`;
}

export function requireAppleEnvironmentForBilling(
  value: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): "Production" | "Sandbox" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "sandbox") return "Sandbox";
  if (normalized === "production") return "Production";
  if (isBillingProductionLike(env)) {
    const err = new Error("APPLE_APP_STORE_ENVIRONMENT is required in production billing environments");
    err.name = "BILLING_CONFIG_ERROR";
    throw err;
  }
  return "Sandbox";
}
