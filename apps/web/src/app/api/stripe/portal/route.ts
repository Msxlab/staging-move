import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { requireStripeSecretKeyForMutation } from "@/lib/billing-config";
import Stripe from "stripe";

// POST /api/stripe/portal — Create a Stripe Customer Portal session
export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = requireStripeSecretKeyForMutation(
      await getRuntimeConfigValue("STRIPE_SECRET_KEY"),
    );

    const userId = await requireDbUserId();

    // Rate limit: 5 portal sessions per minute
    const rlKey = getRateLimitKey(request, "stripe:portal");
    const rl = await rateLimit(rlKey, { limit: 5, windowSeconds: 60, failClosed: true });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const subscription = await prisma.subscription.findUnique({ where: { userId } });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const appUrl = await getRuntimeConfigValue("NEXT_PUBLIC_APP_URL") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl}/settings/subscription`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    if (error?.name === "BILLING_CONFIG_ERROR") {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }
    console.error("Stripe portal error:", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
