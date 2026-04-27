import { describe, expect, it } from "vitest";
import {
  buildStripeIdempotencyKey,
  isBillingProductionLike,
  requireAppleEnvironmentForBilling,
  validateStripeSecretKeyForEnv,
} from "./billing-config";

describe("billing config guards", () => {
  it("treats explicit staging as non-production even when NODE_ENV is production", () => {
    expect(isBillingProductionLike({ NODE_ENV: "production", APP_ENV: "staging" } as any)).toBe(false);
  });

  it("rejects Stripe test keys in production billing environments", () => {
    const result = validateStripeSecretKeyForEnv("sk_test_123", {
      APP_ENV: "production",
    } as any);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("live key");
  });

  it("allows Stripe test keys in staging billing environments", () => {
    expect(
      validateStripeSecretKeyForEnv("sk_test_123", { APP_ENV: "staging" } as any).ok,
    ).toBe(true);
  });

  it("requires Apple environment in production but defaults dev to sandbox", () => {
    expect(() =>
      requireAppleEnvironmentForBilling(null, { APP_ENV: "production" } as any),
    ).toThrow("APPLE_APP_STORE_ENVIRONMENT");
    expect(requireAppleEnvironmentForBilling(null, { APP_ENV: "staging" } as any)).toBe("Sandbox");
  });

  it("builds deterministic Stripe idempotency keys without exposing raw identifiers", () => {
    const a = buildStripeIdempotencyKey(["customer", "user_123"]);
    const b = buildStripeIdempotencyKey(["customer", "user_123"]);
    expect(a).toBe(b);
    expect(a).not.toContain("user_123");
  });
});
