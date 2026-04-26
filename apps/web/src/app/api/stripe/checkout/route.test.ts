import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  rateLimit: vi.fn(),
  getStripePriceIdForPlan: vi.fn(),
  ensureSubscriptionDefaults: vi.fn(),
  customersCreate: vi.fn(),
  sessionsCreate: vi.fn(),
  stripeConstructor: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    subscription: {
      findUnique: vi.fn(),
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
vi.mock("stripe", () => ({
  default: mocks.stripeConstructor,
}));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const subscriptionMock = prisma.subscription as unknown as {
  findUnique: Mock;
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
    subscriptionMock.update.mockResolvedValue({});
    mocks.getStripePriceIdForPlan.mockResolvedValue("price_monthly");
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

    const response = await POST(checkoutRequest({ plan: "INDIVIDUAL" }));

    expect(response.status).toBe(503);
    expect(mocks.stripeConstructor).not.toHaveBeenCalled();
  });

  it("returns a clean config error instead of downgrading yearly checkout", async () => {
    mocks.getStripePriceIdForPlan.mockResolvedValue(null);

    const response = await POST(
      checkoutRequest({ plan: "INDIVIDUAL", cycle: "yearly" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("yearly");
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("creates Stripe customers with a deterministic idempotency key", async () => {
    const response = await POST(checkoutRequest({ plan: "INDIVIDUAL" }));

    expect(response.status).toBe(200);
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      { email: "user@example.com", metadata: { userId: "user_1" } },
      { idempotencyKey: expect.stringMatching(/^locateflow:/) },
    );
  });
});
