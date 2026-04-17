import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { mapStripePriceIdToPlan } from "@/lib/billing";
import Stripe from "stripe";

export const runtime = "nodejs";

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

    const stripeSecretKey = await getRuntimeConfigValue("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not configured");
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

    // Replay protection — reject events older than 5 minutes
    const eventAge = Date.now() / 1000 - event.created;
    const MAX_EVENT_AGE_SEC = 300; // 5 minutes
    if (eventAge > MAX_EVENT_AGE_SEC) {
      console.warn(`[WEBHOOK] Rejecting stale Stripe event ${event.id} (age: ${Math.round(eventAge)}s)`);
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
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
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
