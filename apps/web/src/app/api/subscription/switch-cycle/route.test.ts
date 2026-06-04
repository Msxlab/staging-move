import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  rateLimit: vi.fn(),
  getStripePriceIdForPlanAndInterval: vi.fn(),
  subscriptionUpdate: vi.fn(),
  stripeConstructor: vi.fn(),
  stripeSubscriptionsRetrieve: vi.fn(),
  stripeSubscriptionsUpdate: vi.fn(),
  stripeSchedulesCreate: vi.fn(),
  stripeSchedulesRetrieve: vi.fn(),
  stripeSchedulesRelease: vi.fn(),
  stripeSchedulesUpdate: vi.fn(),
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
  getRateLimitKey: vi.fn(() => "subscription-switch-key"),
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/billing", () => ({
  billingIntervalToCycle: (interval: string) => (interval === "YEAR" ? "yearly" : "monthly"),
  getStripePriceIdForPlanAndInterval: mocks.getStripePriceIdForPlanAndInterval,
}));
vi.mock("@/lib/billing-config", () => ({
  requireStripeSecretKeyForMutation: vi.fn((key: string) => key),
  buildStripeIdempotencyKey: vi.fn((parts: string[]) => `locateflow:test:${parts.join(":")}`),
}));
vi.mock("@/lib/sentry", () => ({ captureMessage: vi.fn() }));
vi.mock("@/lib/mobile-external-billing-guard", () => ({
  isMobileAppClient: vi.fn(() => false),
  mobileExternalBillingNotAllowedResponse: vi.fn(),
}));
vi.mock("stripe", () => ({ default: mocks.stripeConstructor }));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const subscriptionMock = prisma.subscription as unknown as {
  findUnique: Mock;
};

function switchRequest(targetInterval: "MONTH" | "YEAR", body: Record<string, unknown> = {}) {
  return new NextRequest("https://locateflow.com/api/subscription/switch-cycle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetInterval, acceptedSubscriptionTerms: true, ...body }),
  });
}

function stripeSubscription(priceId: string, interval: "month" | "year") {
  return {
    id: "sub_123",
    current_period_start: 1_700_000_000,
    current_period_end: 1_800_000_000,
    schedule: null,
    items: {
      data: [
        {
          id: "si_123",
          quantity: 1,
          price: { id: priceId, recurring: { interval } },
        },
      ],
    },
  };
}

