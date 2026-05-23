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

function switchRequest(targetInterval: "MONTH" | "YEAR") {
  return new NextRequest("https://locateflow.com/api/subscription/switch-cycle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetInterval }),
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
    expect(mocks.stripeSubscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
      items: [{ id: "si_123", price: "price_yearly" }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
    });
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
    expect(mocks.stripeSchedulesUpdate).toHaveBeenCalledWith("sched_123", {
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
    });
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
});
