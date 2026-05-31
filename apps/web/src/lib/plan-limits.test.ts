import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  subscriptionFindUnique: vi.fn(),
  userEventFindFirst: vi.fn(),
  serviceCount: vi.fn(),
  addressCount: vi.fn(),
  movingPlanCount: vi.fn(),
  userCustomProviderCount: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: (...args: unknown[]) => mocks.subscriptionFindUnique(...args) },
    userEvent: { findFirst: (...args: unknown[]) => mocks.userEventFindFirst(...args) },
    service: { count: (...args: unknown[]) => mocks.serviceCount(...args) },
    address: { count: (...args: unknown[]) => mocks.addressCount(...args) },
    movingPlan: { count: (...args: unknown[]) => mocks.movingPlanCount(...args) },
    userCustomProvider: { count: (...args: unknown[]) => mocks.userCustomProviderCount(...args) },
  },
}));

import {
  ACTIVE_TRACKED_SERVICE_WHERE,
  canCreateAddress,
  canCreateCustomProvider,
  canCreateMovingDestinationAddress,
  canCreateMovingPlan,
  canCreateService,
  canGenerateMoveTasks,
  getUserPlan,
} from "./plan-limits";

describe("plan limits setup grace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscriptionFindUnique.mockResolvedValue(null);
    mocks.userEventFindFirst.mockResolvedValue(null);
    mocks.serviceCount.mockResolvedValue(0);
    mocks.addressCount.mockResolvedValue(0);
    mocks.movingPlanCount.mockResolvedValue(0);
    mocks.userCustomProviderCount.mockResolvedValue(0);
  });

  it("treats a missing subscription row as active default Free Access", async () => {
    await expect(getUserPlan("user_1")).resolves.toMatchObject({
      plan: "FREE_TRIAL",
      status: "FREE_ACCESS",
      isActive: true,
      isTrialExpired: false,
    });
  });

  it("allows completed users with a missing subscription to add services within the default trial limit", async () => {
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.serviceCount.mockResolvedValue(2);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("applies the 10-service cap to active Free Access users", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      accessType: "FREE_ACCESS",
      freeAccessEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.serviceCount.mockResolvedValue(10);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      current: 10,
      limit: 10,
    });
  });

  it("allows Free Access users to add services when deleted history leaves active count below 10", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      accessType: "FREE_ACCESS",
      freeAccessEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.serviceCount.mockResolvedValue(7);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("applies the 10-service cap to annual Free Trial users even though the plan is Individual", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "INDIVIDUAL",
      status: "TRIALING",
      accessType: "FREE_TRIAL",
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.serviceCount.mockResolvedValue(10);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      limit: 10,
    });
  });

  it("still enforces the default service cap when the subscription row is missing", async () => {
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.serviceCount.mockResolvedValue(10);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      current: 10,
      limit: 10,
    });
  });

  it("counts only active tracked services toward the trial service cap", async () => {
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.serviceCount.mockResolvedValue(7);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: true,
    });

    expect(mocks.serviceCount).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        ...ACTIVE_TRACKED_SERVICE_WHERE,
      },
    });
  });

  it("blocks the 11th active tracked service but ignores deleted archived or canceled history", async () => {
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.serviceCount.mockResolvedValue(10);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      current: 10,
      limit: 10,
    });

    const countArg = mocks.serviceCount.mock.calls.at(-1)?.[0];
    expect(countArg.where).toMatchObject({
      userId: "user_1",
      deletedAt: null,
      isActive: true,
      deactivatedAt: null,
    });
    expect(countArg.where.OR).toEqual([
      { migrationAction: null },
      {
        migrationAction: {
          notIn: expect.arrayContaining(["CANCEL", "CANCELED", "CANCELLED", "REMOVE", "REMOVED", "ARCHIVE", "ARCHIVED"]),
        },
      },
    ]);
  });

  it("allows incomplete setup users to add initial services even when a legacy trial row is expired", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.serviceCount.mockResolvedValue(2);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: true,
      setupGrace: true,
      current: 2,
      limit: 10,
    });
  });

  it("blocks complete expired users with a structured trial-expired code", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "TRIAL_EXPIRED",
      upgradeRequired: true,
    });
  });

  it("enforces setup service and custom-provider quotas", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.serviceCount.mockResolvedValue(10);
    mocks.userCustomProviderCount.mockResolvedValue(10);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SETUP_SERVICE_LIMIT_REACHED",
      limit: 10,
    });
    await expect(canCreateCustomProvider("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SETUP_CUSTOM_PROVIDER_LIMIT_REACHED",
      limit: 10,
    });
  });

  it("allows first setup addresses within the setup allowance", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.addressCount.mockResolvedValue(1);

    await expect(canCreateAddress("user_1")).resolves.toMatchObject({
      allowed: true,
      setupGrace: true,
      current: 1,
      limit: 2,
    });
  });

  it("returns SETUP_MOVING_PLAN_LIMIT_REACHED when a setup user exceeds the move-plan allowance", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.movingPlanCount.mockResolvedValue(1);

    await expect(canCreateMovingPlan("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SETUP_MOVING_PLAN_LIMIT_REACHED",
      upgradeRequired: true,
      current: 1,
      limit: 1,
    });
  });

  it("allows the first moving-plan destination address under setup allowance even when address quota is full", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.addressCount.mockResolvedValue(2);
    mocks.movingPlanCount.mockResolvedValue(0);

    await expect(canCreateMovingDestinationAddress("user_1")).resolves.toMatchObject({
      allowed: true,
      setupGrace: true,
      current: 0,
      limit: 1,
    });
  });

  it("uses the normal address quota after the first moving-plan setup allowance is spent", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.addressCount.mockResolvedValue(2);
    mocks.movingPlanCount.mockResolvedValue(1);

    await expect(canCreateMovingDestinationAddress("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SETUP_ADDRESS_LIMIT_REACHED",
      limit: 2,
    });
  });

  it("allows setup users to generate move tasks for their first plan", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 1000),
    });

    await expect(canGenerateMoveTasks("user_1")).resolves.toMatchObject({
      allowed: true,
      setupGrace: true,
    });
  });

  it("still blocks completed expired users from generating move tasks", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });

    await expect(canGenerateMoveTasks("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "TRIAL_EXPIRED",
      upgradeRequired: true,
    });
  });
});

