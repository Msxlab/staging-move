import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { mapStripePriceIdToPlan } from "@/lib/billing";
import { isBillingProductionLike, requireStripeSecretKeyForMutation } from "@/lib/billing-config";
import { captureException, captureMessage } from "@/lib/sentry";
import { hasProcessedWebhookEvent, markWebhookEventProcessed } from "@/lib/webhook-idempotency";
import {
  sendPaymentFailedEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCanceledEmail,
} from "@/lib/email-service";
import Stripe from "stripe";

export const runtime = "nodejs";

async function lookupUserByStripeCustomer(stripeCustomerId: string | null | undefined) {
  if (!stripeCustomerId) return null;
  const sub = await prisma.subscription.findFirst({
    where: { stripeCustomerId },
    select: {
      userId: true,
      user: {
        select: { email: true, firstName: true, preferredLocale: true, deletedAt: true },
      },
    },
  });
  if (!sub?.user || sub.user.deletedAt || !sub.user.email) return null;
  return {
    userId: sub.userId,
    email: sub.user.email,
    firstName: sub.user.firstName || "there",
    locale: sub.user.preferredLocale,
  };
}

function formatDateInLocale(unixSeconds: number | null | undefined, locale: string | null | undefined): string | null {
  if (!unixSeconds) return null;
  const lang = (locale || "").toLowerCase().startsWith("es") ? "es-US" : "en-US";
  try {
    return new Date(unixSeconds * 1000).toLocaleDateString(lang, {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return null;
  }
}

function formatCurrency(amountMinor: number | null | undefined, currency: string | null | undefined): string | null {
  if (amountMinor == null || !currency) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function safeUserHint(userId: string | null | undefined) {
  if (!userId) return null;
  return userId.length > 8 ? `${userId.slice(0, 8)}...` : userId;
}

function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && typeof (value as any).id === "string") {
    return (value as any).id;
  }
  return null;
}

function metadataUserId(metadata: Stripe.Metadata | null | undefined) {
  const userId = metadata?.userId;
  return typeof userId === "string" && userId.trim() ? userId.trim() : null;
}

function retryableWebhookError(
  eventType: string,
  message: string,
  details: Record<string, unknown> = {},
): never {
  console.warn("[WEBHOOK] Stripe event not locally synced; keeping retryable", {
    eventType,
    ...details,
  });
  throw new Error(message);
}

function logStripeSubscriptionSync(input: {
  eventType: string;
  userId: string | null | undefined;
  metadataUserIdExists: boolean;
  localUserFound: boolean;
  stripeSubscriptionId: string | null | undefined;
  oldStatus: string | null | undefined;
  newStatus: string | null | undefined;
}) {
  console.info("[WEBHOOK] Stripe subscription local sync", {
    eventType: input.eventType,
    userHint: safeUserHint(input.userId),
    metadataUserIdExists: input.metadataUserIdExists,
    localUserFound: input.localUserFound,
    stripeSubscriptionIdFound: Boolean(input.stripeSubscriptionId),
    oldLocalStatus: input.oldStatus || null,
    newLocalStatus: input.newStatus || null,
  });
}

type LocalSubscriptionForWebhook = {
  id: string;
  userId: string;
  status: string | null;
  accessType: string | null;
  provider: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  user?: { id: string; deletedAt: Date | string | null } | null;
};

async function findLocalSubscriptionForWebhook(input: {
  userId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}): Promise<LocalSubscriptionForWebhook | null> {
  const OR: Array<Record<string, string>> = [];
  if (input.userId) OR.push({ userId: input.userId });
  if (input.stripeCustomerId) OR.push({ stripeCustomerId: input.stripeCustomerId });
  if (input.stripeSubscriptionId) OR.push({ stripeSubscriptionId: input.stripeSubscriptionId });
  if (OR.length === 0) return null;

  return prisma.subscription.findFirst({
    where: { OR },
    select: {
      id: true,
      userId: true,
      status: true,
      accessType: true,
      provider: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      user: { select: { id: true, deletedAt: true } },
    },
  }) as Promise<LocalSubscriptionForWebhook | null>;
}

async function retrieveStripeSubscription(
  stripe: Stripe,
  stripeSubscriptionId: string,
  eventType: string,
) {
  try {
    return await stripe.subscriptions.retrieve(stripeSubscriptionId);
  } catch (error: any) {
    retryableWebhookError(eventType, "Stripe subscription lookup failed", {
      stripeSubscriptionIdFound: true,
      reason: error?.message || "unknown",
    });
  }
}

function stripeDate(unixSeconds: number | null | undefined) {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

async function syncLocalSubscriptionFromStripe(input: {
  eventType: string;
  userId?: string | null;
  metadataUserIdExists: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscription: Stripe.Subscription;
  plan?: string | null;
  billingInterval?: string | null;
}) {
  const local = await findLocalSubscriptionForWebhook({
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
  });

  if (!local || local.user?.deletedAt) {
    retryableWebhookError(input.eventType, "Local subscription not found for Stripe event", {
      userHint: safeUserHint(input.userId),
      metadataUserIdExists: input.metadataUserIdExists,
      localUserFound: false,
      stripeSubscriptionIdFound: Boolean(input.stripeSubscriptionId),
    });
  }

  const stripeStatus = String(input.stripeSubscription.status);
  const newStatus = mapStripeStatusWithRenewal(input.stripeSubscription);
  const priceId = input.stripeSubscription.items?.data?.[0]?.price?.id || null;
  const trialEnd = stripeDate(input.stripeSubscription.trial_end);
  const currentPeriodEnd = stripeDate(input.stripeSubscription.current_period_end);
  // Prefer the actual Stripe price interval over the metadata.cycle hint.
  // metadata.cycle is set at checkout creation, but the customer portal can
  // switch the user between monthly and annual without updating it — relying
  // on metadata alone silently mislabels the row.
  const stripeInterval = input.stripeSubscription.items?.data?.[0]?.price?.recurring?.interval;
  const derivedBillingInterval =
    stripeInterval === "month" ? "MONTH" : stripeInterval === "year" ? "YEAR" : null;
  const updateData: Record<string, unknown> = {
    status: newStatus,
    provider: "STRIPE",
    platform: "web",
    accessType: stripeStatus === "trialing" || newStatus === "TRIAL_CANCELED" ? "FREE_TRIAL" : "PAID",
    billingInterval: derivedBillingInterval || input.billingInterval || "YEAR",
    trialEndsAt: trialEnd,
    firstChargeAt: trialEnd,
    autoRenew: !input.stripeSubscription.cancel_at_period_end,
    cancelAtPeriodEnd: Boolean(input.stripeSubscription.cancel_at_period_end),
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripePriceId: priceId,
    billingProductId: priceId,
    stripeCurrentPeriodEnd: currentPeriodEnd,
    currentPeriodEndsAt: currentPeriodEnd,
    gracePeriodEndsAt: null,
    lastSyncedAt: new Date(),
    plan: input.plan || "INDIVIDUAL",
    version: { increment: 1 },
  };

  const result = await prisma.subscription.updateMany({
    where: { userId: local.userId },
    data: updateData,
  });

  if (!result.count) {
    retryableWebhookError(input.eventType, "Local subscription update matched no rows", {
      userHint: safeUserHint(local.userId),
      metadataUserIdExists: input.metadataUserIdExists,
      localUserFound: true,
      stripeSubscriptionIdFound: Boolean(input.stripeSubscriptionId),
      oldLocalStatus: local.status || null,
      newLocalStatus: newStatus,
    });
  }

  logStripeSubscriptionSync({
    eventType: input.eventType,
    userId: local.userId,
    metadataUserIdExists: input.metadataUserIdExists,
    localUserFound: true,
    stripeSubscriptionId: input.stripeSubscriptionId,
    oldStatus: local.status,
    newStatus,
  });

  return { local, newStatus, priceId, trialEnd, currentPeriodEnd };
}


// Best-effort: never let an email failure break webhook idempotency.
// Stripe retries the entire webhook on non-2xx, so we explicitly swallow
// here instead of bubbling and forcing a redelivery for an unrelated reason.
function fireAndLogEmail(promise: Promise<unknown>, context: string): void {
  void promise.catch((err) => {
    console.error(`[WEBHOOK] Email dispatch failed (${context}):`, err);
    captureMessage(`[WEBHOOK] Email dispatch failed (${context})`, "warning");
  });
}

function stripeLivemodeMismatchResponse(event: Stripe.Event) {
  const productionLike = isBillingProductionLike(process.env);
  const allowLiveOutsideProduction =
    process.env.STRIPE_ALLOW_LIVE_WEBHOOKS_OUTSIDE_PRODUCTION === "true" ||
    process.env.ALLOW_STRIPE_LIVE_EVENTS_IN_NON_PRODUCTION === "true";

  if (productionLike && !event.livemode) {
    console.warn("[WEBHOOK] Stripe testmode event rejected in production billing environment", {
      eventId: event.id,
      type: event.type,
      appEnv: process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    });
    return NextResponse.json(
      {
        code: "STRIPE_LIVEMODE_MISMATCH",
        error: "Stripe event mode does not match this environment.",
        expectedLivemode: true,
        receivedLivemode: false,
        ignored: true,
      },
      { status: 400 },
    );
  }

  if (!productionLike && event.livemode && !allowLiveOutsideProduction) {
    console.warn("[WEBHOOK] Stripe live event rejected outside production billing environment", {
      eventId: event.id,
      type: event.type,
      appEnv: process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    });
    return NextResponse.json(
      {
        code: "STRIPE_LIVEMODE_MISMATCH",
        error: "Stripe event mode does not match this environment.",
        expectedLivemode: false,
        receivedLivemode: true,
        ignored: true,
      },
      { status: 400 },
    );
  }

  return null;
}

// POST /api/webhooks/stripe — Stripe webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    const webhookSecret = await getRuntimeConfigValue("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    let stripeSecretKey: string;
    try {
      stripeSecretKey = requireStripeSecretKeyForMutation(
        await getRuntimeConfigValue("STRIPE_SECRET_KEY"),
      );
    } catch (configErr: any) {
      // In production, a non-`sk_live_` key (or missing key) means real
      // payments will never settle. Fail loudly so Stripe retries while
      // ops investigates instead of silently 200-OK'ing dropped events.
      const reason = configErr?.message || "Stripe not configured";
      console.error("[WEBHOOK] Stripe config rejected webhook:", reason);
      captureMessage(`[WEBHOOK] Stripe config rejected webhook: ${reason}`, "error");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const livemodeMismatch = stripeLivemodeMismatchResponse(event);
    if (livemodeMismatch) return livemodeMismatch;

    // Replay protection — reject events older than 72 hours.
    //
    // Stripe retries failed webhooks for up to 3 days with exponential
    // backoff. A 5-minute window (the earlier value) silently dropped
    // every legitimate retry after a short outage — effectively making
    // Stripe's retry guarantee a no-op. 72h covers Stripe's full retry
    // horizon while still bounding the window for true replay attacks.
    // Idempotency via ProcessedWebhookEvent (below) guards against
    // duplicate application of the same event within that window.
    const eventAge = Date.now() / 1000 - event.created;
    const MAX_EVENT_AGE_SEC = 72 * 60 * 60; // 72 hours — matches Stripe retry horizon
    if (eventAge > MAX_EVENT_AGE_SEC) {
      console.warn(`[WEBHOOK] Rejecting stale Stripe event ${event.id} (age: ${Math.round(eventAge)}s, max: ${MAX_EVENT_AGE_SEC}s)`);
      return NextResponse.json({ received: true, stale: true });
    }

    // DB-backed idempotency — skip already-processed events (survives restarts)
    if (await hasProcessedWebhookEvent(event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") {
          captureMessage(`Unhandled Stripe checkout mode: ${session.mode || "unknown"}`, "warning");
          break;
        }

        const stripeCustomerId = stripeObjectId(session.customer);
        const stripeSubId = stripeObjectId(session.subscription);
        const userId = metadataUserId(session.metadata) ||
          (typeof session.client_reference_id === "string" && session.client_reference_id.trim()
            ? session.client_reference_id.trim()
            : null);
        const metadataUserIdExists = Boolean(metadataUserId(session.metadata));

        if (!userId) {
          retryableWebhookError(event.type, "Stripe checkout session missing user mapping", {
            metadataUserIdExists,
            localUserFound: false,
            stripeSubscriptionIdFound: Boolean(stripeSubId),
          });
        }
        if (!stripeCustomerId || !stripeSubId) {
          retryableWebhookError(event.type, "Stripe checkout session missing customer or subscription", {
            userHint: safeUserHint(userId),
            metadataUserIdExists,
            localUserFound: false,
            stripeSubscriptionIdFound: Boolean(stripeSubId),
          });
        }

        // Resolve plan: prefer metadata, fallback to line_items priceId
        let plan = (session.metadata?.plan as string) || undefined;
        const stripeSubscription = await retrieveStripeSubscription(stripe, stripeSubId, event.type);
        const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
        plan = plan || (await mapStripePriceIdToPlan(priceId)) || undefined;
        await syncLocalSubscriptionFromStripe({
          eventType: event.type,
          userId,
          metadataUserIdExists,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubId,
          stripeSubscription,
          plan: plan || "INDIVIDUAL",
          billingInterval: session.metadata?.cycle === "monthly" ? "MONTH" : "YEAR",
        });

        if (
          (session.metadata?.accessType === "FREE_TRIAL" || session.metadata?.accessType === "PAID") &&
          userId
        ) {
          try {
            const pendingRedemption = await (prisma as any).acquisitionRedemption.findFirst({
              where: {
                userId,
                accessType: session.metadata.accessType,
                status: "PENDING_CHECKOUT",
              },
              orderBy: { createdAt: "desc" },
              select: { id: true, campaignId: true },
            });
            if (pendingRedemption) {
              // Gate the PENDING_CHECKOUT → REDEEMED flip on the current
              // status so the count increment runs at most once per
              // redemption. ProcessedWebhookEvent guards against most
              // double-deliveries, but Stripe can still redeliver before
              // the mark commits — the increment is not idempotent on its
              // own.
              const flipped = await (prisma as any).acquisitionRedemption.updateMany({
                where: { id: pendingRedemption.id, status: "PENDING_CHECKOUT" },
                data: { status: "REDEEMED" },
              });
              if (flipped.count > 0 && pendingRedemption.campaignId) {
                await (prisma as any).acquisitionCampaign.update({
                  where: { id: pendingRedemption.campaignId },
                  data: { redemptionCount: { increment: 1 } },
                });
              }
            }
          } catch {
            // Redemptions are additive audit records. Keep webhook delivery
            // healthy if the campaign migration is not present yet.
          }
        }

        const recipient = await lookupUserByStripeCustomer(stripeCustomerId);
        if (recipient) {
          fireAndLogEmail(
            sendSubscriptionActivatedEmail({
              userEmail: recipient.email,
              userName: recipient.firstName,
              planLabel: plan || "subscription",
              amountFormatted: formatCurrency(session.amount_total, session.currency),
              locale: recipient.locale,
              dedupeKey: `stripe:checkout-completed:${event.id}`,
            }),
            `checkout.session.completed userHint=${safeUserHint(recipient.userId)}`,
          );
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = stripeObjectId(subscription.customer);
        const stripeSubId = subscription.id || null;
        const userId = metadataUserId(subscription.metadata);
        const stripePriceId = subscription.items?.data?.[0]?.price?.id;
        const metadataUserIdExists = Boolean(userId);

        // Map stripePriceId to plan name
        const plan = await mapStripePriceIdToPlan(stripePriceId) ||
          (typeof subscription.metadata?.plan === "string" ? subscription.metadata.plan : null) ||
          "INDIVIDUAL";

        await syncLocalSubscriptionFromStripe({
          eventType: event.type,
          userId,
          metadataUserIdExists,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubId,
          stripeSubscription: subscription,
          plan,
          billingInterval: subscription.metadata?.cycle === "monthly" ? "MONTH" : "YEAR",
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = String(subscription.customer);
        const stripePriceId = subscription.items?.data?.[0]?.price?.id;
        const plan = await mapStripePriceIdToPlan(stripePriceId);

        // Scope by stripeSubscriptionId so a customer with multiple
        // subscriptions (rare, but possible after admin reassignment)
        // does not get every row CANCELED at once.
        await prisma.subscription.updateMany({
          where: {
            stripeCustomerId,
            stripeSubscriptionId: subscription.id,
          },
          data: {
            status: "CANCELED",
            provider: "STRIPE",
            platform: "web",
            autoRenew: false,
            cancelAtPeriodEnd: false,
            canceledAt: new Date(),
            lastSyncedAt: new Date(),
            version: { increment: 1 },
          },
        });

        const recipient = await lookupUserByStripeCustomer(stripeCustomerId);
        if (recipient) {
          fireAndLogEmail(
            sendSubscriptionCanceledEmail({
              userEmail: recipient.email,
              userName: recipient.firstName,
              planLabel: plan || "subscription",
              accessEndsOn: formatDateInLocale(subscription.current_period_end, recipient.locale),
              locale: recipient.locale,
              dedupeKey: `stripe:subscription-deleted:${event.id}`,
            }),
            `customer.subscription.deleted userHint=${safeUserHint(recipient.userId)}`,
          );
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // Handles recurring payment success — ensures plan stays ACTIVE
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = String(invoice.customer);
        const stripePriceId = invoice.lines?.data?.[0]?.price?.id;
        const plan = await mapStripePriceIdToPlan(stripePriceId);

        if ((invoice.amount_paid || 0) === 0 && invoice.billing_reason === "subscription_create") {
          break;
        }

        const updateData: any = {
          status: "ACTIVE",
          provider: "STRIPE",
          platform: "web",
          accessType: "PAID",
          autoRenew: true,
          cancelAtPeriodEnd: false,
          gracePeriodEndsAt: null,
          lastSyncedAt: new Date(),
          version: { increment: 1 },
        };
        if (plan) updateData.plan = plan;
        if (stripePriceId) updateData.billingProductId = stripePriceId;
        if (invoice.subscription) {
          updateData.stripeSubscriptionId = String(invoice.subscription);
        }

        await prisma.subscription.updateMany({
          where: { stripeCustomerId },
          data: updateData,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = String(invoice.customer);
        const gracePeriodEndsAt = new Date();
        gracePeriodEndsAt.setUTCDate(gracePeriodEndsAt.getUTCDate() + 7);

        await prisma.subscription.updateMany({
          where: { stripeCustomerId },
          data: {
            status: "PAST_DUE",
            provider: "STRIPE",
            platform: "web",
            gracePeriodEndsAt,
            lastSyncedAt: new Date(),
            version: { increment: 1 },
          },
        });

        const recipient = await lookupUserByStripeCustomer(stripeCustomerId);
        if (recipient) {
          fireAndLogEmail(
            sendPaymentFailedEmail({
              userEmail: recipient.email,
              userName: recipient.firstName,
              amountFormatted: formatCurrency(invoice.amount_due, invoice.currency),
              nextAttemptOn: formatDateInLocale(invoice.next_payment_attempt, recipient.locale),
              locale: recipient.locale,
              dedupeKey: `stripe:payment-failed:${event.id}`,
            }),
            `invoice.payment_failed userHint=${safeUserHint(recipient.userId)}`,
          );
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const stripeCustomerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
        if (stripeCustomerId) {
          // Resolve the underlying subscription via the charge's invoice when
          // possible — refunding one charge should not REFUND every sub on
          // the customer if they have more than one.
          let stripeSubscriptionId: string | null = null;
          const invoiceRef = charge.invoice;
          if (invoiceRef) {
            const invoiceId = typeof invoiceRef === "string" ? invoiceRef : invoiceRef.id;
            try {
              const invoice = await stripe.invoices.retrieve(invoiceId);
              if (invoice.subscription) {
                stripeSubscriptionId = typeof invoice.subscription === "string"
                  ? invoice.subscription
                  : invoice.subscription.id;
              }
            } catch (err: any) {
              console.warn("[WEBHOOK] charge.refunded invoice lookup failed:", err?.message);
            }
          }

          await prisma.subscription.updateMany({
            where: stripeSubscriptionId
              ? { stripeCustomerId, stripeSubscriptionId }
              : { stripeCustomerId },
            data: {
              status: "REFUNDED",
              provider: "STRIPE",
              platform: "web",
              autoRenew: false,
              cancelAtPeriodEnd: false,
              lastSyncedAt: new Date(),
              version: { increment: 1 },
            },
          });
        }
        break;
      }

      default:
        captureMessage(`Unhandled Stripe event: ${event.type}`, "warning");
    }

    const markResult = await markWebhookEventProcessed(event.id, "stripe");
    if (markResult === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    captureException(error, { route: "/api/webhooks/stripe" });
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

function mapStripeStatus(stripeStatus: string): string {
  const map: Record<string, string> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
    incomplete: "INCOMPLETE",
    incomplete_expired: "EXPIRED",
    paused: "PAST_DUE",
  };
  return map[stripeStatus] || "UNKNOWN";
}

function mapStripeStatusWithRenewal(subscription: Stripe.Subscription): string {
  if (subscription.status === "trialing" && subscription.cancel_at_period_end) return "TRIAL_CANCELED";
  if (subscription.status === "active" && subscription.cancel_at_period_end) return "CANCEL_AT_PERIOD_END";
  return mapStripeStatus(subscription.status);
}
