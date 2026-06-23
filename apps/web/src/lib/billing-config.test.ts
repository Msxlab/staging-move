import { describe, expect, it } from "vitest";
import {
  buildStripeIdempotencyKey,
  isBillingProductionLike,
  isDeployedBillingEnvironment,
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

  it("treats staging and preview as deployed billing environments (audit 4.4 sandbox gate)", () => {
    // Behavior change: the unified deployed-environment predicate enforces the
    // IAP sandbox allowlist on staging/preview, not just production — unlike
    // isBillingProductionLike, which (correctly) stays false off-prod for
    // Stripe test-key validation.
    expect(isDeployedBillingEnvironment({ APP_ENV: "staging" } as any)).toBe(true);
    expect(isBillingProductionLike({ APP_ENV: "staging" } as any)).toBe(false);

    expect(isDeployedBillingEnvironment({ APP_ENV: "preview" } as any)).toBe(true);
    expect(isDeployedBillingEnvironment({ VERCEL_ENV: "preview" } as any)).toBe(true);
    expect(isDeployedBillingEnvironment({ APP_ENV: "production" } as any)).toBe(true);
    expect(isDeployedBillingEnvironment({ NODE_ENV: "production" } as any)).toBe(true);
  });

  it("treats local/dev/test as non-deployed (sandbox allowlist not enforced)", () => {
    expect(isDeployedBillingEnvironment({ APP_ENV: "development" } as any)).toBe(false);
    expect(isDeployedBillingEnvironment({ APP_ENV: "test" } as any)).toBe(false);
    expect(isDeployedBillingEnvironment({} as any)).toBe(false);
  });

  it("builds deterministic Stripe idempotency keys without exposing raw identifiers", () => {
    const a = buildStripeIdempotencyKey(["customer", "user_123"]);
    const b = buildStripeIdempotencyKey(["customer", "user_123"]);
    expect(a).toBe(b);
    expect(a).not.toContain("user_123");
  });
});