describe("plan limits — Family/Pro tiers (doc 62 cascade)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.serviceCount.mockResolvedValue(0);
    mocks.addressCount.mockResolvedValue(0);
    mocks.movingPlanCount.mockResolvedValue(0);
    mocks.userCustomProviderCount.mockResolvedValue(0);
  });

  const paidActive = (plan: string) => ({
    plan,
    status: "ACTIVE",
    accessType: "PAID",
    provider: "STRIPE",
    currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  it("resolves a paid-active Family subscription to Family limits (17/250)", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("FAMILY"));

    await expect(getUserPlan("user_1")).resolves.toMatchObject({
      plan: "FAMILY",
      isActive: true,
      hasPremium: true,
      limits: { maxAddresses: 17, maxServices: 250 },
    });
  });

  it("resolves a paid-active Pro subscription to Pro limits (25/1000)", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("PRO"));

    await expect(getUserPlan("user_1")).resolves.toMatchObject({
      plan: "PRO",
      isActive: true,
      hasPremium: true,
      limits: { maxAddresses: 25, maxServices: 1000 },
    });
  });

  it("lets a Family user add a service past the Individual 100 cap", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("FAMILY"));
    mocks.serviceCount.mockResolvedValue(150);

    await expect(canCreateService("user_1")).resolves.toMatchObject({ allowed: true });
  });

  it("still enforces the Family service ceiling at 250", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("FAMILY"));
    mocks.serviceCount.mockResolvedValue(250);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      limit: 250,
    });
  });

  it("lets a Pro user add an address past the Individual 10 cap", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("PRO"));
    mocks.addressCount.mockResolvedValue(20);

    await expect(canCreateAddress("user_1")).resolves.toMatchObject({ allowed: true });
  });

  it("honors an admin manual Family grant (provider=ADMIN) as Family limits", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FAMILY",
      status: "ACTIVE",
      accessType: "PAID",
      provider: "ADMIN",
      premiumGrantedBy: "admin_1",
      premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await expect(getUserPlan("user_1")).resolves.toMatchObject({
      plan: "FAMILY",
      isActive: true,
      hasPremium: true,
      limits: { maxAddresses: 17, maxServices: 250 },
    });
  });
});
