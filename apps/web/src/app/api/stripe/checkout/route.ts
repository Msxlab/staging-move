import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { ensureSubscriptionDefaults, getStripePriceIdForPlan } from "@/lib/billing";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import Stripe from "stripe";

// POST /api/stripe/checkout — Create a Stripe Checkout session for plan upgrade
export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = await getRuntimeConfigValue("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const userId = await requireDbUserId();

    // Rate limit: 5 checkout sessions per minute
    const rlKey = getRateLimitKey(request, "stripe:checkout");
    const rl = await rateLimit(rlKey, { limit: 5, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const { plan, cycle: rawCycle } = await request.json();

    if (plan !== "INDIVIDUAL") {
      return NextResponse.json({ error: "Invalid plan. Must be INDIVIDUAL." }, { status: 400 });
    }

    const cycle: "monthly" | "yearly" =
      rawCycle === "yearly" ? "yearly" : "monthly";

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get or create subscription record
    let subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) {
      subscription = await ensureSubscriptionDefaults(userId);
    }

    // Get or create Stripe customer
    let stripeCustomerId = subscription?.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      const subscriptionPlatform = ((subscription as any)?.platform as string | undefined) || "web";

      await prisma.subscription.update({
        where: { userId },
        data: {
          stripeCustomerId,
          platform: subscriptionPlatform,
          lastSyncedAt: new Date(),
        },
      });
    }

    const priceId = await getStripePriceIdForPlan(plan, cycle);

    if (!priceId) {
      return NextResponse.json({ error: `Stripe price not configured for ${plan} ${cycle}` }, { status: 503 });
    }

    const appUrl = await getRuntimeConfigValue("NEXT_PUBLIC_APP_URL") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${appUrl}/settings/subscription?success=true`,
      cancel_url: `${appUrl}/settings/subscription?canceled=true`,
      metadata: { userId, plan, cycle, provider: "STRIPE", platform: "web" },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
