import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isFeatureEnabled: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: (...a: unknown[]) => mocks.isFeatureEnabled(...a),
}));

// Uses the REAL (pure) getEffectiveEntitlement — only the flag read is mocked.
import { resolveConsumerEntitlement } from "./consumer-entitlement";

const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

describe("resolveConsumerEntitlement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("flag OFF → RAW entitlement, never upgraded (reversible)", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(false);
    const { entitlement, consumerFreeApplied } = await resolveConsumerEntitlement(null);
    expect(consumerFreeApplied).toBe(false);
    expect(entitlement.hasPremium).toBe(false);
    expect(entitlement.effectivePlan).not.toBe("PRO");
  });

  it("flag ON + free/no-row consumer → PRO + active (single-point upgrade)", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(true);
    const { entitlement, consumerFreeApplied } = await resolveConsumerEntitlement(null);
    expect(consumerFreeApplied).toBe(true);
    expect(entitlement.effectivePlan).toBe("PRO");
    expect(entitlement.effectiveStatus).toBe("PAID_ACTIVE");
    expect(entitlement.hasAccess).toBe(true);
    expect(entitlement.hasPremium).toBe(true);
  });

  it("flag ON does NOT upgrade a lapsed Stripe payer (H3-safe)", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(true);
    const { consumerFreeApplied, entitlement } = await resolveConsumerEntitlement({
      plan: "PRO",
      status: "CANCELED",
      accessType: "PAID",
      provider: "STRIPE",
      stripeCustomerId: "cus_1",
      canceledAt: PAST,
      currentPeriodEndsAt: PAST,
    });
    expect(consumerFreeApplied).toBe(false);
    expect(entitlement.effectiveStatus).not.toBe("PAID_ACTIVE");
  });

  it("flag ON does NOT re-upgrade an already-premium admin grant", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(true);
    const { consumerFreeApplied } = await resolveConsumerEntitlement({
      plan: "PRO",
      status: "ACTIVE",
      accessType: "PAID",
      provider: "ADMIN",
      premiumGrantedBy: "admin_1",
      premiumUntil: FUTURE,
    });
    expect(consumerFreeApplied).toBe(false);
  });
});
