import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    userEvent: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireVerifiedUser: vi.fn(),
}));

vi.mock("@/lib/plan-limits", () => ({
  getUserPlan: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/plan-limits";
import {
  ApiGateError,
  apiGateErrorResponse,
  entitlementErrorResponse,
  requireAppMutationUser,
} from "./api-gates";

const requireVerifiedUserMock = requireVerifiedUser as unknown as Mock;
const getUserPlanMock = getUserPlan as unknown as Mock;
const userEventMock = prisma.userEvent as unknown as { findMany: Mock };

describe("api gate helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireVerifiedUserMock.mockResolvedValue("user-1");
    userEventMock.findMany.mockResolvedValue([
      {
        metadata: JSON.stringify({
          termsAccepted: true,
          disclaimerAccepted: true,
        }),
      },
    ]);
    getUserPlanMock.mockResolvedValue({ isActive: true, hasPremium: true });
  });

  it.each([
    ["UNAUTHORIZED", 401],
    ["EMAIL_VERIFICATION_REQUIRED", 403],
    ["LEGAL_ACCEPTANCE_REQUIRED", 403],
    ["SUBSCRIPTION_REQUIRED", 403],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
  ] as const)("maps %s to a structured response", async (code, status) => {
    const response = apiGateErrorResponse(new Error(code))!;
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body.code).toBe(code);
    expect(body.error).toEqual(expect.any(String));
  });

  it("requires legal acceptance after verified auth", async () => {
    userEventMock.findMany.mockResolvedValueOnce([]);

    await expect(requireAppMutationUser()).rejects.toMatchObject({
      code: "LEGAL_ACCEPTANCE_REQUIRED",
    });
  });

  it("can require an active subscription for paid mutation surfaces", async () => {
    getUserPlanMock.mockResolvedValueOnce({ isActive: false, hasPremium: false });

    await expect(requireAppMutationUser({ requireActiveSubscription: true })).rejects.toMatchObject({
      code: "SUBSCRIPTION_REQUIRED",
    });
  });

  it("can require premium access separately from active Free Access", async () => {
    getUserPlanMock.mockResolvedValueOnce({ isActive: true, hasPremium: false });

    await expect(requireAppMutationUser({
      requirePremium: true,
      subscriptionMessage: "A paid subscription is required.",
    })).rejects.toMatchObject({
      code: "SUBSCRIPTION_REQUIRED",
      publicMessage: "A paid subscription is required.",
    });
  });

  it("normalizes inactive entitlement failures to SUBSCRIPTION_REQUIRED", async () => {
    const response = entitlementErrorResponse(
      {
        allowed: false,
        code: "TRIAL_EXPIRED",
        reason: "Your trial has ended.",
        upgradeRequired: true,
      },
      "ADDRESS_LIMIT_REACHED",
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("SUBSCRIPTION_REQUIRED");
    expect(body.entitlementCode).toBe("TRIAL_EXPIRED");
  });

  it("passes MOVING_PLAN_UPGRADE_REQUIRED through verbatim (not normalized to SUBSCRIPTION_REQUIRED)", async () => {
    // The freemium move paywall must reach the client with its own code +
    // upgradeRequired so the teaser/Unlock CTA renders instead of a generic
    // subscription error.
    const response = entitlementErrorResponse(
      {
        allowed: false,
        code: "MOVING_PLAN_UPGRADE_REQUIRED",
        reason: "Upgrade to Individual to unlock your full move plan.",
        upgradeRequired: true,
      },
      "MOVING_PLAN_LIMIT_REACHED",
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("MOVING_PLAN_UPGRADE_REQUIRED");
    expect(body.upgradeRequired).toBe(true);
    expect(body.entitlementCode).toBe("MOVING_PLAN_UPGRADE_REQUIRED");
  });

  it("preserves explicit ApiGateError messages", async () => {
    const response = apiGateErrorResponse(new ApiGateError("FORBIDDEN", "Custom message"))!;
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Custom message");
  });
});
