import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
  mapStripePriceIdToPlanAndInterval: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  constructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  stripeConstructor: vi.fn(),
  sendSubscriptionActivatedEmail: vi.fn(),
  sendSubscriptionCanceledEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  emitSecurityEvent: vi.fn(),
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
vi.mock("@/lib/billing", () => ({
  mapStripePriceIdToPlanAndInterval: mocks.mapStripePriceIdToPlanAndInterval,
}));
vi.mock("@/lib/sentry", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));
vi.mock("@/lib/email-service", () => ({
  sendSubscriptionActivatedEmail: mocks.sendSubscriptionActivatedEmail,
  sendSubscriptionCanceledEmail: mocks.sendSubscriptionCanceledEmail,
  sendPaymentFailedEmail: mocks.sendPaymentFailedEmail,
}));
vi.mock("@/lib/security-events", () => ({
  emitSecurityEvent: (...args: any[]) => mocks.emitSecurityEvent(...args),
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
        metadata: { userId: "user_1", plan: "INDIVIDUAL", cycle: "yearly", billingInterval: "YEAR" },
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 3600,
        trial_end: null,
        items: { data: [{ price: { id: "price_yearly", recurring: { interval: "year" } } }] },
      },
    },
    ...overrides,
  };
}

function trialingStripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_trial_1",
    customer: "cus_1",
    status: "trialing",
    metadata: { userId: "user_1", plan: "INDIVIDUAL", cycle: "yearly", billingInterval: "YEAR" },
    cancel_at_period_end: false,
    current_period_end: Math.floor(Date.now() / 1000) + 90 * 86_400,
    trial_end: Math.floor(Date.now() / 1000) + 90 * 86_400,
    items: { data: [{ price: { id: "price_yearly", recurring: { interval: "year" } } }] },
    ...overrides,
  };
}

function checkoutCompletedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_checkout_1",
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: "cs_test_1",
        mode: "subscription",
        customer: "cus_1",
        subscription: "sub_trial_1",
        client_reference_id: "user_1",
        amount_total: 0,
        currency: "usd",
        metadata: {
          userId: "user_1",
          plan: "INDIVIDUAL",
          cycle: "yearly",
          billingInterval: "YEAR",
          accessType: "FREE_TRIAL",
        },
      },
    },
    ...overrides,
  };
}

function invoiceEvent(type = "invoice.paid", overrides: Record<string, unknown> = {}) {
  return {
    id: `evt_${type.replace(/\./g, "_")}`,
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: "in_1",
        customer: "cus_1",
        subscription: "sub_active_1",
        amount_paid: 3999,
        amount_due: 3999,
        currency: "usd",
        billing_reason: "subscription_cycle",
        next_payment_attempt: null,
        lines: {
          data: [
            {
              price: {
                id: "price_yearly",
                recurring: { interval: "year" },
              },
            },
          ],
        },
      },
    },
    ...overrides,
  };
}

function localSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "local_sub_1",
    userId: "user_1",
    status: "PENDING_CHECKOUT",
    accessType: "FREE_ACCESS",
    provider: "ADMIN",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: null,
    user: { id: "user_1", deletedAt: null },
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
    mocks.mapStripePriceIdToPlanAndInterval.mockResolvedValue({
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
    });
    processedMock.findUnique.mockResolvedValue(null);
    processedMock.create.mockResolvedValue({});
    subscriptionMock.updateMany.mockResolvedValue({ count: 1 });
    subscriptionMock.findFirst.mockResolvedValue(localSubscription());
    mocks.subscriptionsRetrieve.mockResolvedValue(trialingStripeSubscription());
    mocks.sendSubscriptionActivatedEmail.mockResolvedValue({});
    mocks.sendSubscriptionCanceledEmail.mockResolvedValue({});
    mocks.sendPaymentFailedEmail.mockResolvedValue({});
  });

  it("emits a safe security event when signature verification fails", async () => {
    mocks.constructEvent.mockImplementationOnce(() => {
      throw new Error("bad signature");
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(mocks.emitSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "WEBHOOK_SIG_FAILURE",
      context: expect.objectContaining({
        provider: "stripe",
        reason: "signature_verification_failed",
        signatureLength: "sig_test".length,
        bodyLength: 2,
      }),
    }));
    expect(processedMock.create).not.toHaveBeenCalled();
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

  it("updates local state to TRIALING for completed subscription checkout", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    mocks.subscriptionsRetrieve.mockResolvedValue(trialingStripeSubscription());

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.subscriptionsRetrieve).toHaveBeenCalledWith("sub_trial_1");
    expect(subscriptionMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        data: expect.objectContaining({
          status: "TRIALING",
          provider: "STRIPE",
          accessType: "FREE_TRIAL",
          billingInterval: "YEAR",
          plan: "INDIVIDUAL",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_trial_1",
          trialEndsAt: expect.any(Date),
          firstChargeAt: expect.any(Date),
        }),
      }),
    );
    expect(processedMock.create).toHaveBeenCalledTimes(1);
  });

  it("updates local state to TRIALING for customer.subscription.created", async () => {
    mocks.constructEvent.mockReturnValue(subscriptionUpdatedEvent({
      id: "evt_created_1",
      type: "customer.subscription.created",
      data: { object: trialingStripeSubscription() },
    }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(subscriptionMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        data: expect.objectContaining({
          status: "TRIALING",
          accessType: "FREE_TRIAL",
          billingInterval: "YEAR",
          stripeSubscriptionId: "sub_trial_1",
        }),
      }),
    );
  });

  it("maps subscription updates to TRIALING, ACTIVE, and CANCEL_AT_PERIOD_END", async () => {
    mocks.constructEvent.mockReturnValueOnce(subscriptionUpdatedEvent({
      id: "evt_trialing_1",
      data: { object: trialingStripeSubscription() },
    }));
    await expect(POST(request())).resolves.toHaveProperty("status", 200);
    expect(subscriptionMock.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "TRIALING", billingInterval: "YEAR" }) }),
    );

    vi.clearAllMocks();
    processedMock.findUnique.mockResolvedValue(null);
    processedMock.create.mockResolvedValue({});
    subscriptionMock.findFirst.mockResolvedValue(localSubscription({ status: "TRIALING" }));
    subscriptionMock.updateMany.mockResolvedValue({ count: 1 });
    mocks.mapStripePriceIdToPlanAndInterval.mockResolvedValue({
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
    });
    mocks.constructEvent.mockReturnValueOnce(subscriptionUpdatedEvent({
      id: "evt_active_1",
      data: { object: { ...trialingStripeSubscription(), id: "sub_active_1", status: "active", trial_end: null } },
    }));
    await expect(POST(request())).resolves.toHaveProperty("status", 200);
    expect(subscriptionMock.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          accessType: "PAID",
          billingInterval: "YEAR",
        }),
      }),
    );

    vi.clearAllMocks();
    processedMock.findUnique.mockResolvedValue(null);
    processedMock.create.mockResolvedValue({});
    subscriptionMock.findFirst.mockResolvedValue(localSubscription({ status: "ACTIVE" }));
    subscriptionMock.updateMany.mockResolvedValue({ count: 1 });
    mocks.mapStripePriceIdToPlanAndInterval.mockResolvedValue({
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
    });
    mocks.constructEvent.mockReturnValueOnce(subscriptionUpdatedEvent({
      id: "evt_cancel_period_1",
      data: {
        object: {
          ...trialingStripeSubscription(),
          id: "sub_cancel_period_1",
          status: "active",
          trial_end: null,
          cancel_at_period_end: true,
        },
      },
    }));
    await expect(POST(request())).resolves.toHaveProperty("status", 200);
    expect(subscriptionMock.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCEL_AT_PERIOD_END", billingInterval: "YEAR" }) }),
    );
  });

  it("maps a monthly Stripe price to billingInterval MONTH", async () => {
    mocks.mapStripePriceIdToPlanAndInterval.mockResolvedValueOnce({
      plan: "INDIVIDUAL",
      billingInterval: "MONTH",
    });
    mocks.constructEvent.mockReturnValue(subscriptionUpdatedEvent({
      id: "evt_monthly_1",
      data: {
        object: {
          ...trialingStripeSubscription({
            status: "active",
            trial_end: null,
            metadata: { userId: "user_1", plan: "INDIVIDUAL", billingInterval: "MONTH" },
          }),
          items: { data: [{ price: { id: "price_monthly", recurring: { interval: "month" } } }] },
        },
      },
    }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(subscriptionMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          accessType: "PAID",
          stripePriceId: "price_monthly",
          billingProductId: "price_monthly",
          billingInterval: "MONTH",
        }),
      }),
    );
  });

  it.each(["invoice.paid", "invoice.payment_succeeded"])(
    "handles %s as a recurring successful payment sync",
    async (eventType) => {
      mocks.constructEvent.mockReturnValue(invoiceEvent(eventType));
      mocks.subscriptionsRetrieve.mockResolvedValue({
        ...trialingStripeSubscription({
          id: "sub_active_1",
          status: "active",
          trial_end: null,
        }),
        items: { data: [{ price: { id: "price_yearly", recurring: { interval: "year" } } }] },
      });
      subscriptionMock.findFirst.mockResolvedValue(localSubscription({
        status: "ACTIVE",
        stripeSubscriptionId: "sub_active_1",
      }));

      const response = await POST(request());

      expect(response.status).toBe(200);
      expect(mocks.subscriptionsRetrieve).toHaveBeenCalledWith("sub_active_1");
      expect(subscriptionMock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user_1" },
          data: expect.objectContaining({
            status: "ACTIVE",
            accessType: "PAID",
            billingInterval: "YEAR",
            stripeCustomerId: "cus_1",
            stripeSubscriptionId: "sub_active_1",
            stripePriceId: "price_yearly",
            billingProductId: "price_yearly",
          }),
        }),
      );
    },
  );

  it("keeps checkout session events retryable when user metadata is missing", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent({
      data: {
        object: {
          ...checkoutCompletedEvent().data.object,
          client_reference_id: null,
          metadata: { plan: "INDIVIDUAL", cycle: "yearly", accessType: "FREE_TRIAL" },
        },
      },
    }));

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(subscriptionMock.updateMany).not.toHaveBeenCalled();
    expect(processedMock.create).not.toHaveBeenCalled();
  });

  it("keeps webhook retryable when no local subscription/user can be mapped", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    subscriptionMock.findFirst.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(subscriptionMock.updateMany).not.toHaveBeenCalled();
    expect(processedMock.create).not.toHaveBeenCalled();
  });

  it("accepts testmode webhook events in staging", async () => {
    process.env.APP_ENV = "staging";
    mocks.constructEvent.mockReturnValue(subscriptionUpdatedEvent({ livemode: false }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(subscriptionMock.updateMany).toHaveBeenCalled();
    expect(processedMock.create).toHaveBeenCalled();
  });

  it("keeps an event retryable when handling fails before mutation", async () => {
    mocks.mapStripePriceIdToPlanAndInterval.mockRejectedValueOnce(new Error("price map failed"));

    const failed = await POST(request());
    expect(failed.status).toBe(500);
    expect(subscriptionMock.updateMany).not.toHaveBeenCalled();
    expect(processedMock.create).not.toHaveBeenCalled();

    mocks.mapStripePriceIdToPlanAndInterval.mockResolvedValueOnce({
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
    });
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
