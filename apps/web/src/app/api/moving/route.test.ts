import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: { findUnique: vi.fn() },
    movingPlan: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
    userEvent: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
  requireVerifiedUser: vi.fn(),
}));

vi.mock("@/lib/api-gates", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-gates")>("@/lib/api-gates");
  return {
    ...actual,
    requireAppMutationUser: vi.fn(),
  };
});

vi.mock("@/lib/plan-limits", async () => {
  const actual = await vi.importActual<typeof import("@/lib/plan-limits")>("@/lib/plan-limits");
  return {
    ...actual,
    canCreateMovingPlan: vi.fn(),
    canCreateMovingDestinationAddress: vi.fn(),
    // getPlanForLimitScope mocked (no DB) — it's what the concurrent-plan gate
    // calls to resolve the workspace OWNER's tier. planFeatures stays REAL so
    // the gate exercises the actual @locateflow/shared limit (Pro=3, others=1).
    getPlanForLimitScope: vi.fn(),
  };
});

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "moving-rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/move-task-sync", () => ({
  syncMoveTasksForPlans: vi.fn(() => Promise.resolve({ attemptedPlans: 0 })),
}));

vi.mock("@/lib/shared-encryption", () => ({
  encrypt: vi.fn((value: string) => `enc:${value}`),
}));

import { prisma } from "@/lib/db";
import { requireAppMutationUser } from "@/lib/api-gates";
import { canCreateMovingPlan, canCreateMovingDestinationAddress, getPlanForLimitScope } from "@/lib/plan-limits";
import { POST } from "./route";

const requireAppMutationUserMock = requireAppMutationUser as unknown as Mock;
const canCreateMovingPlanMock = canCreateMovingPlan as unknown as Mock;
const canCreateMovingDestinationAddressMock = canCreateMovingDestinationAddress as unknown as Mock;
const getPlanForLimitScopeMock = getPlanForLimitScope as unknown as Mock;
const movingPlanCountMock = prisma.movingPlan.count as unknown as Mock;
const addressFindUniqueMock = prisma.address.findUnique as unknown as Mock;
const transactionMock = prisma.$transaction as unknown as Mock;

function movingRequest() {
  return POST(
    new Request("http://localhost/api/moving", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromAddressId: "addr-1",
        toAddressId: "addr-2",
        moveDate: "2026-06-01",
      }),
    }) as any,
  );
}

describe("moving mutation gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppMutationUserMock.mockResolvedValue("user-1");
    canCreateMovingPlanMock.mockResolvedValue({ allowed: true });
    canCreateMovingDestinationAddressMock.mockResolvedValue({ allowed: true });
    // Default: Individual plan with no active plans yet (under the limit of 1).
    getPlanForLimitScopeMock.mockResolvedValue({ plan: "INDIVIDUAL" });
    movingPlanCountMock.mockResolvedValue(0);
  });

  it.each([
    ["UNAUTHORIZED", 401],
    ["EMAIL_VERIFICATION_REQUIRED", 403],
    ["LEGAL_ACCEPTANCE_REQUIRED", 403],
  ])("returns a structured %s gate response", async (code, status) => {
    requireAppMutationUserMock.mockRejectedValueOnce(new Error(code));

    const response = await movingRequest();
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body.code).toBe(code);
  });

  it("normalizes inactive-plan moving failures to SUBSCRIPTION_REQUIRED", async () => {
    canCreateMovingPlanMock.mockResolvedValueOnce({
      allowed: false,
      code: "SUBSCRIPTION_INACTIVE",
      reason: "Your subscription is not active.",
      upgradeRequired: true,
    });

    const response = await movingRequest();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("SUBSCRIPTION_REQUIRED");
    expect(body.entitlementCode).toBe("SUBSCRIPTION_INACTIVE");
  });

  it("passes the freemium MOVING_PLAN_UPGRADE_REQUIRED code through verbatim with upgradeRequired", async () => {
    // The move plan is the paid unlock — a free user trying to create one must
    // get the upgrade signal (not a generic subscription-required), so the
    // client can show the teaser/Unlock CTA rather than a dead-end error.
    canCreateMovingPlanMock.mockResolvedValueOnce({
      allowed: false,
      code: "MOVING_PLAN_UPGRADE_REQUIRED",
      reason: "Upgrade to Individual to unlock your full move plan.",
      upgradeRequired: true,
    });

    const response = await movingRequest();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("MOVING_PLAN_UPGRADE_REQUIRED");
    expect(body.upgradeRequired).toBe(true);
  });

  describe("concurrent-plan gate", () => {
    it("returns the CONCURRENT_PLAN_LIMIT teaser (200) when a non-Pro plan already has an active plan", async () => {
      getPlanForLimitScopeMock.mockResolvedValue({ plan: "INDIVIDUAL" });
      movingPlanCountMock.mockResolvedValue(1); // at the limit of 1

      const response = await movingRequest();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        configured: true,
        entitled: false,
        upgradeRequired: "CONCURRENT_PLAN_LIMIT",
      });
      // Gated before any address work or transaction.
      expect(addressFindUniqueMock).not.toHaveBeenCalled();
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it("counts only active (non-archived) plans — PLANNING/IN_PROGRESS, not soft-deleted", async () => {
      movingPlanCountMock.mockResolvedValue(1);
      await movingRequest();

      const where = movingPlanCountMock.mock.calls[0][0].where;
      expect(where.deletedAt).toBeNull();
      expect(where.status).toEqual({ in: ["PLANNING", "IN_PROGRESS"] });
    });

    it("lets a non-Pro plan with zero active plans past the gate (reaches address lookup)", async () => {
      getPlanForLimitScopeMock.mockResolvedValue({ plan: "FAMILY" });
      movingPlanCountMock.mockResolvedValue(0);
      addressFindUniqueMock.mockResolvedValue(null); // origin not found → 404 past the gate

      const response = await movingRequest();
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe("Origin address not found");
      expect(addressFindUniqueMock).toHaveBeenCalled();
    });

    it("allows Pro up to 3 concurrent active plans (teaser only at the 3rd)", async () => {
      getPlanForLimitScopeMock.mockResolvedValue({ plan: "PRO" });
      addressFindUniqueMock.mockResolvedValue(null); // reach 404 when past the gate

      // 2 active plans → still under the Pro limit of 3 → past the gate.
      movingPlanCountMock.mockResolvedValue(2);
      expect((await movingRequest()).status).toBe(404);

      // 3 active plans → at the Pro limit → teaser.
      vi.clearAllMocks();
      requireAppMutationUserMock.mockResolvedValue("user-1");
      canCreateMovingPlanMock.mockResolvedValue({ allowed: true });
      getPlanForLimitScopeMock.mockResolvedValue({ plan: "PRO" });
      movingPlanCountMock.mockResolvedValue(3);

      const response = await movingRequest();
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.upgradeRequired).toBe("CONCURRENT_PLAN_LIMIT");
    });
  });
});
