import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  rateLimit: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  getStripePriceIdForPlanAndInterval: vi.fn(),
  mapStripePriceIdToPlanAndInterval: vi.fn(),
  reconcileSeatsForOwner: vi.fn(),
  subFindUnique: vi.fn(),
  subUpdate: vi.fn(),
  subsRetrieve: vi.fn(),
  subsUpdate: vi.fn(),
  schedCreate: vi.fn(),
  schedRetrieve: vi.fn(),
  schedUpdate: vi.fn(),
  schedRelease: vi.fn(),
  stripeCtor: vi.fn(),
  isMobile: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireDbUserId: mocks.requireDbUserId }));
vi.mock("@/lib/db", () => ({
  prisma: { subscription: { findUnique: mocks.subFindUnique, update: mocks.subUpdate } },
}));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: mocks.getRuntimeConfigValue }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit, getRateLimitKey: () => "k" }));
vi.mock("@/lib/billing-config", () => ({
  buildStripeIdempotencyKey: (parts: unknown[]) => `locateflow:${parts.join(":")}`,
  requireStripeSecretKeyForMutation: (k: string) => k,
}));
vi.mock("@/lib/billing", () => ({
  getStripePriceIdForPlanAndInterval: mocks.getStripePriceIdForPlanAndInterval,
  mapStripePriceIdToPlanAndInterval: mocks.mapStripePriceIdToPlanAndInterval,
  billingIntervalToCycle: (i: string) => (i === "YEAR" ? "yearly" : "monthly"),
}));
vi.mock("@/lib/shared-billing", () => ({
  isPaidBillingPlan: (p: string) => p === "INDIVIDUAL" || p === "FAMILY" || p === "PRO",
}));
vi.mock("@/lib/workspace-ownership", () => ({ reconcileSeatsForOwner: mocks.reconcileSeatsForOwner }));
vi.mock("@/lib/sentry", () => ({ captureMessage: vi.fn() }));
vi.mock("@/lib/mobile-external-billing-guard", () => ({
  isMobileAppClient: mocks.isMobile,
  mobileExternalBillingNotAllowedResponse: () =>
    new Response(JSON.stringify({ code: "MOBILE_EXTERNAL_BILLING_NOT_ALLOWED" }), { status: 403 }),
}));
vi.mock("@/lib/db-schema-compat", () => ({
  isMissingDbColumnError: () => false,
  warnSchemaCompatibilityFallback: vi.fn(),
}));
vi.mock("stripe", () => ({ default: mocks.stripeCtor }));

import { POST } from "./route";

const FUTURE_UNIX = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000);
const PLAN_RANK: Record<string, number> = { INDIVIDUAL: 1, FAMILY: 2, PRO: 3 };
const PAID_PLANS = ["INDIVIDUAL", "FAMILY", "PRO"] as const;
const INTERVALS = ["MONTH", "YEAR"] as const;
const FLEXIBLE_BILLING_API_VERSION = "2025-04-30.preview";

const PLAN_CHANGE_MATRIX = PAID_PLANS.flatMap((currentPlan) =>
  INTERVALS.flatMap((currentInterval) =>
    PAID_PLANS.flatMap((targetPlan) =>
      INTERVALS
        .filter((targetInterval) => targetPlan !== currentPlan || targetInterval !== currentInterval)
        .map((targetInterval) => {
          const isReduction =
            PLAN_RANK[targetPlan] < PLAN_RANK[currentPlan] ||
            (PLAN_RANK[targetPlan] === PLAN_RANK[currentPlan] &&
              currentInterval === "YEAR" &&
              targetInterval === "MONTH");
          return {
            currentPlan,
            currentInterval,
            targetPlan,
            targetInterval,
            expectedApplied: isReduction ? "scheduled" : "immediate",
          };
        }),
    ),
  ),
);

