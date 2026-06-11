import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { getConfiguredAppUrl } from "@/lib/app-url";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { requireStripeSecretKeyForMutation } from "@/lib/billing-config";
import { captureMessage } from "@/lib/sentry";
import {
  isMobileAppClient,
  mobileExternalBillingNotAllowedResponse,
} from "@/lib/mobile-external-billing-guard";
import Stripe from "stripe";

function isMissingStripeCustomerError(error: unknown) {
  const stripeError = error as {
    code?: string;
    raw?: { code?: string };
  };
  return (
    stripeError?.code === "resource_missing" ||
    stripeError?.raw?.code === "resource_missing"
  );
}

// POST /api/stripe/portal — Create a Stripe Customer Portal session
export async function POST(request: NextRequest) {
  try {
    if (isMobileAppClient(request)) {
      return mobileExternalBillingNotAllowedResponse();
    }

    const stripeSecretKey = requireStripeSecretKeyForMutation(
      await getRuntimeConfigValue("STRIPE_SECRET_KEY"),
    );

    const userId = await requireDbUserId();

    // Rate limit: 5 portal sessions per minute. Fail closed only when a
    // CONFIGURED Redis limiter is mid-outage; an unconfigured limiter must not
    // permanently 429 the billing-management path (audit round-2 billing #5).
    const rlKey = getRateLimitKey(request, "stripe:portal", { userId });
    const rl = await rateLimit(rlKey, { limit: 5, windowSeconds: 60, failClosed: "if-redis-configured" });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const subscription = await prisma.subscription.findUnique({ where: { userId } });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const appUrl = await getConfiguredAppUrl();

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${appUrl}/settings/subscription`,
      });
      return NextResponse.json({ url: session.url });
    } catch (sessionError) {
      // Provider drift: the stored Stripe customer no longer exists in the
      // configured Stripe account (e.g. test/live key swap, deleted account).
      // Clear the stale ID so the next checkout creates a fresh customer,
      // and return a clean 404 instead of a 500.
      if (isMissingStripeCustomerError(sessionError)) {
        await prisma.subscription.update({
          where: { userId },
          data: { stripeCustomerId: null, lastSyncedAt: new Date() },
        }).catch(() => {});
        return NextResponse.json(
          { code: "STRIPE_CUSTOMER_MISSING", error: "No active subscription found" },
          { status: 404 },
        );
      }
      throw sessionError;
    }
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    if (error?.name === "BILLING_CONFIG_ERROR" || error?.name === "APP_URL_CONFIG_ERROR") {
      const reason = error?.message || "Stripe not configured";
      console.error("[PORTAL] Stripe config rejected:", reason);
      captureMessage(`[PORTAL] Stripe config rejected: ${reason}`, "error");
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }
    console.error("Stripe portal error:", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
