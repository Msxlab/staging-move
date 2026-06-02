import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  getConfiguredAppUrl: vi.fn(),
  rateLimit: vi.fn(),
  portalSessionsCreate: vi.fn(),
  stripeConstructor: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ requireDbUserId: mocks.requireDbUserId }));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: mocks.getRuntimeConfigValue }));
vi.mock("@/lib/app-url", () => ({ getConfiguredAppUrl: mocks.getConfiguredAppUrl }));
vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "stripe-portal-key"),
  rateLimit: mocks.rateLimit,
}));
vi.mock("stripe", () => ({
  default: mocks.stripeConstructor,
}));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const subscriptionMock = prisma.subscription as unknown as {
  findUnique: Mock;
  update: Mock;
};

function portalRequest(headers?: Record<string, string>) {
  return new NextRequest("https://locateflow.com/api/stripe/portal", {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers || {}) },
    body: JSON.stringify({}),
  });
}

describe("stripe portal route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, APP_ENV: "staging" };
    mocks.requireDbUserId.mockResolvedValue("user_1");
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => {
      if (key === "STRIPE_SECRET_KEY") return "sk_test_123";
      return null;
    });
    mocks.getConfiguredAppUrl.mockResolvedValue("https://locateflow.com");
    mocks.rateLimit.mockResolvedValue({ success: true, resetAt: Date.now() + 60_000 });
    subscriptionMock.findUnique.mockResolvedValue({
      userId: "user_1",
      stripeCustomerId: "cus_123",
    });
    subscriptionMock.update.mockResolvedValue({});
    mocks.portalSessionsCreate.mockResolvedValue({
      url: "https://billing.stripe.test/session",
    });
    mocks.stripeConstructor.mockImplementation(function StripeMock() {
      return {
        billingPortal: {
          sessions: { create: mocks.portalSessionsCreate },
        },
      };
    });
  });

  it("allows web portal requests without the mobile app client header", async () => {
    const response = await POST(portalRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe("https://billing.stripe.test/session");
    expect(mocks.portalSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://locateflow.com/settings/subscription",
    });
  });

  it("rejects iOS mobile app portal requests", async () => {
    const response = await POST(
      portalRequest({ "x-client-type": "mobile", "x-client-platform": "ios" }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ code: "MOBILE_EXTERNAL_BILLING_NOT_ALLOWED" });
    expect(mocks.requireDbUserId).not.toHaveBeenCalled();
    expect(mocks.stripeConstructor).not.toHaveBeenCalled();
  });

  it("rejects Android mobile app portal requests", async () => {
    const response = await POST(
      portalRequest({ "x-client-type": "mobile", "x-client-platform": "android" }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ code: "MOBILE_EXTERNAL_BILLING_NOT_ALLOWED" });
    expect(mocks.requireDbUserId).not.toHaveBeenCalled();
    expect(mocks.stripeConstructor).not.toHaveBeenCalled();
  });

  it("returns the auth gate response before portal work when unauthenticated", async () => {
    mocks.requireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await POST(portalRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.stripeConstructor).not.toHaveBeenCalled();
    expect(subscriptionMock.findUnique).not.toHaveBeenCalled();
  });

  it("clears a stale Stripe customer ID and returns 404 when Stripe says the customer is missing", async () => {
    mocks.portalSessionsCreate.mockRejectedValueOnce({
      code: "resource_missing",
      param: "customer",
      raw: { code: "resource_missing", param: "customer" },
      statusCode: 404,
    });

    const response = await POST(portalRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({ code: "STRIPE_CUSTOMER_MISSING" });
    expect(subscriptionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        data: expect.objectContaining({ stripeCustomerId: null }),
      }),
    );
  });
});
