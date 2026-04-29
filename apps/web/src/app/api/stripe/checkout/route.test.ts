import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  rateLimit: vi.fn(),
  getStripePriceIdForPlan: vi.fn(),
  ensureSubscriptionDefaults: vi.fn(),
  findAcquisitionCampaign: vi.fn(),
  assertCampaignAvailable: vi.fn(),
  buildCheckoutConsentSnapshot: vi.fn(),
  buildSignupSnapshot: vi.fn(),
  campaignToSnapshotText: vi.fn(),
  getRequestHashSnapshot: vi.fn(),
  hashForSnapshot: vi.fn(),
  customersCreate: vi.fn(),
  sessionsCreate: vi.fn(),
  stripeConstructor: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    subscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ requireDbUserId: mocks.requireDbUserId }));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: mocks.getRuntimeConfigValue }));
vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "stripe-key"),
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/billing", () => ({
  ensureSubscriptionDefaults: mocks.ensureSubscriptionDefaults,
  getStripePriceIdForPlan: mocks.getStripePriceIdForPlan,
}));
vi.mock("@/lib/acquisition-campaigns", () => ({
  findAcquisitionCampaign: mocks.findAcquisitionCampaign,
  assertCampaignAvailable: mocks.assertCampaignAvailable,
  buildCheckoutConsentSnapshot: mocks.buildCheckoutConsentSnapshot,
  buildSignupSnapshot: mocks.buildSignupSnapshot,
  campaignToSnapshotText: mocks.campaignToSnapshotText,
  getRequestHashSnapshot: mocks.getRequestHashSnapshot,
  hashForSnapshot: mocks.hashForSnapshot,
}));
vi.mock("stripe", () => ({
  default: mocks.stripeConstructor,
}));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const subscriptionMock = prisma.subscription as unknown as {
  findUnique: Mock;
  create: Mock;
  update: Mock;
};
const userMock = prisma.user as unknown as { findUnique: Mock };

