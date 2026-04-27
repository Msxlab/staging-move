import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { mapStripePriceIdToPlan } from "@/lib/billing";
import { requireStripeSecretKeyForMutation } from "@/lib/billing-config";
import { captureException, captureMessage } from "@/lib/sentry";
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
      user: {
        select: { email: true, firstName: true, preferredLocale: true, deletedAt: true },
      },
    },
  });
  if (!sub?.user || sub.user.deletedAt) return null;
  return {
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


// Best-effort: never let an email failure break webhook idempotency.
// Stripe retries the entire webhook on non-2xx, so we explicitly swallow
// here instead of bubbling and forcing a redelivery for an unrelated reason.
function fireAndLogEmail(promise: Promise<unknown>, context: string): void {
  void promise.catch((err) => {
    console.error(`[WEBHOOK] Email dispatch failed (${context}):`, err);
    captureMessage(`[WEBHOOK] Email dispatch failed (${context})`, "warning");
  });
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
    try {
      await prisma.processedWebhookEvent.create({
        data: { id: event.id, source: "stripe" },
      });
    } catch (err: any) {
      // Unique constraint violation = already processed
      if (err?.code === "P2002") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw err;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const stripeCustomerId = String(session.customer);

        // Resolve plan: prefer metadata, fallback to line_items priceId
        let plan = (session.metadata?.plan as string) || undefined;
        if (!plan) {
          // Try to resolve plan from subscription's priceId
          const stripeSubId = typeof session.subscription === "string" ? session.subscription : (session.subscription as any)?.id;
          if (stripeSubId) {
            try {
              const sub = await stripe.subscriptions.retrieve(stripeSubId);
              const priceId = sub.items?.data?.[0]?.price?.id;
              plan = (await mapStripePriceIdToPlan(priceId)) || undefined;
            } catch (e) {
              console.error("Failed to resolve plan from subscription:", e);
            }
          }
        }

        if (stripeCustomerId) {
          const updateData: any = {
            status: "ACTIVE",
            provider: "STRIPE",
            platform: "web",
            lastSyncedAt: new Date(),
          };
          if (plan) updateData.plan = plan;
          // Link stripeSubscriptionId if available
          const stripeSubId = typeof session.subscription === "string" ? session.subscription : (session.subscription as any)?.id;
          if (stripeSubId) updateData.stripeSubscriptionId = stripeSubId;
          updateData.currentPeriodEndsAt = null;

          await prisma.subscription.updateMany({
            where: { stripeCustomerId },
            data: updateData,
          });

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
              `checkout.session.completed user=${recipient.email}`,
            );
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = String(subscription.customer);
        const status = String(subscription.status);
        const stripePriceId = subscription.items?.data?.[0]?.price?.id;
        const currentPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null;

        // Map stripePriceId to plan name
        const plan = await mapStripePriceIdToPlan(stripePriceId);

        await prisma.subscription.updateMany({
          where: { stripeCustomerId },
          data: {
            status: mapStripeStatus(status),
            provider: "STRIPE",
            platform: "web",
            stripeSubscriptionId: subscription.id,
            stripePriceId,
            billingProductId: stripePriceId,
            stripeCurrentPeriodEnd: currentPeriodEnd,
            currentPeriodEndsAt: currentPeriodEnd,
            gracePeriodEndsAt: null,
            lastSyncedAt: new Date(),
            ...(plan && { plan }),
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = String(subscription.customer);
        const stripePriceId = subscription.items?.data?.[0]?.price?.id;
        const plan = await mapStripePriceIdToPlan(stripePriceId);

        await prisma.subscription.updateMany({
          where: { stripeCustomerId },
          data: {
            status: "CANCELED",
            provider: "STRIPE",
            platform: "web",
            canceledAt: new Date(),
            lastSyncedAt: new Date(),
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
            `customer.subscription.deleted user=${recipient.email}`,
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

        const updateData: any = {
          status: "ACTIVE",
          provider: "STRIPE",
          platform: "web",
          lastSyncedAt: new Date(),
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

        await prisma.subscription.updateMany({
          where: { stripeCustomerId },
          data: {
            status: "PAST_DUE",
            provider: "STRIPE",
            platform: "web",
            lastSyncedAt: new Date(),
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
            `invoice.payment_failed user=${recipient.email}`,
          );
        }
        break;
      }

      default:
        captureMessage(`Unhandled Stripe event: ${event.type}`, "warning");
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
  };
  return map[stripeStatus] || "UNKNOWN";
}
