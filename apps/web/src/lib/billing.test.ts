import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
  subscriptionUpsert: vi.fn(),
  queryRawUnsafe: vi.fn(),
  executeRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: (...args: unknown[]) => mocks.subscriptionUpsert(...args),
    },
    $queryRawUnsafe: (...args: unknown[]) => mocks.queryRawUnsafe(...args),
    $executeRawUnsafe: (...args: unknown[]) => mocks.executeRawUnsafe(...args),
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: mocks.getRuntimeConfigValue,
}));

import {
  buildUnifiedEntitlementSnapshot,
  ensureSubscriptionDefaults,
  findSubscriptionForEntitlement,
  getStripeAnnualTrialDays,
  getStripePriceIdForPlan,
  getStripePriceIdForPlanAndInterval,
  mapStripePriceIdToPlanAndInterval,
} from "./billing";
import { prisma } from "@/lib/db";

const subscriptionFindUnique = prisma.subscription.findUnique as unknown as Mock;

const fallbackColumns = [
  "id",
  "userId",
  "plan",
  "status",
  "provider",
  "platform",
  "accessType",
  "freeAccessEndsAt",
  "trialEndsAt",
  "createdAt",
  "updatedAt",
].map((COLUMN_NAME) => ({ COLUMN_NAME }));

function missingColumnError(column = "defaultdb.Subscription.purchaseTokenHash") {
  return Object.assign(new Error(`The column \`${column}\` does not exist in the current database.`), {
    name: "PrismaClientKnownRequestError",
    code: "P2022",
    meta: { column },
  });
}