function checkoutRequest(body: unknown) {
  return new NextRequest("https://locateflow.com/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("stripe checkout route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, APP_ENV: "staging" };
    mocks.requireDbUserId.mockResolvedValue("user_1");
    mocks.rateLimit.mockResolvedValue({ success: true, resetAt: Date.now() + 60_000 });
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => {
      if (key === "STRIPE_SECRET_KEY") return "sk_test_123";
      if (key === "NEXT_PUBLIC_APP_URL") return "https://locateflow.com";
      return null;
    });
    userMock.findUnique.mockResolvedValue({ id: "user_1", email: "user@example.com" });
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      stripeCustomerId: null,
      platform: "web",
    });
    subscriptionMock.create.mockResolvedValue({
      userId: "user_1",
      stripeCustomerId: null,
      platform: "web",
      status: "PENDING_CHECKOUT",
    });
    subscriptionMock.update.mockResolvedValue({});
    mocks.getStripePriceIdForPlan.mockResolvedValue("price_monthly");
    mocks.findAcquisitionCampaign.mockResolvedValue({
      id: "camp_1",
      name: "Individual Annual Trial",
      code: "INDIVIDUAL90",
      status: "ACTIVE",
      accessType: "FREE_TRIAL",
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
      trialDays: 90,
      displayPriceLabel: "$79/year",
      requiresPaymentMethod: true,
      autoRenew: true,
      newUsersOnly: true,
    });
    mocks.buildSignupSnapshot.mockReturnValue({ campaignCode: "INDIVIDUAL90" });
    mocks.campaignToSnapshotText.mockReturnValue("{\"campaignCode\":\"INDIVIDUAL90\"}");
    mocks.buildCheckoutConsentSnapshot.mockReturnValue("{\"checkoutDisclosureTextHash\":\"hash_1\"}");
    mocks.getRequestHashSnapshot.mockReturnValue({ consentIpHash: "ip_hash", consentUserAgentHash: "ua_hash" });
    mocks.hashForSnapshot.mockReturnValue("hash_1");
    mocks.customersCreate.mockResolvedValue({ id: "cus_123" });
    mocks.sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    mocks.stripeConstructor.mockImplementation(function StripeMock() {
      return {
      customers: { create: mocks.customersCreate },
      checkout: { sessions: { create: mocks.sessionsCreate } },
      };
    });
  });

  it("rejects Stripe test keys in production billing environments", async () => {
    process.env.APP_ENV = "production";

    const response = await POST(checkoutRequest({ plan: "INDIVIDUAL", cycle: "yearly", acceptedSubscriptionTerms: true }));

    expect(response.status).toBe(503);
    expect(mocks.stripeConstructor).not.toHaveBeenCalled();
  });

  it("returns a clean config error instead of downgrading yearly checkout", async () => {
    mocks.getStripePriceIdForPlan.mockResolvedValue(null);

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", cycle: "yearly", acceptedSubscriptionTerms: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("yearly");
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("creates Stripe customers with a deterministic idempotency key", async () => {
    const response = await POST(checkoutRequest({ plan: "INDIVIDUAL", cycle: "yearly", acceptedSubscriptionTerms: true }));

    expect(response.status).toBe(200);
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      { email: "user@example.com", metadata: { userId: "user_1" } },
      { idempotencyKey: expect.stringMatching(/^locateflow:/) },
    );
  });

  it("creates an annual trial Checkout session with payment method collection and snapshot metadata", async () => {
    mocks.getStripePriceIdForPlan.mockResolvedValue("price_yearly");

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", cycle: "yearly", acceptedSubscriptionTerms: true }),
    );

    expect(response.status).toBe(200);
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_yearly", quantity: 1 }],
        payment_method_collection: "always",
        cancel_url: "https://locateflow.com/api/stripe/checkout/cancel",
        subscription_data: expect.objectContaining({
          trial_period_days: 90,
          metadata: expect.objectContaining({
            campaignCode: "INDIVIDUAL90",
            accessType: "FREE_TRIAL",
          }),
        }),
      }),
    );
    expect(subscriptionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        data: expect.objectContaining({
          billingInterval: "YEAR",
          campaignCode: "INDIVIDUAL90",
          checkoutConsentSnapshot: "{\"checkoutDisclosureTextHash\":\"hash_1\"}",
        }),
      }),
    );
    expect(subscriptionMock.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "TRIALING",
          accessType: "FREE_TRIAL",
        }),
      }),
    );
  });

  it("lets a Free Access user (status=ACTIVE, provider=ADMIN) start the annual trial", async () => {
    // Admin-granted Free Access also writes status=ACTIVE — those users are
    // exactly the ones who must be allowed to convert. Guarding on raw
    // status alone here would 409 the entire upgrade path.
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      provider: "ADMIN",
      accessType: "FREE_ACCESS",
      status: "ACTIVE",
      platform: "web",
    });
    mocks.getStripePriceIdForPlan.mockResolvedValue("price_yearly");

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", cycle: "yearly", acceptedSubscriptionTerms: true }),
    );

    expect(response.status).toBe(200);
    expect(mocks.sessionsCreate).toHaveBeenCalled();
    expect(subscriptionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        data: expect.objectContaining({
          status: "PENDING_CHECKOUT",
          billingInterval: "YEAR",
          campaignCode: "INDIVIDUAL90",
        }),
      }),
    );
  });

  it("blocks re-checkout for a real Stripe-backed paid annual subscription", async () => {
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      stripeCustomerId: "cus_paid",
      stripeSubscriptionId: "sub_paid_123",
      provider: "STRIPE",
      accessType: "PAID",
      status: "ACTIVE",
      platform: "web",
    });
    mocks.getStripePriceIdForPlan.mockResolvedValue("price_yearly");

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", cycle: "yearly", acceptedSubscriptionTerms: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "ALREADY_ACTIVE" });
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("blocks re-checkout for a real Stripe-backed trial", async () => {
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      stripeCustomerId: "cus_trial",
      stripeSubscriptionId: "sub_trial_123",
      provider: "STRIPE",
      accessType: "FREE_TRIAL",
      status: "TRIALING",
      platform: "web",
    });
    mocks.getStripePriceIdForPlan.mockResolvedValue("price_yearly");

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", cycle: "yearly", acceptedSubscriptionTerms: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "ALREADY_TRIALING" });
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });
});
