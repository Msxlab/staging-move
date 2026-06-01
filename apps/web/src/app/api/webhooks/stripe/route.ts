import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { mapStripePriceIdToPlanAndInterval } from "@/lib/billing";
import { isBillingPlan } from "@/lib/shared-billing";
import { reconcileSeatsForOwner } from "@/lib/workspace-ownership";
import { isBillingProductionLike, requireStripeSecretKeyForMutation } from "@/lib/billing-config";
import { captureException, captureMessage } from "@/lib/sentry";
import { emitSecurityEvent } from "@/lib/security-events";
import { hasProcessedWebhookEvent, markWebhookEventProcessed } from "@/lib/webhook-idempotency";
import { isMissingDbColumnError, warnSchemaCompatibilityFallback } from "@/lib/db-schema-compat";
import { formatPlanLabel, fireAndLogEmail as fireAndLogBillingEmail } from "@/lib/billing-email-utils";
import {
  sendPaymentFailedEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionResumedEmail,
  sendSubscriptionUpdatedEmail,
} from "@/lib/email-service";
import Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Resolve a Subscription.plan from webhook inputs, preserving each call site's
 * candidate precedence. Every candidate is validated against the BillingPlan
 * union so unrecognized Stripe metadata (typos, a removed tier like BUSINESS)
 * is rejected rather than persisted verbatim and silently mis-read on the next
 * entitlement read. Falls back to INDIVIDUAL when nothing resolves.
 */
function resolveWebhookPlan(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (isBillingPlan(candidate)) return candidate;
  }
  return "INDIVIDUAL";
}

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

function metadataBillingInterval(metadata: Stripe.Metadata | null | undefined): "MONTH" | "YEAR" | null {
  if (metadata?.billingInterval === "MONTH" || metadata?.billingInterval === "YEAR") {
    return metadata.billingInterval;
  }
  if (metadata?.cycle === "monthly") return "MONTH";
  if (metadata?.cycle === "yearly") return "YEAR";
  return null;
}

function stripePriceBillingInterval(price: Stripe.Price | null | undefined): "MONTH" | "YEAR" | null {
  const interval = price?.recurring?.interval;
  if (interval === "month") return "MONTH";
  if (interval === "year") return "YEAR";
  return null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return stripeObjectId((invoice as any).subscription);
}

function invoiceCustomerId(invoice: Stripe.Invoice): string | null {
  return stripeObjectId((invoice as any).customer);
}

