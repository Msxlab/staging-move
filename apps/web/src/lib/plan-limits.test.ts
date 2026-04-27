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
  canCreateAddress,
  canCreateCustomProvider,
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

  it("treats a missing subscription row as an active default trial", async () => {
    await expect(getUserPlan("user_1")).resolves.toMatchObject({
      plan: "FREE_TRIAL",
      status: "TRIALING",
      isActive: true,
      isTrialExpired: false,
    });
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
    // Setup user (no ONBOARDING_COMPLETED_EVENT, expired legacy trial)
    // who already created their one allowed setup move plan should see
    // the setup-specific code, not a misleading TRIAL_EXPIRED message.
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

  it("allows setup users to generate move tasks for their first plan", async () => {
    // canCreateMovingPlan already capped the plan count, so mirroring
    // that allowance for /api/move-tasks unblocks the onboarding flow
    // without widening the abuse surface.
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