describe("subscription switch-cycle route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_ENV = "staging";
    mocks.requireDbUserId.mockResolvedValue("user_1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getRuntimeConfigValue.mockResolvedValue("sk_test_123");
    mocks.getStripePriceIdForPlanAndInterval.mockImplementation(async (_plan: string, interval: string) =>
      interval === "YEAR" ? "price_yearly" : "price_monthly",
    );
    mocks.stripeSubscriptionsUpdate.mockResolvedValue({
      id: "sub_123",
      current_period_end: 1_900_000_000,
    });
    mocks.stripeSchedulesCreate.mockResolvedValue({
      id: "sched_123",
      current_phase: { start_date: 1_700_000_000, end_date: 1_800_000_000 },
    });
    mocks.stripeSchedulesUpdate.mockResolvedValue({ id: "sched_123" });
    mocks.stripeConstructor.mockImplementation(function StripeMock() {
      return {
        subscriptions: {
          retrieve: mocks.stripeSubscriptionsRetrieve,
          update: mocks.stripeSubscriptionsUpdate,
        },
        subscriptionSchedules: {
          create: mocks.stripeSchedulesCreate,
          retrieve: mocks.stripeSchedulesRetrieve,
          release: mocks.stripeSchedulesRelease,
          update: mocks.stripeSchedulesUpdate,
        },
      };
    });
  });

  it("upgrades monthly to annual immediately with prorations", async () => {
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      provider: "STRIPE",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      billingInterval: "MONTH",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_monthly",
      stripeSubscriptionScheduleId: null,
      currentPeriodEndsAt: null,
    });
    mocks.stripeSubscriptionsRetrieve.mockResolvedValue(
      stripeSubscription("price_monthly", "month"),
    );

    const response = await POST(switchRequest("YEAR"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ billingInterval: "YEAR", cycle: "yearly" });
    expect(mocks.stripeSchedulesCreate).not.toHaveBeenCalled();
    expect(mocks.stripeSubscriptionsUpdate).toHaveBeenCalledWith(
      "sub_123",
      {
        items: [{ id: "si_123", price: "price_yearly" }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
      },
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^locateflow:/) }),
    );
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        billingInterval: "YEAR",
        pendingBillingInterval: null,
        pendingBillingIntervalEffectiveAt: null,
        stripeSubscriptionScheduleId: null,
        stripePriceId: "price_yearly",
      }),
    });
  });

  it("rejects billing cycle switches without accepted subscription terms", async () => {
    const response = await POST(switchRequest("YEAR", { acceptedSubscriptionTerms: false }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: "TERMS_NOT_ACCEPTED" });
    expect(mocks.stripeSubscriptionsUpdate).not.toHaveBeenCalled();
    expect(mocks.stripeSchedulesUpdate).not.toHaveBeenCalled();
  });

  it("schedules annual to monthly for the paid period end without changing the current price", async () => {
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      provider: "STRIPE",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      billingInterval: "YEAR",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_yearly",
      stripeSubscriptionScheduleId: null,
      currentPeriodEndsAt: null,
    });
    mocks.stripeSubscriptionsRetrieve.mockResolvedValue(
      stripeSubscription("price_yearly", "year"),
    );

    const response = await POST(switchRequest("MONTH"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      billingInterval: "YEAR",
      cycle: "yearly",
      pendingBillingInterval: "MONTH",
      scheduled: true,
    });
    expect(mocks.stripeSubscriptionsUpdate).not.toHaveBeenCalled();
    expect(mocks.stripeSchedulesCreate).toHaveBeenCalledWith({
      from_subscription: "sub_123",
    });
    expect(mocks.stripeSchedulesUpdate).toHaveBeenCalledWith(
      "sched_123",
      {
        end_behavior: "release",
        proration_behavior: "none",
        metadata: {
          locateflow_user_id: "user_1",
          locateflow_pending_billing_interval: "MONTH",
        },
        phases: [
          {
            start_date: 1_700_000_000,
            end_date: 1_800_000_000,
            items: [{ price: "price_yearly", quantity: 1 }],
            proration_behavior: "none",
            metadata: {
              billingInterval: "YEAR",
              pendingBillingInterval: "MONTH",
            },
          },
          {
            iterations: 1,
            items: [{ price: "price_monthly", quantity: 1 }],
            billing_cycle_anchor: "phase_start",
            proration_behavior: "none",
            metadata: {
              billingInterval: "MONTH",
              pendingBillingInterval: "",
            },
          },
        ],
      },
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^locateflow:/) }),
    );
    const updateArgs = mocks.subscriptionUpdate.mock.calls[0][0];
    expect(updateArgs.data.billingInterval).toBeUndefined();
    expect(updateArgs.data.stripePriceId).toBeUndefined();
    expect(updateArgs.data).toMatchObject({
      stripeSubscriptionScheduleId: "sched_123",
      pendingBillingInterval: "MONTH",
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      autoRenew: true,
    });
  });

  it("schedules annual to monthly using the local period end when Stripe omits period fields", async () => {
    const futureUnix = Math.floor((Date.now() + 365 * 86_400_000) / 1000);
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      provider: "STRIPE",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      billingInterval: "YEAR",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_yearly",
      stripeSubscriptionScheduleId: null,
      currentPeriodEndsAt: new Date(futureUnix * 1000),
    });
    mocks.stripeSubscriptionsRetrieve.mockResolvedValue({
      ...stripeSubscription("price_yearly", "year"),
      current_period_start: null,
      current_period_end: null,
    });

    const response = await POST(switchRequest("MONTH"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      billingInterval: "YEAR",
      pendingBillingInterval: "MONTH",
      scheduled: true,
    });
    expect(mocks.stripeSubscriptionsUpdate).not.toHaveBeenCalled();
    expect(mocks.stripeSchedulesUpdate).toHaveBeenCalledWith(
      "sched_123",
      expect.objectContaining({
        phases: expect.arrayContaining([
          expect.objectContaining({ end_date: futureUnix }),
        ]),
      }),
      expect.anything(),
    );
  });

  it("releases the Stripe schedule when the pending-interval DB write fails on missing columns", async () => {
    // Regression: the previous fallback silently wrote a reduced payload
    // and returned `scheduled: true` to the client, leaving an orphan
    // Stripe schedule that the webhook had no way to reconcile.
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      provider: "STRIPE",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      billingInterval: "YEAR",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_yearly",
      stripeSubscriptionScheduleId: null,
      currentPeriodEndsAt: null,
    });
    mocks.stripeSubscriptionsRetrieve.mockResolvedValue(
      stripeSubscription("price_yearly", "year"),
    );
    const missingColumnError = Object.assign(
      new Error("Unknown column 'pendingBillingInterval'"),
      { code: "P2022", meta: { column: "Subscription.pendingBillingInterval" } },
    );
    mocks.subscriptionUpdate.mockRejectedValueOnce(missingColumnError);

    const response = await POST(switchRequest("MONTH"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ code: "PENDING_INTERVAL_PERSIST_FAILED" });
    expect(mocks.stripeSchedulesRelease).toHaveBeenCalledWith("sched_123");
  });

  it("falls through to immediate swap when the annual period has already ended", async () => {
    // Last-hours edge: rejecting with 409 left the user stuck while
    // Stripe auto-renewed the yearly plan. Now we fall through.
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      provider: "STRIPE",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      billingInterval: "YEAR",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_yearly",
      stripeSubscriptionScheduleId: null,
      currentPeriodEndsAt: null,
    });
    const expiredSub = {
      ...stripeSubscription("price_yearly", "year"),
      current_period_end: Math.floor(Date.now() / 1000) - 60,
    };
    mocks.stripeSubscriptionsRetrieve.mockResolvedValue(expiredSub);

    const response = await POST(switchRequest("MONTH"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ billingInterval: "MONTH", cycle: "monthly" });
    expect(mocks.stripeSchedulesUpdate).not.toHaveBeenCalled();
    expect(mocks.stripeSubscriptionsUpdate).toHaveBeenCalledWith(
      "sub_123",
      expect.objectContaining({
        items: [{ id: "si_123", price: "price_monthly" }],
        proration_behavior: "create_prorations",
      }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^locateflow:/) }),
    );
  });
});