function invoicePrice(invoice: Stripe.Invoice): Stripe.Price | null {
  return (invoice.lines?.data?.[0]?.price as Stripe.Price | null | undefined) || null;
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
  plan: string | null;
  billingInterval: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionScheduleId: string | null;
  stripePriceId: string | null;
  pendingBillingInterval: string | null;
  lastStripeEventAt?: Date | string | null;
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

  const baseSelect = {
    id: true,
    userId: true,
    status: true,
    accessType: true,
    provider: true,
    plan: true,
    billingInterval: true,
    stripeCustomerId: true,
    stripeSubscriptionId: true,
    stripeSubscriptionScheduleId: true,
    stripePriceId: true,
    pendingBillingInterval: true,
    user: { select: { id: true, deletedAt: true } },
  } as const;

  // Select lastStripeEventAt for out-of-order protection, but fall back to the
  // base select if a rolling deploy is still running against the pre-migration
  // schema — otherwise every webhook sync would 500 until the column lands.
  try {
    return (await prisma.subscription.findFirst({
      where: { OR },
      select: { ...baseSelect, lastStripeEventAt: true },
    })) as LocalSubscriptionForWebhook | null;
  } catch (error) {
    if (!isMissingDbColumnError(error)) throw error;
    warnSchemaCompatibilityFallback("webhook:find-subscription-last-event", error);
    return (await prisma.subscription.findFirst({
      where: { OR },
      select: baseSelect,
    })) as LocalSubscriptionForWebhook | null;
  }
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

function toEventTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

// Applies a webhook write with out-of-order protection: only rows whose
// lastStripeEventAt is older-or-equal to this event (or null) are written, and
// the column is advanced to the event timestamp. `lte` (not `lt`) keeps the
// existing last-writer-wins behavior for two events sharing the same
// second-granularity `event.created`. During a rolling deploy the column may
// not exist yet — fall back to the unguarded write so webhooks keep flowing
// until the migration lands.
async function applyStripeWebhookUpdate(input: {
  scope: string;
  where: Record<string, unknown>;
  data: Record<string, unknown>;
  eventDate: Date;
}): Promise<{ count: number; guarded: boolean }> {
  try {
    const result = await prisma.subscription.updateMany({
      where: {
        ...input.where,
        OR: [{ lastStripeEventAt: null }, { lastStripeEventAt: { lte: input.eventDate } }],
      },
      data: { ...input.data, lastStripeEventAt: input.eventDate },
    });
    return { count: result.count, guarded: true };
  } catch (error) {
    if (!isMissingDbColumnError(error)) throw error;
    warnSchemaCompatibilityFallback(input.scope, error);
    const result = await prisma.subscription.updateMany({
      where: input.where,
      data: input.data,
    });
    return { count: result.count, guarded: false };
  }
}

async function syncLocalSubscriptionFromStripe(input: {
  eventType: string;
  eventDate: Date;
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
  // firstChargeAt marks when a trial converts to a paid charge. Only write it
  // while a trial end is known; a later non-trial sync (trial_end === null)
  // must not null out the timestamp the checkout flow already recorded.
  if (trialEnd) {
    updateData.firstChargeAt = trialEnd;
  }
  if (local.pendingBillingInterval && derivedBillingInterval === local.pendingBillingInterval) {
    updateData.pendingBillingInterval = null;
    updateData.pendingPlan = null;
    updateData.pendingBillingIntervalEffectiveAt = null;
    updateData.stripeSubscriptionScheduleId = null;
  }

  // Out-of-order protection: if we've already applied a strictly newer Stripe
  // event to this row, this delivery is a stale retry of superseded state —
  // skip it so it can't roll the subscription back to an older status.
  const storedEventTime = toEventTime(local.lastStripeEventAt);
  if (storedEventTime !== null && input.eventDate.getTime() < storedEventTime) {
    console.info("[WEBHOOK] Skipping stale Stripe event (older than last applied)", {
      eventType: input.eventType,
      userHint: safeUserHint(local.userId),
      eventDate: input.eventDate.toISOString(),
      lastAppliedAt: new Date(storedEventTime).toISOString(),
    });
    return { skipped: true as const, local, newStatus, priceId, trialEnd, currentPeriodEnd };
  }

  const { count, guarded } = await applyStripeWebhookUpdate({
    scope: "webhook:sync-subscription",
    where: { userId: local.userId },
    data: updateData,
    eventDate: input.eventDate,
  });

  if (!count) {
    if (guarded) {
      // A concurrently-processed newer event already advanced this row past
      // our timestamp (or the row was removed between read and write). Either
      // way a retry can't usefully re-apply older state — treat as a no-op.
      console.info("[WEBHOOK] Stripe sync superseded by newer concurrent event", {
        eventType: input.eventType,
        userHint: safeUserHint(local.userId),
      });
      return { skipped: true as const, local, newStatus, priceId, trialEnd, currentPeriodEnd };
    }
    retryableWebhookError(input.eventType, "Local subscription update matched no rows", {
      userHint: safeUserHint(local.userId),
      metadataUserIdExists: input.metadataUserIdExists,
      localUserFound: true,
      stripeSubscriptionIdFound: Boolean(input.stripeSubscriptionId),
      oldLocalStatus: local.status || null,
      newLocalStatus: newStatus,
    });
  }

  // A plan change can shrink the seat limit — reconcile the owner's workspaces
  // (best-effort; demotes the newest over-limit members to read-only OVERFLOW,
  // restores them on upgrade). No-op for personal/solo workspaces.
  await reconcileSeatsForOwner(local.userId).catch(() => {});

  logStripeSubscriptionSync({
    eventType: input.eventType,
    userId: local.userId,
    metadataUserIdExists: input.metadataUserIdExists,
    localUserFound: true,
    stripeSubscriptionId: input.stripeSubscriptionId,
    oldStatus: local.status,
    newStatus,
  });

  return { skipped: false as const, local, newStatus, priceId, trialEnd, currentPeriodEnd };
}


// Best-effort: never let an email failure break webhook idempotency.
// Stripe retries the entire webhook on non-2xx, so we explicitly swallow
// here instead of bubbling and forcing a redelivery for an unrelated reason.
function fireAndLogEmail(promise: Promise<unknown>, context: string): void {
  fireAndLogBillingEmail(promise, context, { logPrefix: "[WEBHOOK]", captureWarning: true });
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

// Stripe-published guidance lists 256KB as the realistic upper bound
// for webhook payloads (a maximally fat invoice.payment_succeeded with
// many line items is well under this). The middleware exempts
// /api/webhooks/* from the global body-size limit so signature
// verification can run on the raw bytes — re-introduce a per-route
// ceiling here so a hostile client can't stream a multi-megabyte body
// at us hoping the constructEvent buffer trips on it.
const STRIPE_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;

// POST /api/webhooks/stripe — Stripe webhook handler
export async function POST(request: NextRequest) {
  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > STRIPE_WEBHOOK_MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > STRIPE_WEBHOOK_MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
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
      emitSecurityEvent({
        type: "WEBHOOK_SIG_FAILURE",
        severity: "warn",
        group: "webhook",
        context: {
          provider: "stripe",
          reason: "signature_verification_failed",
          environment: process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
          signatureLength: signature.length,
          bodyLength: Buffer.byteLength(body, "utf8"),
          correlationId: request.headers.get("stripe-request-id") || null,
        },
      });
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

    // Wall-clock time this event was created, used for out-of-order protection
    // (see applyStripeWebhookUpdate / syncLocalSubscriptionFromStripe).
    const eventDate = new Date(event.created * 1000);

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

        const stripeSubscription = await retrieveStripeSubscription(stripe, stripeSubId, event.type);
        const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
        const mappedPrice = await mapStripePriceIdToPlanAndInterval(priceId);
        const plan = resolveWebhookPlan(session.metadata?.plan as string, mappedPrice?.plan);
        await syncLocalSubscriptionFromStripe({
          eventType: event.type,
          eventDate,
          userId,
          metadataUserIdExists,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubId,
          stripeSubscription,
          plan,
          billingInterval: mappedPrice?.billingInterval || metadataBillingInterval(session.metadata),
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
              planLabel: plan ? formatPlanLabel(plan) : "subscription",
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
      case "customer.subscription.updated":
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = stripeObjectId(subscription.customer);
        const stripeSubId = subscription.id || null;
        const userId = metadataUserId(subscription.metadata);
        const stripePriceId = subscription.items?.data?.[0]?.price?.id;
        const metadataUserIdExists = Boolean(userId);

        const mappedPrice = await mapStripePriceIdToPlanAndInterval(stripePriceId);
        const plan = resolveWebhookPlan(
          mappedPrice?.plan,
          typeof subscription.metadata?.plan === "string" ? subscription.metadata.plan : null,
        );

        const sync = await syncLocalSubscriptionFromStripe({
          eventType: event.type,
          eventDate,
          userId,
          metadataUserIdExists,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubId,
          stripeSubscription: subscription,
          plan,
          billingInterval: mappedPrice?.billingInterval || metadataBillingInterval(subscription.metadata),
        });

        if (event.type === "customer.subscription.updated" && !sync.skipped) {
          const recipient = await lookupUserByStripeCustomer(stripeCustomerId);
          if (recipient) {
            const oldStatus = sync.local.status || null;
            const newStatus = sync.newStatus;
            const currentPeriodEndText = formatDateInLocale(subscription.current_period_end, recipient.locale);
            const periodKey = subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString().slice(0, 10)
              : "unknown";
            const wasRenewalCanceled = oldStatus === "CANCEL_AT_PERIOD_END" || oldStatus === "TRIAL_CANCELED";
            const isRenewalCanceled = newStatus === "CANCEL_AT_PERIOD_END" || newStatus === "TRIAL_CANCELED";
            const isRenewalActive = newStatus === "ACTIVE" || newStatus === "TRIALING";

            if (!wasRenewalCanceled && isRenewalCanceled) {
              fireAndLogEmail(
                sendSubscriptionCanceledEmail({
                  userEmail: recipient.email,
                  userName: recipient.firstName,
                  planLabel: formatPlanLabel(plan),
                  accessEndsOn: currentPeriodEndText,
                  locale: recipient.locale,
                  dedupeKey: `subscription:renewal-canceled:${stripeSubId}:${periodKey}`,
                  metadata: {
                    userId: recipient.userId,
                    subscriptionId: sync.local.id,
                    provider: "STRIPE",
                    oldStatus,
                    newStatus,
                  },
                }),
                `customer.subscription.updated cancel userHint=${safeUserHint(recipient.userId)}`,
              );
            } else if (wasRenewalCanceled && isRenewalActive) {
              fireAndLogEmail(
                sendSubscriptionResumedEmail({
                  userEmail: recipient.email,
                  userName: recipient.firstName,
                  planLabel: formatPlanLabel(plan),
                  renewsOn: currentPeriodEndText,
                  locale: recipient.locale,
                  dedupeKey: `subscription:renewal-resumed:${stripeSubId}:${periodKey}`,
                  metadata: {
                    userId: recipient.userId,
                    subscriptionId: sync.local.id,
                    provider: "STRIPE",
                    oldStatus,
                    newStatus,
                  },
                }),
                `customer.subscription.updated resume userHint=${safeUserHint(recipient.userId)}`,
              );
            } else if (sync.local.stripePriceId && stripePriceId && sync.local.stripePriceId !== stripePriceId) {
              fireAndLogEmail(
                sendSubscriptionUpdatedEmail({
                  userEmail: recipient.email,
                  userName: recipient.firstName,
                  planLabel: formatPlanLabel(plan),
                  billingInterval: mappedPrice?.billingInterval || metadataBillingInterval(subscription.metadata) || null,
                  effectiveOn: currentPeriodEndText,
                  locale: recipient.locale,
                  dedupeKey: `stripe:subscription-updated:${stripeSubId}:${stripePriceId}:${periodKey}`,
                  metadata: {
                    userId: recipient.userId,
                    subscriptionId: sync.local.id,
                    provider: "STRIPE",
                    oldStatus,
                    newStatus,
                  },
                }),
                `customer.subscription.updated plan userHint=${safeUserHint(recipient.userId)}`,
              );
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = String(subscription.customer);
        const stripePriceId = subscription.items?.data?.[0]?.price?.id;
        const mappedPrice = await mapStripePriceIdToPlanAndInterval(stripePriceId);
        const plan = resolveWebhookPlan(
          mappedPrice?.plan,
          typeof subscription.metadata?.plan === "string" ? subscription.metadata.plan : null,
        );
        const periodEnd = stripeDate(subscription.current_period_end);
        const trialEnd = stripeDate(subscription.trial_end);

        // Scope by stripeSubscriptionId so a customer with multiple
        // subscriptions (rare, but possible after admin reassignment)
        // does not get every row CANCELED at once. Also skip rows that
        // have been switched to a manual admin grant — those should not
        // be flipped to CANCELED by a stale Stripe deletion.
        const deleteResult = await applyStripeWebhookUpdate({
          scope: "webhook:subscription-deleted",
          eventDate,
          where: {
            stripeCustomerId,
            stripeSubscriptionId: subscription.id,
            provider: { not: "ADMIN" },
          },
          data: {
            status: "CANCELED",
            provider: "STRIPE",
            platform: "web",
            plan,
            accessType: subscription.status === "trialing" ? "FREE_TRIAL" : "PAID",
            billingInterval: mappedPrice?.billingInterval ||
              stripePriceBillingInterval(subscription.items?.data?.[0]?.price as Stripe.Price | null | undefined) ||
              metadataBillingInterval(subscription.metadata),
            stripeCustomerId,
            stripeSubscriptionId: subscription.id,
            stripePriceId,
            billingProductId: stripePriceId,
            currentPeriodEndsAt: periodEnd,
            stripeCurrentPeriodEnd: periodEnd,
            trialEndsAt: trialEnd,
            autoRenew: false,
            cancelAtPeriodEnd: false,
            canceledAt: new Date(),
            lastSyncedAt: new Date(),
            version: { increment: 1 },
          },
        });

        // Skip the cancellation email when nothing was written — either a
        // newer event already superseded this deletion, or there was no
        // matching row to cancel.
        const recipient = deleteResult.count > 0
          ? await lookupUserByStripeCustomer(stripeCustomerId)
          : null;
        if (recipient) {
          // Owner's access just lapsed → collapse any workspaces they own to a
          // single seat so members stop having write access to an unpaid plan.
          await reconcileSeatsForOwner(recipient.userId).catch(() => {});
          fireAndLogEmail(
            sendSubscriptionCanceledEmail({
              userEmail: recipient.email,
              userName: recipient.firstName,
              planLabel: plan ? formatPlanLabel(plan) : "subscription",
              accessEndsOn: formatDateInLocale(subscription.current_period_end, recipient.locale),
              locale: recipient.locale,
              dedupeKey: `stripe:subscription-deleted:${event.id}`,
            }),
            `customer.subscription.deleted userHint=${safeUserHint(recipient.userId)}`,
          );
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        // Handles recurring payment success — ensures plan stays ACTIVE.
        //
        // Scope the update to (stripeCustomerId, stripeSubscriptionId)
        // whenever the invoice has a subscription. Multi-subscription
        // customers must not have unrelated rows flipped to ACTIVE on
        // one sub's renewal. For non-subscription invoices (rare; e.g.
        // ad-hoc charges) we fall back to the customer scope.
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoiceCustomerId(invoice);
        const stripeSubscriptionId = invoiceSubscriptionId(invoice);
        const stripePrice = invoicePrice(invoice);
        const stripePriceId = stripePrice?.id || null;
        const mappedPrice = await mapStripePriceIdToPlanAndInterval(stripePriceId);

        if ((invoice.amount_paid || 0) === 0 && invoice.billing_reason === "subscription_create") {
          break;
        }

        if (stripeSubscriptionId) {
          const stripeSubscription = await retrieveStripeSubscription(stripe, stripeSubscriptionId, event.type);
          const subscriptionCustomerId = stripeObjectId(stripeSubscription.customer) || stripeCustomerId;
          const subscriptionPrice = stripeSubscription.items?.data?.[0]?.price as Stripe.Price | null | undefined;
          const subscriptionPriceId = subscriptionPrice?.id || stripePriceId;
          const subscriptionMappedPrice = await mapStripePriceIdToPlanAndInterval(subscriptionPriceId);

          await syncLocalSubscriptionFromStripe({
            eventType: event.type,
            eventDate,
            userId: metadataUserId(stripeSubscription.metadata),
            metadataUserIdExists: Boolean(metadataUserId(stripeSubscription.metadata)),
            stripeCustomerId: subscriptionCustomerId,
            stripeSubscriptionId,
            stripeSubscription,
            plan: resolveWebhookPlan(
              subscriptionMappedPrice?.plan,
              typeof stripeSubscription.metadata?.plan === "string" ? stripeSubscription.metadata.plan : null,
              mappedPrice?.plan,
            ),
            billingInterval:
              subscriptionMappedPrice?.billingInterval ||
              mappedPrice?.billingInterval ||
              stripePriceBillingInterval(subscriptionPrice) ||
              stripePriceBillingInterval(stripePrice) ||
              metadataBillingInterval(stripeSubscription.metadata),
          });
          break;
        }

        if (!stripeCustomerId) {
          break;
        }

        const updateData: any = {
          status: "ACTIVE",
          provider: "STRIPE",
          platform: "web",
          accessType: "PAID",
          billingInterval: mappedPrice?.billingInterval || stripePriceBillingInterval(stripePrice),
          stripeCustomerId,
          autoRenew: true,
          cancelAtPeriodEnd: false,
          gracePeriodEndsAt: null,
          trialEndsAt: null,
          lastSyncedAt: new Date(),
          version: { increment: 1 },
        };
        if (mappedPrice?.plan) updateData.plan = mappedPrice.plan;
        if (stripePriceId) {
          updateData.stripePriceId = stripePriceId;
          updateData.billingProductId = stripePriceId;
        }

        await applyStripeWebhookUpdate({
          scope: "webhook:invoice-paid-customer",
          eventDate,
          where: {
            stripeCustomerId,
            // Defense against stale stripeCustomerId on a row that has
            // since been switched to a manual admin grant. grant_premium
            // clears stripeCustomerId on write, but legacy rows may still
            // carry it; never overwrite an admin manual premium row.
            provider: { not: "ADMIN" },
          },
          data: updateData,
        });
        break;
      }

      case "invoice.payment_action_required":
      case "invoice.payment_failed": {
        // Same multi-sub scoping rule as invoice.payment_succeeded:
        // scope to the invoice's subscription when known so unrelated
        // subs on the same customer don't get flipped to PAST_DUE.
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoiceCustomerId(invoice);
        const stripeSubscriptionId = invoiceSubscriptionId(invoice);
        const stripePrice = invoicePrice(invoice);
        const stripePriceId = stripePrice?.id || null;
        const mappedPrice = await mapStripePriceIdToPlanAndInterval(stripePriceId);
        const gracePeriodEndsAt = new Date();
        gracePeriodEndsAt.setUTCDate(gracePeriodEndsAt.getUTCDate() + 7);

        if (!stripeCustomerId) {
          break;
        }

        const updateData: any = {
          status: "PAST_DUE",
          provider: "STRIPE",
          platform: "web",
          stripeCustomerId,
          gracePeriodEndsAt,
          lastSyncedAt: new Date(),
          version: { increment: 1 },
        };
        if (mappedPrice?.plan) updateData.plan = mappedPrice.plan;
        if (mappedPrice?.billingInterval || stripePriceBillingInterval(stripePrice)) {
          updateData.billingInterval = mappedPrice?.billingInterval || stripePriceBillingInterval(stripePrice);
        }
        if (stripePriceId) {
          updateData.stripePriceId = stripePriceId;
          updateData.billingProductId = stripePriceId;
        }
        if (stripeSubscriptionId) {
          updateData.stripeSubscriptionId = stripeSubscriptionId;
        }

        const paymentFailedResult = await applyStripeWebhookUpdate({
          scope: "webhook:payment-failed",
          eventDate,
          where: stripeSubscriptionId
            ? { stripeCustomerId, stripeSubscriptionId, provider: { not: "ADMIN" } }
            : { stripeCustomerId, provider: { not: "ADMIN" } },
          data: updateData,
        });

        // Don't dun the user when a newer event already superseded this
        // failure (or no row matched) — the PAST_DUE state wasn't applied.
        const recipient = paymentFailedResult.count > 0
          ? await lookupUserByStripeCustomer(stripeCustomerId)
          : null;
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

      case "subscription_schedule.released":
      case "subscription_schedule.canceled":
      case "subscription_schedule.aborted":
      case "subscription_schedule.completed": {
        // Schedule lifecycle events. The happy path for our deferred
        // yearly→monthly downgrade is:
        //   subscription_schedule.updated → phase advance → released →
        //   customer.subscription.updated (price changes to monthly)
        // and `syncLocalSubscriptionFromStripe` clears the pending fields
        // when derivedBillingInterval matches local.pendingBillingInterval.
        //
        // BUT if the schedule is canceled or aborted out-of-band — e.g. a
        // support agent canceling it from the Stripe Dashboard, or a payment
        // failure that aborts the schedule — no subsequent
        // customer.subscription.updated will carry the new price, so the
        // local pendingBillingInterval would stay stale forever. Clear it
        // here so the UI stops promising a cycle change that won't happen.
        const schedule = event.data.object as Stripe.SubscriptionSchedule;
        const stripeSubscriptionId = stripeObjectId(schedule.subscription);
        const metadataUser = metadataUserId(schedule.metadata);
        const candidates = await prisma.subscription.findMany({
          where: {
            OR: [
              ...(stripeSubscriptionId ? [{ stripeSubscriptionId }] : []),
              { stripeSubscriptionScheduleId: schedule.id },
              ...(metadataUser ? [{ userId: metadataUser }] : []),
            ],
          },
          select: { userId: true, stripeSubscriptionScheduleId: true },
        });
        for (const candidate of candidates) {
          if (candidate.stripeSubscriptionScheduleId !== schedule.id) continue;
          try {
            await prisma.subscription.update({
              where: { userId: candidate.userId },
              data: {
                pendingBillingInterval: null,
                pendingPlan: null,
                pendingBillingIntervalEffectiveAt: null,
                stripeSubscriptionScheduleId: null,
                lastSyncedAt: new Date(),
                version: { increment: 1 },
              },
            });
          } catch (err) {
            console.warn("[WEBHOOK] subscription_schedule pending clear failed:", {
              eventType: event.type,
              scheduleId: schedule.id,
              error: (err as Error)?.message,
            });
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const stripeCustomerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
        // charge.refunded fires on partial refunds too (e.g. a goodwill
        // credit on an annual plan). `charge.refunded` is true only when the
        // charge is *fully* refunded; revoking access on a partial refund
        // would lock out a still-paid user. Skip anything but a full refund.
        const fullyRefunded =
          charge.refunded === true ||
          (typeof charge.amount === "number" &&
            typeof charge.amount_refunded === "number" &&
            charge.amount > 0 &&
            charge.amount_refunded >= charge.amount);
        if (stripeCustomerId && fullyRefunded) {
          const metadataUserId = typeof charge.metadata?.userId === "string" ? charge.metadata.userId : null;
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

          await applyStripeWebhookUpdate({
            scope: "webhook:charge-refunded",
            eventDate,
            where: stripeSubscriptionId
              ? { stripeCustomerId, stripeSubscriptionId, ...(metadataUserId ? { userId: metadataUserId } : {}), provider: { not: "ADMIN" } }
              : { stripeCustomerId, ...(metadataUserId ? { userId: metadataUserId } : {}), provider: { not: "ADMIN" } },
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
          // Refunded owner has lost access → collapse owned workspaces to a
          // single seat (members demoted to OVERFLOW).
          const refundRecipient = await lookupUserByStripeCustomer(stripeCustomerId);
          if (refundRecipient) {
            await reconcileSeatsForOwner(refundRecipient.userId).catch(() => {});
          }
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
    // Stripe `paused` (pause_collection) is an intentional, resumable pause —
    // not a dunning/payment failure. We have no PAUSED status, and either way
    // a paused subscription should not grant premium, so map it to CANCELED:
    // access ends cleanly without surfacing the "update your payment method"
    // dunning UX that PAST_DUE drives. A later resume sends customer.subscription.updated
    // with status=active, which re-activates the row.
    paused: "CANCELED",
  };
  return map[stripeStatus] || "UNKNOWN";
}

function mapStripeStatusWithRenewal(subscription: Stripe.Subscription): string {
  if (subscription.status === "trialing" && subscription.cancel_at_period_end) return "TRIAL_CANCELED";
  if (subscription.status === "active" && subscription.cancel_at_period_end) return "CANCEL_AT_PERIOD_END";
  return mapStripeStatus(subscription.status);
}
