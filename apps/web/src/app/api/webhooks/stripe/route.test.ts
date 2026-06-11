import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
  mapStripePriceIdToPlanAndInterval: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  constructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  subscriptionsList: vi.fn(),
  subscriptionsCancel: vi.fn(),
  invoicesRetrieve: vi.fn(),
  stripeConstructor: vi.fn(),
  sendSubscriptionActivatedEmail: vi.fn(),
  sendSubscriptionCanceledEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  sendAdminPurchaseAlert: vi.fn(),
  emitSecurityEvent: vi.fn(),
  alertWebhookSignatureFailure: vi.fn(),
  prisma: {
    processedWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    subscription: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    acquisitionRedemption: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    acquisitionCampaign: {
      update: vi.fn(),
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
vi.mock("@/lib/admin-alerts", () => ({
  sendAdminPurchaseAlert: mocks.sendAdminPurchaseAlert,
}));
vi.mock("@/lib/security-events", () => ({
  emitSecurityEvent: (...args: any[]) => mocks.emitSecurityEvent(...args),
}));
vi.mock("@/lib/security-alerts", () => ({
  alertWebhookSignatureFailure: (...args: any[]) => {
    mocks.alertWebhookSignatureFailure(...args);
    return Promise.resolve();
  },
}));
vi.mock("stripe", () => ({ default: mocks.stripeConstructor }));

import { POST } from "./route";

const processedMock = mocks.prisma.processedWebhookEvent as {
  findUnique: Mock;
  create: Mock;
  deleteMany: Mock;
};
const subscriptionMock = mocks.prisma.subscription as {
  updateMany: Mock;
  findFirst: Mock;
  findMany: Mock;
  update: Mock;
};
const redemptionMock = mocks.prisma.acquisitionRedemption as {
  findFirst: Mock;
  updateMany: Mock;
};
const campaignMock = mocks.prisma.acquisitionCampaign as { update: Mock };

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

function chargeRefundedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_refund_1",
    type: "charge.refunded",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: "ch_1",
        customer: "cus_1",
        invoice: "in_1",
        // A full refund: Stripe sets `refunded: true` only when the charge
        // is entirely refunded. Access is revoked solely on full refunds.
        refunded: true,
        amount: 3999,
        amount_refunded: 3999,
        metadata: { userId: "user_1" },
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
    // Default to a Stripe-managed row — these fixtures back the normal
    // webhook sync path. ADMIN manual-grant rows take a dedicated branch
    // (they are intentionally NOT clobbered by Stripe sync — see the
    // "skips Stripe sync for an ADMIN manual-grant row" test) and must be
    // opted into explicitly via an override.
    provider: "STRIPE",
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
      subscriptions: {
        retrieve: mocks.subscriptionsRetrieve,
        list: mocks.subscriptionsList,
        cancel: mocks.subscriptionsCancel,
      },
      invoices: { retrieve: mocks.invoicesRetrieve },
      };
    });
    mocks.constructEvent.mockReturnValue(subscriptionUpdatedEvent());
    mocks.mapStripePriceIdToPlanAndInterval.mockResolvedValue({
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
    });
    processedMock.findUnique.mockResolvedValue(null);
    processedMock.create.mockResolvedValue({});
    processedMock.deleteMany.mockResolvedValue({ count: 1 });
    subscriptionMock.updateMany.mockResolvedValue({ count: 1 });
    subscriptionMock.findFirst.mockResolvedValue(localSubscription());
    subscriptionMock.findMany.mockResolvedValue([]);
    subscriptionMock.update.mockResolvedValue({});
    redemptionMock.findFirst.mockResolvedValue(null);
    redemptionMock.updateMany.mockResolvedValue({ count: 0 });
    campaignMock.update.mockResolvedValue({});
    mocks.subscriptionsRetrieve.mockResolvedValue(trialingStripeSubscription());
    // Default: customer has no other live subscriptions, so the duplicate-sub
    // sweep is a no-op for tests that don't opt into a duplicate scenario.
    mocks.subscriptionsList.mockResolvedValue({ data: [] });
    mocks.subscriptionsCancel.mockResolvedValue({ id: "sub_canceled", status: "canceled" });
    mocks.invoicesRetrieve.mockResolvedValue({ id: "in_1", subscription: "sub_trial_1" });
    mocks.sendSubscriptionActivatedEmail.mockResolvedValue({});
    mocks.sendSubscriptionCanceledEmail.mockResolvedValue({});
    mocks.sendPaymentFailedEmail.mockResolvedValue({});
    mocks.sendAdminPurchaseAlert.mockResolvedValue(true);
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
    expect(mocks.emitSecurityEvent).toHaveBeenCalledTimes(1);
    // The operator email alarm fires alongside the structured event.
    expect(mocks.alertWebhookSignatureFailure).toHaveBeenCalledWith({
      provider: "stripe",
      reason: "signature_verification_failed",
    });
    expect(processedMock.create).not.toHaveBeenCalled();
  });

  it("skips a duplicate event after successful processing", async () => {
    const first = await POST(request());
    // The second delivery's atomic reservation insert hits the unique PK and
    // bails before any side effect runs.
    processedMock.create.mockRejectedValueOnce(
      Object.assign(new Error("duplicate"), { code: "P2002" }),
    );
    const second = await POST(request());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ duplicate: true });
    expect(subscriptionMock.updateMany).toHaveBeenCalledTimes(1);
    // Both deliveries attempt to reserve; only the first succeeds.
    expect(processedMock.create).toHaveBeenCalledTimes(2);
  });

  it("clears stale pending schedule fields when Stripe sync switches to a new subscription", async () => {
    mocks.constructEvent.mockReturnValue(subscriptionUpdatedEvent());
    subscriptionMock.findFirst.mockResolvedValue(
      localSubscription({
        stripeSubscriptionId: "sub_old",
        stripeSubscriptionScheduleId: "sched_old",
        pendingPlan: "INDIVIDUAL",
        pendingBillingInterval: "MONTH",
        pendingBillingIntervalEffectiveAt: new Date(Date.now() + 30 * 86_400_000),
      }),
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(subscriptionMock.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        OR: [{ lastStripeEventAt: null }, { lastStripeEventAt: { lte: expect.any(Date) } }],
      },
      data: expect.objectContaining({
        stripeSubscriptionId: "sub_1",
        pendingPlan: null,
        pendingBillingInterval: null,
        pendingBillingIntervalEffectiveAt: null,
        stripeSubscriptionScheduleId: null,
      }),
    });
  });

  it("marks pending checkout trial redemption as redeemed after completed Checkout", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    mocks.subscriptionsRetrieve.mockResolvedValue(trialingStripeSubscription());
    redemptionMock.findFirst.mockResolvedValue({ id: "redemption_1", campaignId: "camp_1" });
    redemptionMock.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(redemptionMock.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        accessType: "FREE_TRIAL",
        status: "PENDING_CHECKOUT",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, campaignId: true },
    });
    expect(redemptionMock.updateMany).toHaveBeenCalledWith({
      where: { id: "redemption_1", status: "PENDING_CHECKOUT" },
      data: { status: "REDEEMED" },
    });
    expect(campaignMock.update).toHaveBeenCalledWith({
      where: { id: "camp_1" },
      data: { redemptionCount: { increment: 1 } },
    });
  });

  it("scopes charge.refunded updates by invoice subscription and metadata user id when present", async () => {
    mocks.constructEvent.mockReturnValue(chargeRefundedEvent());

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.invoicesRetrieve).toHaveBeenCalledWith("in_1");
    expect(subscriptionMock.updateMany).toHaveBeenCalledWith({
      where: {
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_trial_1",
        userId: "user_1",
        provider: { not: "ADMIN" },
        OR: [{ lastStripeEventAt: null }, { lastStripeEventAt: { lte: expect.any(Date) } }],
      },
      data: expect.objectContaining({ status: "REFUNDED", lastStripeEventAt: expect.any(Date) }),
    });
  });

  it("does not revoke access on a partial charge.refunded", async () => {
    // charge.refunded also fires for partial refunds (e.g. a goodwill credit).
    // Revoking a still-paid user would be a regression — skip anything but a
    // full refund.
    mocks.constructEvent.mockReturnValue(
      chargeRefundedEvent({
        data: {
          object: {
            id: "ch_1",
            customer: "cus_1",
            invoice: "in_1",
            refunded: false,
            amount: 3999,
            amount_refunded: 1000,
            metadata: { userId: "user_1" },
          },
        },
      }),
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.invoicesRetrieve).not.toHaveBeenCalled();
    expect(subscriptionMock.updateMany).not.toHaveBeenCalled();
  });

  it("does not grant a grace-period entitlement for an initial failed checkout invoice", async () => {
    const event = invoiceEvent("invoice.payment_failed");
    (event.data.object as any).billing_reason = "subscription_create";
    mocks.constructEvent.mockReturnValue(event);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(subscriptionMock.updateMany).toHaveBeenCalledWith({
      where: {
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_active_1",
        provider: { not: "ADMIN" },
        OR: [{ lastStripeEventAt: null }, { lastStripeEventAt: { lte: expect.any(Date) } }],
      },
      data: expect.objectContaining({
        status: "UNPAID",
        gracePeriodEndsAt: null,
      }),
    });
  });

  it("keeps renewal payment failures in past-due grace", async () => {
    mocks.constructEvent.mockReturnValue(invoiceEvent("invoice.payment_failed"));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(subscriptionMock.updateMany).toHaveBeenCalledWith({
      where: {
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_active_1",
        provider: { not: "ADMIN" },
        OR: [{ lastStripeEventAt: null }, { lastStripeEventAt: { lte: expect.any(Date) } }],
      },
      data: expect.objectContaining({
        status: "PAST_DUE",
        gracePeriodEndsAt: expect.any(Date),
      }),
    });
  });

  it("updates local state to TRIALING for completed subscription checkout", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    mocks.subscriptionsRetrieve.mockResolvedValue(trialingStripeSubscription());

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.subscriptionsRetrieve).toHaveBeenCalledWith("sub_trial_1");
    expect(subscriptionMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user_1",
          OR: [{ lastStripeEventAt: null }, { lastStripeEventAt: { lte: expect.any(Date) } }],
        }),
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
          lastStripeEventAt: expect.any(Date),
        }),
      }),
    );
    expect(processedMock.create).toHaveBeenCalledTimes(1);
    // No mapped recipient (the local row's user has no email selected here),
    // so neither the activation email nor the owner purchase alert fires.
    expect(mocks.sendAdminPurchaseAlert).not.toHaveBeenCalled();
  });

  it("sends the owner purchase alert once for a completed checkout with a mapped recipient", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    mocks.subscriptionsRetrieve.mockResolvedValue(trialingStripeSubscription());
    subscriptionMock.findFirst.mockResolvedValue(localSubscription({
      user: {
        id: "user_1",
        deletedAt: null,
        email: "buyer@example.com",
        firstName: "Buyer",
        preferredLocale: "en",
      },
    }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.sendSubscriptionActivatedEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendAdminPurchaseAlert).toHaveBeenCalledTimes(1);
    expect(mocks.sendAdminPurchaseAlert).toHaveBeenCalledWith({
      userId: "user_1",
      email: "buyer@example.com",
      plan: "INDIVIDUAL",
      interval: "YEAR",
      provider: "stripe",
      // Deduped on the Stripe event id so a redelivered webhook can't
      // double-notify the owner.
      dedupeKey: "stripe:evt_checkout_1",
    });
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
        where: expect.objectContaining({
          userId: "user_1",
          OR: [{ lastStripeEventAt: null }, { lastStripeEventAt: { lte: expect.any(Date) } }],
        }),
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
          where: expect.objectContaining({
            userId: "user_1",
            OR: [{ lastStripeEventAt: null }, { lastStripeEventAt: { lte: expect.any(Date) } }],
          }),
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
    // Reserved up-front, then released on failure so Stripe's retry re-processes.
    expect(processedMock.deleteMany).toHaveBeenCalled();
  });

  it("keeps webhook retryable when no local subscription/user can be mapped", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    subscriptionMock.findFirst.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(subscriptionMock.updateMany).not.toHaveBeenCalled();
    // Reserved up-front, then released on failure so Stripe's retry re-processes.
    expect(processedMock.deleteMany).toHaveBeenCalled();
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
    // Reserved up-front, then released on failure so the retry can re-process.
    expect(processedMock.create).toHaveBeenCalledTimes(1);
    expect(processedMock.deleteMany).toHaveBeenCalledTimes(1);

    mocks.mapStripePriceIdToPlanAndInterval.mockResolvedValueOnce({
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
    });
    const retry = await POST(request());

    expect(retry.status).toBe(200);
    expect(subscriptionMock.updateMany).toHaveBeenCalledTimes(1);
    // Reserve attempted on both deliveries; the retry's reservation sticks.
    expect(processedMock.create).toHaveBeenCalledTimes(2);
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

  it("clears pendingBillingInterval when a subscription_schedule is canceled out-of-band", async () => {
    // Without this handler, a dashboard-canceled schedule would leave the
    // user's row promising a cycle change that will never fire.
    mocks.constructEvent.mockReturnValue({
      id: "evt_sched_cancel_1",
      type: "subscription_schedule.canceled",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: "sched_abc",
          subscription: "sub_trial_1",
          metadata: { userId: "user_1", locateflow_pending_billing_interval: "MONTH" },
        },
      },
    });
    subscriptionMock.findMany.mockResolvedValueOnce([
      { userId: "user_1", stripeSubscriptionScheduleId: "sched_abc" },
    ]);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(subscriptionMock.update).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        pendingBillingInterval: null,
        pendingBillingIntervalEffectiveAt: null,
        stripeSubscriptionScheduleId: null,
      }),
    });
  });

  it("skips schedule clears for subscriptions whose scheduleId no longer matches", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_sched_stale_1",
      type: "subscription_schedule.released",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: "sched_abc",
          subscription: "sub_trial_1",
          metadata: { userId: "user_1" },
        },
      },
    });
    subscriptionMock.findMany.mockResolvedValueOnce([
      { userId: "user_1", stripeSubscriptionScheduleId: "sched_other" },
    ]);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(subscriptionMock.update).not.toHaveBeenCalled();
  });

  it("skips Stripe sync for an ADMIN manual-grant row (finding 6)", async () => {
    // A user whose Stripe sub was canceled is later given an admin manual
    // premium grant (provider=ADMIN). A stale customer.subscription.updated
    // arriving in Stripe's 72h retry window must NOT overwrite the ADMIN row
    // with provider=STRIPE + CANCELED and silently revoke the manual premium.
    mocks.constructEvent.mockReturnValue(subscriptionUpdatedEvent());
    subscriptionMock.findFirst.mockResolvedValue(
      localSubscription({
        provider: "ADMIN",
        status: "ACTIVE",
        accessType: "PAID",
        stripeSubscriptionId: null,
        premiumGrantedBy: "admin_1",
      }),
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    // The guard short-circuits BEFORE any write — the ADMIN row is untouched.
    expect(subscriptionMock.updateMany).not.toHaveBeenCalled();
    // Reservation stays marked (terminal no-op), so it is NOT released for retry.
    expect(processedMock.deleteMany).not.toHaveBeenCalled();
  });

  it("cancels duplicate live Stripe subscriptions on checkout completion (finding 3)", async () => {
    // A customer accumulated two live subscriptions from concurrent Checkout
    // sessions. After the new one is synced, the OTHER live sub must be
    // canceled so it can't keep billing invisibly.
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    subscriptionMock.findFirst.mockResolvedValue(
      localSubscription({ provider: "STRIPE", stripeSubscriptionId: "sub_old" }),
    );
    mocks.subscriptionsList.mockResolvedValue({
      data: [
        { id: "sub_trial_1", cancel_at_period_end: false }, // the one we keep
        { id: "sub_orphan", cancel_at_period_end: false }, // duplicate → cancel
        { id: "sub_winding_down", cancel_at_period_end: true }, // already ending → skip
      ],
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.subscriptionsList).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1", status: "active" }),
    );
    // Only the orphan is canceled — never the kept sub, never an already-ending one.
    expect(mocks.subscriptionsCancel).toHaveBeenCalledTimes(1);
    expect(mocks.subscriptionsCancel).toHaveBeenCalledWith("sub_orphan");
  });

  it("does not run the duplicate sweep for an ADMIN row on checkout completion", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    subscriptionMock.findFirst.mockResolvedValue(
      localSubscription({ provider: "ADMIN", status: "ACTIVE", accessType: "PAID" }),
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    // ADMIN row is skipped by the sync guard → no sweep, no cancels.
    expect(mocks.subscriptionsList).not.toHaveBeenCalled();
    expect(mocks.subscriptionsCancel).not.toHaveBeenCalled();
  });

  it("never fails the webhook if the duplicate-subscription sweep errors", async () => {
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    subscriptionMock.findFirst.mockResolvedValue(
      localSubscription({ provider: "STRIPE", stripeSubscriptionId: "sub_old" }),
    );
    mocks.subscriptionsList.mockRejectedValue(new Error("stripe list failed"));

    const response = await POST(request());

    // Best-effort cleanup must never turn into a webhook retry storm.
    expect(response.status).toBe(200);
    expect(mocks.subscriptionsCancel).not.toHaveBeenCalled();
  });
});
