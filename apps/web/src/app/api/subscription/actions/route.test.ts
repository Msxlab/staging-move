import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  rateLimit: vi.fn(),
  subscriptionUpdate: vi.fn(),
  stripeConstructor: vi.fn(),
  stripeSubscriptionsUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      update: (...args: unknown[]) => mocks.subscriptionUpdate(...args),
    },
  },
}));
vi.mock("@/lib/auth", () => ({ requireDbUserId: mocks.requireDbUserId }));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: mocks.getRuntimeConfigValue }));
vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "subscription-action-key"),
  rateLimit: mocks.rateLimit,
}));
vi.mock("stripe", () => ({ default: mocks.stripeConstructor }));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const subscriptionMock = prisma.subscription as unknown as {
  findUnique: Mock;
};

function actionRequest(action: string, extraBody: Record<string, unknown> = {}) {
  return new NextRequest("https://locateflow.com/api/subscription/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...extraBody }),
  });
}

describe("subscription actions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_ENV = "staging";
    mocks.requireDbUserId.mockResolvedValue("user_1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => {
      if (key === "STRIPE_SECRET_KEY") return "sk_test_123";
      return null;
    });
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      status: "TRIALING",
      accessType: "FREE_TRIAL",
      stripeSubscriptionId: "sub_123",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      currentPeriodEndsAt: null,
    });
    mocks.stripeSubscriptionsUpdate.mockResolvedValue({
      id: "sub_123",
      current_period_end: 1_800_000_000,
    });
    mocks.stripeConstructor.mockImplementation(function StripeMock() {
      return {
        subscriptions: { update: mocks.stripeSubscriptionsUpdate },
      };
    });
  });

  it("cancels a trial by turning off renewal and keeping access until trial end", async () => {
    const response = await POST(actionRequest("cancel_trial"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("TRIAL_CANCELED");
    expect(mocks.stripeSubscriptionsUpdate).toHaveBeenCalledWith(
      "sub_123",
      { cancel_at_period_end: true },
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^locateflow:/) }),
    );
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        status: "TRIAL_CANCELED",
        cancelAtPeriodEnd: true,
        autoRenew: false,
      }),
    });
  });

  it("resumes renewal when Stripe allows cancel_at_period_end to be cleared", async () => {
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      status: "TRIAL_CANCELED",
      stripeSubscriptionId: "sub_123",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const response = await POST(actionRequest("resume_renewal"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "TRIALING", autoRenew: true });
    expect(mocks.stripeSubscriptionsUpdate).toHaveBeenCalledWith(
      "sub_123",
      { cancel_at_period_end: false },
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^locateflow:/) }),
    );
  });

  it("persists survey reason and comment when the cancel modal submits them", async () => {
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      status: "ACTIVE",
      stripeSubscriptionId: "sub_123",
      trialEndsAt: null,
      currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await POST(
      actionRequest("cancel_renewal", {
        cancelReason: "too_expensive",
        cancelReasonComment: "  Premium pricing exceeds my budget right now.  ",
      }),
    );

    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        status: "CANCEL_AT_PERIOD_END",
        cancelReason: "too_expensive",
        cancelReasonComment: "Premium pricing exceeds my budget right now.",
      }),
    });
  });

  it("does NOT overwrite an existing cancel reason when the user skips the survey", async () => {
    // Regression: user cancels with reason → resumes → recancels via Skip.
    // The recancel must not clobber the original reason with null.
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      status: "ACTIVE",
      stripeSubscriptionId: "sub_123",
      trialEndsAt: null,
      currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await POST(actionRequest("cancel_renewal"));

    const updateCall = mocks.subscriptionUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("cancelReason");
    expect(updateCall.data).not.toHaveProperty("cancelReasonComment");
    expect(updateCall.data).toMatchObject({
      status: "CANCEL_AT_PERIOD_END",
      cancelAtPeriodEnd: true,
    });
  });

  it("falls back to base update when the new cancelReason columns do not exist yet", async () => {
    // Rolling-deploy guard: the migration that adds cancelReason/columns
    // may land after this commit ships. The cancel path must still succeed.
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      status: "ACTIVE",
      stripeSubscriptionId: "sub_123",
      trialEndsAt: null,
      currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    const missingColumnError = Object.assign(new Error("Unknown column 'cancelReason'"), {
      code: "P2022",
      meta: { column: "Subscription.cancelReason" },
    });
    mocks.subscriptionUpdate
      .mockRejectedValueOnce(missingColumnError)
      .mockResolvedValueOnce({});

    const response = await POST(
      actionRequest("cancel_renewal", { cancelReason: "too_expensive" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.subscriptionUpdate).toHaveBeenCalledTimes(2);
    const fallbackCall = mocks.subscriptionUpdate.mock.calls[1][0];
    expect(fallbackCall.data).not.toHaveProperty("cancelReason");
    expect(fallbackCall.data).toMatchObject({
      status: "CANCEL_AT_PERIOD_END",
      cancelAtPeriodEnd: true,
    });
  });
});
