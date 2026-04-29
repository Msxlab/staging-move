import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
  mapStripePriceIdToPlan: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  constructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  stripeConstructor: vi.fn(),
  sendSubscriptionActivatedEmail: vi.fn(),
  sendSubscriptionCanceledEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  prisma: {
    processedWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    subscription: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: mocks.getRuntimeConfigValue }));
vi.mock("@/lib/billing", () => ({ mapStripePriceIdToPlan: mocks.mapStripePriceIdToPlan }));
vi.mock("@/lib/sentry", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));
vi.mock("@/lib/email-service", () => ({
  sendSubscriptionActivatedEmail: mocks.sendSubscriptionActivatedEmail,
  sendSubscriptionCanceledEmail: mocks.sendSubscriptionCanceledEmail,
  sendPaymentFailedEmail: mocks.sendPaymentFailedEmail,
}));
vi.mock("stripe", () => ({ default: mocks.stripeConstructor }));

import { POST } from "./route";

const processedMock = mocks.prisma.processedWebhookEvent as {
  findUnique: Mock;
  create: Mock;
};
const subscriptionMock = mocks.prisma.subscription as {
  updateMany: Mock;
  findFirst: Mock;
};

function request() {
  return new Request("https://app.locateflow.com/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: "{}",
  }) as any;
}

function subscriptionUpdatedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "customer.subscription.updated",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 3600,
        trial_end: null,
        items: { data: [{ price: { id: "price_1" } }] },
      },
    },
    ...overrides,
  };
}

describe("Stripe webhook idempotency and livemode", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, APP_ENV: "staging", NODE_ENV: "test" };
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => {
      if (key === "STRIPE_WEBHOOK_SECRET") return "whsec_test";
      if (key === "STRIPE_SECRET_KEY") return "sk_test_123";
      return null;
    });
    mocks.stripeConstructor.mockImplementation(function StripeMock() {
      return {
      webhooks: { constructEvent: mocks.constructEvent },
      subscriptions: { retrieve: mocks.subscriptionsRetrieve },
      };
    });
    mocks.constructEvent.mockReturnValue(subscriptionUpdatedEvent());
    mocks.mapStripePriceIdToPlan.mockResolvedValue("INDIVIDUAL");
    processedMock.findUnique.mockResolvedValue(null);
    processedMock.create.mockResolvedValue({});
    subscriptionMock.updateMany.mockResolvedValue({ count: 1 });
    subscriptionMock.findFirst.mockResolvedValue(null);
    mocks.sendSubscriptionActivatedEmail.mockResolvedValue({});
    mocks.sendSubscriptionCanceledEmail.mockResolvedValue({});
    mocks.sendPaymentFailedEmail.mockResolvedValue({});
  });

  it("skips a duplicate event after successful processing", async () => {
    const first = await POST(request());
    processedMock.findUnique.mockResolvedValueOnce({ id: "evt_1" });
    const second = await POST(request());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ duplicate: true });
    expect(subscriptionMock.updateMany).toHaveBeenCalledTimes(1);
    expect(processedMock.create).toHaveBeenCalledTimes(1);
  });

  it("keeps an event retryable when handling fails before mutation", async () => {
    mocks.mapStripePriceIdToPlan.mockRejectedValueOnce(new Error("price map failed"));

    const failed = await POST(request());
    expect(failed.status).toBe(500);
    expect(subscriptionMock.updateMany).not.toHaveBeenCalled();
    expect(processedMock.create).not.toHaveBeenCalled();

    mocks.mapStripePriceIdToPlan.mockResolvedValueOnce("INDIVIDUAL");
    const retry = await POST(request());

    expect(retry.status).toBe(200);
    expect(subscriptionMock.updateMany).toHaveBeenCalledTimes(1);
    expect(processedMock.create).toHaveBeenCalledTimes(1);
  });

  it("rejects testmode events in production without mutation", async () => {
    process.env.APP_ENV = "production";
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => {
      if (key === "STRIPE_WEBHOOK_SECRET") return "whsec_live";
      if (key === "STRIPE_SECRET_KEY") return "sk_live_123";
      return null;
    });
    mocks.constructEvent.mockReturnValue(subscriptionUpdatedEvent({ livemode: false }));

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("STRIPE_LIVEMODE_MISMATCH");
    expect(subscriptionMock.updateMany).not.toHaveBeenCalled();
    expect(processedMock.create).not.toHaveBeenCalled();
  });

  it("rejects live events outside production unless explicitly allowed", async () => {
    mocks.constructEvent.mockReturnValue(subscriptionUpdatedEvent({ livemode: true }));

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("STRIPE_LIVEMODE_MISMATCH");
    expect(subscriptionMock.updateMany).not.toHaveBeenCalled();
    expect(processedMock.create).not.toHaveBeenCalled();
  });
});