describe("billing helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the monthly Individual Stripe price from the primary monthly env key", async () => {
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      key === "STRIPE_PRICE_INDIVIDUAL_MONTHLY" ? "price_monthly_new" : null,
    );

    await expect(getStripePriceIdForPlanAndInterval("INDIVIDUAL", "MONTH"))
      .resolves.toBe("price_monthly_new");
  });

  it("resolves the yearly Individual Stripe price from the primary yearly env key", async () => {
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      key === "STRIPE_PRICE_INDIVIDUAL_YEARLY" ? "price_yearly_new" : null,
    );

    await expect(getStripePriceIdForPlanAndInterval("INDIVIDUAL", "YEAR"))
      .resolves.toBe("price_yearly_new");
  });

  it("does not let the legacy Individual price override primary monthly or yearly keys", async () => {
    const values: Record<string, string> = {
      STRIPE_PRICE_INDIVIDUAL_MONTHLY: "price_monthly_new",
      STRIPE_PRICE_INDIVIDUAL_YEARLY: "price_yearly_new",
      STRIPE_PRICE_INDIVIDUAL: "price_legacy",
    };
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      values[key] || null,
    );

    await expect(getStripePriceIdForPlanAndInterval("INDIVIDUAL", "MONTH"))
      .resolves.toBe("price_monthly_new");
    await expect(getStripePriceIdForPlanAndInterval("INDIVIDUAL", "YEAR"))
      .resolves.toBe("price_yearly_new");
  });

  it("uses the legacy Individual price only as a monthly fallback", async () => {
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      key === "STRIPE_PRICE_INDIVIDUAL" ? "price_legacy_monthly" : null,
    );

    await expect(getStripePriceIdForPlanAndInterval("INDIVIDUAL", "MONTH"))
      .resolves.toBe("price_legacy_monthly");
    await expect(getStripePriceIdForPlan("INDIVIDUAL", "yearly")).resolves.toBeNull();
    expect(mocks.getRuntimeConfigValue).toHaveBeenCalledWith("STRIPE_PRICE_INDIVIDUAL_YEARLY");
  });

  it("maps Stripe monthly and yearly price IDs back to plan and interval", async () => {
    const values: Record<string, string> = {
      STRIPE_PRICE_INDIVIDUAL_MONTHLY: "price_monthly_new",
      STRIPE_PRICE_INDIVIDUAL_YEARLY: "price_yearly_new",
    };
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      values[key] || null,
    );

    await expect(mapStripePriceIdToPlanAndInterval("price_monthly_new")).resolves.toEqual({
      plan: "INDIVIDUAL",
      billingInterval: "MONTH",
    });
    await expect(mapStripePriceIdToPlanAndInterval("price_yearly_new")).resolves.toEqual({
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
    });
  });

  it("keeps billing interval during schedule-column schema fallback reads", async () => {
    subscriptionFindUnique
      .mockRejectedValueOnce(missingColumnError("defaultdb.Subscription.pendingBillingInterval"))
      .mockResolvedValueOnce({
        id: "sub-1",
        userId: "user-1",
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "STRIPE",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_yearly_new",
        billingInterval: "YEAR",
      });

    await expect(findSubscriptionForEntitlement("user-1")).resolves.toMatchObject({
      id: "sub-1",
      billingInterval: "YEAR",
      provider: "STRIPE",
    });

    expect(subscriptionFindUnique).toHaveBeenNthCalledWith(2, expect.objectContaining({
      select: expect.objectContaining({
        billingInterval: true,
        provider: true,
      }),
    }));
  });

  it("hydrates a missing billing interval from the Stripe price mapping", async () => {
    const values: Record<string, string> = {
      STRIPE_PRICE_INDIVIDUAL_YEARLY: "price_yearly_new",
    };
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      values[key] || null,
    );
    subscriptionFindUnique.mockResolvedValueOnce({
      id: "sub-1",
      userId: "user-1",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "STRIPE",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_yearly_new",
      billingInterval: null,
    });

    await expect(findSubscriptionForEntitlement("user-1")).resolves.toMatchObject({
      id: "sub-1",
      billingInterval: "YEAR",
    });
  });

  it("defaults annual Stripe trials to 90 days when the env key is missing", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);

    await expect(getStripeAnnualTrialDays()).resolves.toBe(90);
  });

  it("treats free-trial subscriptions with null trialEndsAt as inactive", () => {
    const entitlement = buildUnifiedEntitlementSnapshot({
      plan: "FREE_TRIAL",
      status: "TRIALING",
      provider: "TRIAL",
      platform: "web",
      trialEndsAt: null,
    });

    expect(entitlement.isActive).toBe(false);
  });

  it("treats active Free Access as non-card access until its end date", () => {
    const entitlement = buildUnifiedEntitlementSnapshot({
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "ADMIN",
      platform: "web",
      accessType: "FREE_ACCESS",
      freeAccessEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    expect(entitlement).toMatchObject({
      accessType: "FREE_ACCESS",
      isActive: true,
      isTrial: false,
      autoRenew: false,
    });
  });

  it("keeps canceled trials active until the trial end date when renewal is off", () => {
    const entitlement = buildUnifiedEntitlementSnapshot({
      plan: "INDIVIDUAL",
      status: "TRIAL_CANCELED",
      provider: "STRIPE",
      platform: "web",
      accessType: "FREE_TRIAL",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: true,
    });

    expect(entitlement).toMatchObject({
      accessType: "FREE_TRIAL",
      isActive: true,
      isTrial: true,
      autoRenew: false,
      cancelAtPeriodEnd: true,
    });
  });

  it("treats store grace periods as active paid access until the grace window ends", () => {
    const entitlement = buildUnifiedEntitlementSnapshot({
      plan: "INDIVIDUAL",
      status: "GRACE_PERIOD",
      provider: "PLAY_STORE",
      platform: "android",
      accessType: "PAID",
      gracePeriodEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    expect(entitlement).toMatchObject({
      status: "GRACE_PERIOD",
      isActive: true,
      managementKind: "store",
    });
  });

  it("treats missing subscription rows as inactive Free Access until the canonical row exists", () => {
    const entitlement = buildUnifiedEntitlementSnapshot(null);

    expect(entitlement).toMatchObject({
      plan: "FREE_TRIAL",
      status: "UNKNOWN",
      accessType: "FREE_ACCESS",
      isActive: false,
      isTrial: false,
    });
  });

  it("uses the normal Prisma upsert when ensuring subscription defaults against a current schema", async () => {
    mocks.subscriptionUpsert.mockResolvedValue({ id: "sub-1", userId: "user-1" });

    await expect(ensureSubscriptionDefaults("user-1")).resolves.toEqual({
      id: "sub-1",
      userId: "user-1",
    });

    expect(mocks.subscriptionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1" },
    }));
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("returns an existing row through the schema-compat fallback", async () => {
    mocks.subscriptionUpsert.mockRejectedValue(missingColumnError());
    mocks.queryRawUnsafe
      .mockResolvedValueOnce(fallbackColumns)
      .mockResolvedValueOnce([{ id: "sub-existing", userId: "user-1" }]);

    await expect(ensureSubscriptionDefaults("user-1")).resolves.toEqual({
      id: "sub-existing",
      userId: "user-1",
    });

    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("creates defaults without referencing missing newer columns", async () => {
    mocks.subscriptionUpsert.mockRejectedValue(missingColumnError());
    mocks.queryRawUnsafe
      .mockResolvedValueOnce(fallbackColumns)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "sub-created", userId: "user-1" }]);

    await expect(ensureSubscriptionDefaults("user-1")).resolves.toEqual({
      id: "sub-created",
      userId: "user-1",
    });

    const [sql, ...values] = mocks.executeRawUnsafe.mock.calls[0];
    expect(sql).toContain("INSERT INTO `Subscription`");
    expect(sql).not.toContain("purchaseTokenHash");
    expect(values).toContain("user-1");
    expect(values).toContain("FREE_TRIAL");
    expect(values).toContain("FREE_ACCESS");
  });
});
