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
  getPlanForLimitScope,
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

  it("allows completed free users to add services under the thin-Free 10 cap", async () => {
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.serviceCount.mockResolvedValue(2);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("enforces the thin-Free 10-service cap on completed Free Access users", async () => {
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
      limit: 10,
    });
  });

  it("enforces the thin-Free 10-service cap on completed free-trial users", async () => {
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

  it("enforces the thin-Free 10-service cap when the subscription row is missing", async () => {
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.serviceCount.mockResolvedValue(10);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      limit: 10,
    });
  });

  it("counts only active tracked services when checking the free service cap", async () => {
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

  it("allows incomplete setup users to add services without a setup cap (unlimited)", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.serviceCount.mockResolvedValue(50);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: true,
      setupGrace: true,
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

  it("enforces the setup custom-provider quota (services are now unlimited)", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.serviceCount.mockResolvedValue(50);
    mocks.userCustomProviderCount.mockResolvedValue(10);

    // Services are unlimited during setup now — even a high count is allowed.
    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: true,
      setupGrace: true,
    });
    // Custom providers keep their setup cap.
    await expect(canCreateCustomProvider("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SETUP_CUSTOM_PROVIDER_LIMIT_REACHED",
      limit: 10,
    });
  });

  it("enforces the active-path custom-provider abuse ceiling (FREE_TRIAL = 25)", async () => {
    // subscription null → active default Free Access (isActive:true, FREE_TRIAL limits),
    // so canCreateCustomProvider takes the ACTIVE path (not setup grace). Previously
    // this path had no count check at all.
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.userCustomProviderCount.mockResolvedValue(25);

    await expect(canCreateCustomProvider("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "CUSTOM_PROVIDER_LIMIT_REACHED",
      current: 25,
      limit: 25,
    });
  });

  it("allows custom providers below the active-path ceiling", async () => {
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.userCustomProviderCount.mockResolvedValue(24);

    await expect(canCreateCustomProvider("user_1")).resolves.toMatchObject({ allowed: true });
  });

  it("allows setup addresses up to the new 3-address allowance", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.addressCount.mockResolvedValue(2);

    await expect(canCreateAddress("user_1")).resolves.toMatchObject({
      allowed: true,
      setupGrace: true,
      current: 2,
      limit: 3,
    });
  });

  it("blocks the 4th setup address with the setup address-limit code", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FREE_TRIAL",
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 1000),
    });
    mocks.addressCount.mockResolvedValue(3);

    await expect(canCreateAddress("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SETUP_ADDRESS_LIMIT_REACHED",
      limit: 3,
    });
  });

  it("blocks a setup (fresh free, pre-completion) user from creating a moving plan with the upgrade signal", async () => {
    // Fresh free user: no subscription row (active default Free Access),
    // onboarding not yet completed. They never get a plan — only the teaser.
    mocks.subscriptionFindUnique.mockResolvedValue(null);
    mocks.userEventFindFirst.mockResolvedValue(null);
    mocks.movingPlanCount.mockResolvedValue(0);

    await expect(canCreateMovingPlan("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "MOVING_PLAN_UPGRADE_REQUIRED",
      upgradeRequired: true,
    });
  });

  it("blocks an active free (completed) user from creating a moving plan with the upgrade signal", async () => {
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.movingPlanCount.mockResolvedValue(0);

    await expect(canCreateMovingPlan("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "MOVING_PLAN_UPGRADE_REQUIRED",
      upgradeRequired: true,
    });
  });

  it("applies the normal address cap to a moving-plan destination address (no setup bypass)", async () => {
    // Paid users reach this path; it just defers to canCreateAddress.
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "PRO",
      status: "ACTIVE",
      accessType: "PAID",
      provider: "STRIPE",
      currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });
    mocks.addressCount.mockResolvedValue(5);

    await expect(canCreateMovingDestinationAddress("user_1")).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("blocks a setup (fresh free, pre-completion) user from generating move tasks with the upgrade signal", async () => {
    // Fresh free user: no subscription row, onboarding not completed.
    mocks.subscriptionFindUnique.mockResolvedValue(null);
    mocks.userEventFindFirst.mockResolvedValue(null);
    mocks.movingPlanCount.mockResolvedValue(0);

    await expect(canGenerateMoveTasks("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "MOVING_PLAN_UPGRADE_REQUIRED",
      upgradeRequired: true,
    });
  });

  it("blocks an active free (completed) user from generating move tasks with the upgrade signal", async () => {
    mocks.userEventFindFirst.mockResolvedValue({ id: "evt_completed" });

    await expect(canGenerateMoveTasks("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "MOVING_PLAN_UPGRADE_REQUIRED",
      upgradeRequired: true,
    });
  });

  it("still blocks completed expired (lapsed) users from generating move tasks with their tier copy", async () => {
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

  it("resolves a paid-active Family subscription to Family limits (15/500)", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("FAMILY"));

    await expect(getUserPlan("user_1")).resolves.toMatchObject({
      plan: "FAMILY",
      isActive: true,
      hasPremium: true,
      limits: { maxAddresses: 15, maxServices: 500 },
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

  it("still enforces the Family service ceiling at 500", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("FAMILY"));
    mocks.serviceCount.mockResolvedValue(500);

    await expect(canCreateService("user_1")).resolves.toMatchObject({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      limit: 500,
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
      limits: { maxAddresses: 15, maxServices: 500 },
    });
  });

  it("uses the workspace owner's Family plan and workspace service count for members", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("FAMILY"));
    mocks.serviceCount.mockResolvedValue(249);

    await expect(
      canCreateService("member_1", { workspaceId: "ws_1", planOwnerUserId: "owner_1" }),
    ).resolves.toMatchObject({ allowed: true });

    expect(mocks.subscriptionFindUnique.mock.calls[0]?.[0]?.where?.userId).toBe("owner_1");
    expect(mocks.serviceCount).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws_1",
        ...ACTIVE_TRACKED_SERVICE_WHERE,
      },
    });
  });

  it("blocks a workspace member when the owner's Family workspace service limit is full", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("FAMILY"));
    mocks.serviceCount.mockResolvedValue(500);

    await expect(
      canCreateService("member_1", { workspaceId: "ws_1", planOwnerUserId: "owner_1" }),
    ).resolves.toMatchObject({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      current: 500,
      limit: 500,
    });
  });

  it("uses the workspace owner's Pro plan and workspace address count for members", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("PRO"));
    mocks.addressCount.mockResolvedValue(24);

    await expect(
      canCreateAddress("member_1", { workspaceId: "ws_1", planOwnerUserId: "owner_1" }),
    ).resolves.toMatchObject({ allowed: true });

    expect(mocks.addressCount).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1", deletedAt: null },
    });
  });

  it("resolves scoped plans directly through the owner user id", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("PRO"));

    await expect(getPlanForLimitScope("member_1", { planOwnerUserId: "owner_1" })).resolves.toMatchObject({
      plan: "PRO",
      isActive: true,
      hasPremium: true,
    });
    expect(mocks.subscriptionFindUnique.mock.calls[0]?.[0]?.where?.userId).toBe("owner_1");
  });

  it("allows a paid (Individual) user to create a moving plan", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("INDIVIDUAL"));

    await expect(canCreateMovingPlan("user_1")).resolves.toMatchObject({ allowed: true });
  });

  it("allows a paid (Family) user to create a moving plan", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("FAMILY"));

    await expect(canCreateMovingPlan("user_1")).resolves.toMatchObject({ allowed: true });
  });

  it("allows a paid (Pro) user to generate move tasks", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(paidActive("PRO"));

    await expect(canGenerateMoveTasks("user_1")).resolves.toMatchObject({ allowed: true });
  });
});