function req(body: unknown, headers?: Record<string, string>) {
  return new NextRequest("https://locateflow.com/api/subscription/change-plan", {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers || {}) },
    body: JSON.stringify({ acceptedSubscriptionTerms: true, ...(body as Record<string, unknown>) }),
  });
}

describe("change-plan route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMobile.mockReturnValue(false);
    mocks.requireDbUserId.mockResolvedValue("user_1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getRuntimeConfigValue.mockResolvedValue("sk_test_123");
    mocks.getStripePriceIdForPlanAndInterval.mockResolvedValue("price_target");
    mocks.mapStripePriceIdToPlanAndInterval.mockResolvedValue(null);
    mocks.reconcileSeatsForOwner.mockResolvedValue(undefined);
    mocks.subUpdate.mockResolvedValue({});
    mocks.subsRetrieve.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ id: "si_1", price: { id: "price_current" }, quantity: 1 }] },
      current_period_start: FUTURE_UNIX - 30 * 24 * 60 * 60,
      current_period_end: FUTURE_UNIX,
    });
    mocks.subsUpdate.mockResolvedValue({ current_period_end: FUTURE_UNIX });
    mocks.schedCreate.mockResolvedValue({ id: "sched_1", current_phase: { start_date: FUTURE_UNIX - 30 * 24 * 60 * 60 } });
    mocks.schedRetrieve.mockResolvedValue({ id: "sched_1", current_phase: { start_date: FUTURE_UNIX - 30 * 24 * 60 * 60 } });
    mocks.schedUpdate.mockResolvedValue({});
    mocks.schedRelease.mockResolvedValue({});
    mocks.stripeCtor.mockImplementation(function StripeMock() {
      return {
        subscriptions: { retrieve: mocks.subsRetrieve, update: mocks.subsUpdate },
        subscriptionSchedules: {
          create: mocks.schedCreate,
          retrieve: mocks.schedRetrieve,
          update: mocks.schedUpdate,
          release: mocks.schedRelease,
        },
      };
    });
    // Default current subscription: active monthly Individual.
    mocks.subFindUnique.mockResolvedValue({
      userId: "user_1",
      plan: "INDIVIDUAL",
      provider: "STRIPE",
      status: "ACTIVE",
      billingInterval: "MONTH",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_current",
      currentPeriodEndsAt: new Date(FUTURE_UNIX * 1000),
      version: 1,
    });
  });

  it("upgrades Individual → Pro immediately with proration", async () => {
    const res = await POST(req({ targetPlan: "PRO", targetInterval: "MONTH" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ applied: "immediate", plan: "PRO" });
    expect(mocks.subsUpdate).toHaveBeenCalledWith(
      "sub_123",
      expect.objectContaining({
        items: [{ id: "si_1", price: "price_target" }],
        proration_behavior: "create_prorations",
      }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^locateflow:/) }),
    );
    expect(mocks.schedUpdate).not.toHaveBeenCalled();
    expect(mocks.reconcileSeatsForOwner).toHaveBeenCalledWith("user_1");
  });

  it("defers a Pro → Individual downgrade to period end via a schedule", async () => {
    mocks.subFindUnique.mockResolvedValue({
      userId: "user_1",
      plan: "PRO",
      provider: "STRIPE",
      status: "ACTIVE",
      billingInterval: "MONTH",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_current",
      currentPeriodEndsAt: new Date(FUTURE_UNIX * 1000),
      version: 1,
    });

    const res = await POST(req({ targetPlan: "INDIVIDUAL", targetInterval: "MONTH" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ applied: "scheduled", pendingPlan: "INDIVIDUAL", plan: "PRO" });
    expect(mocks.schedUpdate).toHaveBeenCalled();
    // Downgrade must not change the live subscription item immediately.
    expect(mocks.subsUpdate).not.toHaveBeenCalled();
  });

  it("defers a Pro to Family downgrade to period end and stores the pending plan", async () => {
    mocks.subFindUnique.mockResolvedValue({
      userId: "user_1",
      plan: "PRO",
      provider: "STRIPE",
      status: "ACTIVE",
      billingInterval: "YEAR",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_current",
      currentPeriodEndsAt: new Date(FUTURE_UNIX * 1000),
      version: 1,
    });

    const res = await POST(req({ targetPlan: "FAMILY", targetInterval: "YEAR" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      applied: "scheduled",
      plan: "PRO",
      pendingPlan: "FAMILY",
      pendingBillingInterval: "YEAR",
    });
    expect(mocks.subsUpdate).not.toHaveBeenCalled();
    expect(mocks.schedUpdate).toHaveBeenCalledWith(
      "sched_1",
      expect.objectContaining({
        proration_behavior: "none",
        metadata: expect.objectContaining({
          locateflow_pending_plan: "FAMILY",
          locateflow_pending_billing_interval: "YEAR",
        }),
      }),
      expect.objectContaining({
        apiVersion: FLEXIBLE_BILLING_API_VERSION,
        idempotencyKey: expect.stringMatching(/^locateflow:/),
      }),
    );
    expect(mocks.subUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        pendingPlan: "FAMILY",
        pendingBillingInterval: "YEAR",
        stripeSubscriptionScheduleId: "sched_1",
      }),
    });
  });

  it("defers a downgrade using the local period end when Stripe retrieve omits period fields", async () => {
    mocks.subFindUnique.mockResolvedValue({
      userId: "user_1",
      plan: "PRO",
      provider: "STRIPE",
      status: "ACTIVE",
      billingInterval: "YEAR",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_current",
      currentPeriodEndsAt: new Date(FUTURE_UNIX * 1000),
      version: 1,
    });
    mocks.subsRetrieve.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ id: "si_1", price: { id: "price_current" }, quantity: 1 }] },
      current_period_start: null,
      current_period_end: null,
    });

    const res = await POST(req({ targetPlan: "FAMILY", targetInterval: "YEAR" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      applied: "scheduled",
      pendingPlan: "FAMILY",
      pendingBillingInterval: "YEAR",
    });
    expect(mocks.subsUpdate).not.toHaveBeenCalled();
    expect(mocks.schedUpdate).toHaveBeenCalledWith(
      "sched_1",
      expect.objectContaining({
        phases: expect.arrayContaining([
          expect.objectContaining({ end_date: FUTURE_UNIX }),
        ]),
      }),
      expect.objectContaining({ apiVersion: FLEXIBLE_BILLING_API_VERSION }),
    );
  });

  it("uses the current Stripe price mapping when the stored billing interval is missing", async () => {
    mocks.subFindUnique.mockResolvedValue({
      userId: "user_1",
      plan: "PRO",
      provider: "STRIPE",
      status: "ACTIVE",
      billingInterval: null,
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_current",
      currentPeriodEndsAt: new Date(FUTURE_UNIX * 1000),
      version: 1,
    });
    mocks.mapStripePriceIdToPlanAndInterval.mockResolvedValue({
      plan: "PRO",
      billingInterval: "YEAR",
    });
    mocks.subsRetrieve.mockResolvedValue({
      id: "sub_123",
      items: { data: [{ id: "si_1", price: { id: "price_current" }, quantity: 1 }] },
      current_period_start: null,
      current_period_end: null,
    });

    const res = await POST(req({ targetPlan: "FAMILY", targetInterval: "YEAR" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      applied: "scheduled",
      plan: "PRO",
      pendingPlan: "FAMILY",
      pendingBillingInterval: "YEAR",
    });
    expect(mocks.subsUpdate).not.toHaveBeenCalled();
    expect(mocks.schedUpdate).toHaveBeenCalled();
  });

  it("defers a Family to Individual downgrade to period end", async () => {
    mocks.subFindUnique.mockResolvedValue({
      userId: "user_1",
      plan: "FAMILY",
      provider: "STRIPE",
      status: "ACTIVE",
      billingInterval: "MONTH",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_current",
      currentPeriodEndsAt: new Date(FUTURE_UNIX * 1000),
      version: 1,
    });

    const res = await POST(req({ targetPlan: "INDIVIDUAL", targetInterval: "MONTH" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      applied: "scheduled",
      plan: "FAMILY",
      pendingPlan: "INDIVIDUAL",
      pendingBillingInterval: "MONTH",
    });
    expect(mocks.subsUpdate).not.toHaveBeenCalled();
    expect(mocks.subUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        pendingPlan: "INDIVIDUAL",
        pendingBillingInterval: "MONTH",
      }),
    });
  });

  it.each(PLAN_CHANGE_MATRIX)(
    "$currentPlan $currentInterval -> $targetPlan $targetInterval is $expectedApplied",
    async ({ currentPlan, currentInterval, targetPlan, targetInterval, expectedApplied }) => {
      mocks.subFindUnique.mockResolvedValue({
        userId: "user_1",
        plan: currentPlan,
        provider: "STRIPE",
        status: "ACTIVE",
        billingInterval: currentInterval,
        stripeSubscriptionId: "sub_123",
        stripePriceId: "price_current",
        currentPeriodEndsAt: new Date(FUTURE_UNIX * 1000),
        version: 1,
      });

      const res = await POST(req({ targetPlan, targetInterval }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({ applied: expectedApplied });
      if (expectedApplied === "scheduled") {
        expect(body).toMatchObject({
          plan: currentPlan,
          pendingPlan: targetPlan,
          pendingBillingInterval: targetInterval,
        });
        expect(mocks.subsUpdate).not.toHaveBeenCalled();
        expect(mocks.schedUpdate).toHaveBeenCalled();
      } else {
        expect(body).toMatchObject({
          plan: targetPlan,
          billingInterval: targetInterval,
        });
        expect(mocks.subsUpdate).toHaveBeenCalledWith(
          "sub_123",
          expect.objectContaining({
            items: [{ id: "si_1", price: "price_target" }],
            proration_behavior: "create_prorations",
          }),
          expect.objectContaining({ idempotencyKey: expect.stringMatching(/^locateflow:/) }),
        );
        expect(mocks.schedUpdate).not.toHaveBeenCalled();
      }
    },
  );

  it("returns 503 when the target plan price is not configured", async () => {
    mocks.getStripePriceIdForPlanAndInterval.mockResolvedValue(null);
    const res = await POST(req({ targetPlan: "FAMILY", targetInterval: "MONTH" }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({ code: "PLAN_NOT_AVAILABLE" });
  });

  it("rejects when there is no Stripe subscription to change", async () => {
    mocks.subFindUnique.mockResolvedValue({ userId: "user_1", plan: "FREE_TRIAL", provider: "TRIAL", status: "FREE_ACCESS" });
    const res = await POST(req({ targetPlan: "PRO" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({ code: "NO_STRIPE_SUBSCRIPTION" });
  });

  it("rejects a no-op change to the same plan and interval", async () => {
    const res = await POST(req({ targetPlan: "INDIVIDUAL", targetInterval: "MONTH" }));
    expect(res.status).toBe(400);
  });

  it("rejects plan changes without accepted subscription terms", async () => {
    const res = await POST(req({ targetPlan: "PRO", targetInterval: "MONTH", acceptedSubscriptionTerms: false }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({ code: "TERMS_NOT_ACCEPTED" });
    expect(mocks.subsUpdate).not.toHaveBeenCalled();
    expect(mocks.schedUpdate).not.toHaveBeenCalled();
  });

  it("blocks mobile app clients (external billing)", async () => {
    mocks.isMobile.mockReturnValue(true);
    const res = await POST(req({ targetPlan: "PRO" }, { "x-client-type": "mobile", "x-client-platform": "ios" }));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body).toMatchObject({ code: "MOBILE_EXTERNAL_BILLING_NOT_ALLOWED" });
  });
});
