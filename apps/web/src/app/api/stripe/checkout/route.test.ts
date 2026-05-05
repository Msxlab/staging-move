import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  rateLimit: vi.fn(),
  getStripePriceIdForPlanAndInterval: vi.fn(),
  getStripeAnnualTrialDays: vi.fn(),
  ensureSubscriptionDefaults: vi.fn(),
  findAcquisitionCampaign: vi.fn(),
  findActivePublicIndividualAnnualTrialCampaign: vi.fn(),
  findActivePublicIndividualMonthlyPaidOffer: vi.fn(),
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
  getStripePriceIdForPlanAndInterval: mocks.getStripePriceIdForPlanAndInterval,
  getStripeAnnualTrialDays: mocks.getStripeAnnualTrialDays,
  billingIntervalToCycle: (interval: string) => interval === "YEAR" ? "yearly" : "monthly",
}));
vi.mock("@/lib/acquisition-campaigns", () => ({
  findAcquisitionCampaign: mocks.findAcquisitionCampaign,
  findActivePublicIndividualAnnualTrialCampaign: mocks.findActivePublicIndividualAnnualTrialCampaign,
  findActivePublicIndividualMonthlyPaidOffer: mocks.findActivePublicIndividualMonthlyPaidOffer,
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
    mocks.getStripePriceIdForPlanAndInterval.mockImplementation(async (_plan: string, interval: string) =>
      interval === "YEAR" ? "price_yearly" : "price_monthly",
    );
    mocks.getStripeAnnualTrialDays.mockResolvedValue(90);
    const activeCampaign = {
      id: "camp_1",
      name: "Individual Annual Trial",
      code: "INDIVIDUAL90",
      status: "ACTIVE",
      accessType: "FREE_TRIAL",
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
      trialDays: 90,
      displayPriceLabel: "$39.99/year",
      requiresPaymentMethod: true,
      autoRenew: true,
      newUsersOnly: true,
    };
    const activeMonthlyOffer = {
      id: "camp_monthly",
      name: "Individual Monthly",
      code: "MONTHLY",
      status: "ACTIVE",
      accessType: "PAID",
      plan: "INDIVIDUAL",
      billingInterval: "MONTH",
      trialDays: null,
      displayPriceLabel: "$3.99/month",
      stripePriceId: "price_monthly",
      requiresPaymentMethod: true,
      autoRenew: true,
      newUsersOnly: false,
    };
    mocks.findAcquisitionCampaign.mockResolvedValue(activeCampaign);
    mocks.findActivePublicIndividualAnnualTrialCampaign.mockResolvedValue(activeCampaign);
    mocks.findActivePublicIndividualMonthlyPaidOffer.mockResolvedValue(activeMonthlyOffer);
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

    const response = await POST(checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "YEAR", acceptedSubscriptionTerms: true }));

    expect(response.status).toBe(503);
    expect(mocks.stripeConstructor).not.toHaveBeenCalled();
  });

  it("returns a clean config error instead of downgrading yearly checkout", async () => {
    mocks.getStripePriceIdForPlanAndInterval.mockResolvedValue(null);

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "YEAR", acceptedSubscriptionTerms: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("yearly");
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("creates Stripe customers with a deterministic idempotency key", async () => {
    const response = await POST(checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "YEAR", acceptedSubscriptionTerms: true }));

    expect(response.status).toBe(200);
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      { email: "user@example.com", metadata: { userId: "user_1" } },
      { idempotencyKey: expect.stringMatching(/^locateflow:/) },
    );
  });

  it("creates an annual trial Checkout session with payment method collection and snapshot metadata", async () => {
    mocks.getStripePriceIdForPlanAndInterval.mockResolvedValue("price_yearly");

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "YEAR", acceptedSubscriptionTerms: true }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getStripePriceIdForPlanAndInterval).toHaveBeenCalledWith("INDIVIDUAL", "YEAR");
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        client_reference_id: "user_1",
        line_items: [{ price: "price_yearly", quantity: 1 }],
        payment_method_collection: "always",
        cancel_url: "https://locateflow.com/api/stripe/checkout/cancel",
        subscription_data: expect.objectContaining({
          trial_period_days: 90,
          metadata: expect.objectContaining({
            userId: "user_1",
            plan: "INDIVIDUAL",
            campaignCode: "INDIVIDUAL90",
            accessType: "FREE_TRIAL",
            billingInterval: "YEAR",
            provider: "STRIPE",
            platform: "web",
          }),
        }),
        metadata: expect.objectContaining({
          userId: "user_1",
          plan: "INDIVIDUAL",
          billingInterval: "YEAR",
          provider: "STRIPE",
          platform: "web",
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

  it("uses the active public campaign when no campaign code is provided", async () => {
    mocks.getStripePriceIdForPlanAndInterval.mockResolvedValue("price_yearly");

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "YEAR", acceptedSubscriptionTerms: true }),
    );

    expect(response.status).toBe(200);
    expect(mocks.findActivePublicIndividualAnnualTrialCampaign).toHaveBeenCalled();
    expect(mocks.findAcquisitionCampaign).not.toHaveBeenCalled();
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.objectContaining({
          metadata: expect.objectContaining({ campaignCode: "INDIVIDUAL90" }),
        }),
      }),
    );
  });

  it("does not start a hidden default trial when no active public campaign exists", async () => {
    mocks.findActivePublicIndividualAnnualTrialCampaign.mockResolvedValueOnce(null);

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "YEAR", acceptedSubscriptionTerms: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: "OFFER_UNAVAILABLE",
      error: "This offer is not currently available.",
    });
    expect(mocks.findAcquisitionCampaign).not.toHaveBeenCalled();
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("creates a monthly paid Checkout session from the active monthly offer", async () => {
    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "MONTH", acceptedSubscriptionTerms: true }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getStripePriceIdForPlanAndInterval).toHaveBeenCalledWith("INDIVIDUAL", "MONTH");
    expect(mocks.findActivePublicIndividualMonthlyPaidOffer).toHaveBeenCalled();
    expect(mocks.findActivePublicIndividualAnnualTrialCampaign).not.toHaveBeenCalled();
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_monthly", quantity: 1 }],
        subscription_data: expect.objectContaining({
          metadata: expect.objectContaining({
            campaignCode: "MONTHLY",
            accessType: "PAID",
            cycle: "monthly",
            billingInterval: "MONTH",
          }),
        }),
        metadata: expect.objectContaining({
          billingInterval: "MONTH",
          provider: "STRIPE",
          platform: "web",
        }),
        success_url: expect.stringContaining("trial=false"),
      }),
    );
    expect(mocks.sessionsCreate.mock.calls[0][0].subscription_data).not.toHaveProperty("trial_period_days");
    expect(subscriptionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          billingInterval: "MONTH",
          campaignCode: "MONTHLY",
        }),
      }),
    );
  });

  it("returns OFFER_UNAVAILABLE when no active monthly offer exists", async () => {
    mocks.findActivePublicIndividualMonthlyPaidOffer.mockResolvedValueOnce(null);

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "MONTH", acceptedSubscriptionTerms: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "OFFER_UNAVAILABLE" });
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("uses an explicit campaign code only when that campaign exists", async () => {
    mocks.getStripePriceIdForPlanAndInterval.mockResolvedValue("price_yearly");
    mocks.findAcquisitionCampaign.mockResolvedValueOnce({
      id: "camp_spring",
      name: "Spring Trial",
      code: "SPRING90",
      status: "ACTIVE",
      accessType: "FREE_TRIAL",
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
      trialDays: 90,
      displayPriceLabel: "$39.99/year",
      requiresPaymentMethod: true,
      autoRenew: true,
      newUsersOnly: true,
    });

    const response = await POST(
      checkoutRequest({
        plan: "INDIVIDUAL",
        billingInterval: "YEAR",
        campaignCode: "spring90",
        acceptedSubscriptionTerms: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.findAcquisitionCampaign).toHaveBeenCalledWith("spring90", {
      allowDefaultFallback: false,
    });
    expect(mocks.findActivePublicIndividualAnnualTrialCampaign).not.toHaveBeenCalled();
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.objectContaining({
          metadata: expect.objectContaining({ campaignCode: "SPRING90" }),
        }),
      }),
    );
  });

  it("infers cycle from an explicit annual campaign code when cycle is omitted", async () => {
    mocks.findAcquisitionCampaign.mockResolvedValueOnce({
      id: "camp_spring",
      name: "Spring Trial",
      code: "SPRING90",
      status: "ACTIVE",
      accessType: "FREE_TRIAL",
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
      trialDays: 90,
      displayPriceLabel: "$39.99/year",
      stripePriceId: "price_yearly",
      requiresPaymentMethod: true,
      autoRenew: true,
      newUsersOnly: true,
    });

    const response = await POST(
      checkoutRequest({
        plan: "INDIVIDUAL",
        campaignCode: "SPRING90",
        acceptedSubscriptionTerms: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.findActivePublicIndividualMonthlyPaidOffer).not.toHaveBeenCalled();
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_yearly", quantity: 1 }],
        subscription_data: expect.objectContaining({
          trial_period_days: 90,
          metadata: expect.objectContaining({
            campaignCode: "SPRING90",
            cycle: "yearly",
            billingInterval: "YEAR",
          }),
        }),
      }),
    );
  });

  it("rejects explicit inactive campaigns", async () => {
    mocks.findAcquisitionCampaign.mockResolvedValueOnce({
      id: "camp_old",
      name: "Old Trial",
      code: "OLD90",
      status: "PAUSED",
      accessType: "FREE_TRIAL",
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
      trialDays: 90,
      displayPriceLabel: "$39.99/year",
      requiresPaymentMethod: true,
      autoRenew: true,
      newUsersOnly: true,
    });
    mocks.assertCampaignAvailable.mockImplementationOnce(() => {
      throw new Error("Campaign is not active.");
    });

    const response = await POST(
      checkoutRequest({
        plan: "INDIVIDUAL",
        billingInterval: "YEAR",
        campaignCode: "OLD90",
        acceptedSubscriptionTerms: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: "CAMPAIGN_UNAVAILABLE" });
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
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
    mocks.getStripePriceIdForPlanAndInterval.mockResolvedValue("price_yearly");

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "YEAR", acceptedSubscriptionTerms: true }),
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
    mocks.getStripePriceIdForPlanAndInterval.mockResolvedValue("price_yearly");

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "YEAR", acceptedSubscriptionTerms: true }),
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
    mocks.getStripePriceIdForPlanAndInterval.mockResolvedValue("price_yearly");

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", billingInterval: "YEAR", acceptedSubscriptionTerms: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "ALREADY_TRIALING" });
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });
});
