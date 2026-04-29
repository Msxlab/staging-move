import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: { findUnique: vi.fn() },
    movingPlan: { findMany: vi.fn() },
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

import { requireAppMutationUser } from "@/lib/api-gates";
import { canCreateMovingPlan } from "@/lib/plan-limits";
import { POST } from "./route";

const requireAppMutationUserMock = requireAppMutationUser as unknown as Mock;
const canCreateMovingPlanMock = canCreateMovingPlan as unknown as Mock;

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
});
