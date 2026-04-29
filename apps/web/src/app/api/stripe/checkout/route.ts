import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { getStripePriceIdForPlan } from "@/lib/billing";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import {
  buildStripeIdempotencyKey,
  requireStripeSecretKeyForMutation,
} from "@/lib/billing-config";
import {
  assertCampaignAvailable,
  buildCheckoutConsentSnapshot,
  buildSignupSnapshot,
  campaignToSnapshotText,
  findAcquisitionCampaign,
  getRequestHashSnapshot,
  hashForSnapshot,
} from "@/lib/acquisition-campaigns";
import {
  buildCheckoutDisclosureText,
  INDIVIDUAL_ANNUAL_TRIAL_DAYS,
  REFUND_POLICY_VERSION,
  SUBSCRIPTION_POLICY_VERSION,
  TERMS_VERSION,
} from "@/lib/shared-billing";
import { captureMessage } from "@/lib/sentry";
import Stripe from "stripe";

// POST /api/stripe/checkout — Create a Stripe Checkout session for plan upgrade
export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = requireStripeSecretKeyForMutation(
      await getRuntimeConfigValue("STRIPE_SECRET_KEY"),
    );

    const userId = await requireDbUserId();

    // Rate limit: 5 checkout sessions per minute
    const rlKey = getRateLimitKey(request, "stripe:checkout");
    const rl = await rateLimit(rlKey, { limit: 5, windowSeconds: 60, failClosed: true });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const {
      plan,
      cycle: rawCycle,
      campaignCode,
      acceptedSubscriptionTerms,
    } = await request.json();

    if (plan !== "INDIVIDUAL") {
      return NextResponse.json({ error: "Invalid plan. Must be INDIVIDUAL." }, { status: 400 });
    }

    const cycle: "monthly" | "yearly" =
      rawCycle === "yearly" ? "yearly" : "monthly";

    const campaign = await findAcquisitionCampaign(campaignCode);
    if (!campaign) {
      return NextResponse.json(
        { code: "CAMPAIGN_NOT_FOUND", error: "This offer is no longer available." },
        { status: 404 },
      );
    }
    try {
      assertCampaignAvailable(campaign);
    } catch (availabilityError: any) {
      return NextResponse.json(
        {
          code: "CAMPAIGN_UNAVAILABLE",
          error: availabilityError?.message || "This offer is no longer available.",
        },
        { status: 400 },
      );
    }
    if (campaign.accessType !== "FREE_TRIAL") {
      return NextResponse.json(
        { code: "CAMPAIGN_WRONG_TYPE", error: "This offer is no longer available." },
        { status: 400 },
      );
    }
    if (cycle !== "yearly" || campaign.billingInterval !== "YEAR") {
      return NextResponse.json(
        {
          code: "CAMPAIGN_WRONG_INTERVAL",
          error: "Individual trial campaigns use annual billing.",
        },
        { status: 400 },
      );
    }
    if (!acceptedSubscriptionTerms) {
      return NextResponse.json(
        {
          code: "TERMS_NOT_ACCEPTED",
          error: "Please accept the subscription terms before checkout.",
        },
        { status: 400 },
      );
    }

    // Block re-checkout only when the user already has a real Stripe-backed
    // paid subscription. Admin-granted Free Access also writes status=ACTIVE
    // (provider=ADMIN, no stripeSubscriptionId), and those users are exactly
    // the ones who must be allowed to start the annual trial — so guarding
    // on raw status alone would lock them out of the upgrade path.
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        status: true,
        provider: true,
        accessType: true,
        stripeSubscriptionId: true,
      },
    });
    const hasRealStripeSubscription =
      existingSubscription?.provider === "STRIPE" &&
      Boolean(existingSubscription?.stripeSubscriptionId) &&
      existingSubscription?.accessType !== "FREE_ACCESS";
    if (hasRealStripeSubscription && existingSubscription?.status === "TRIALING") {
      return NextResponse.json(
        { code: "ALREADY_TRIALING", error: "Your annual trial is already active." },
        { status: 409 },
      );
    }
    if (
      hasRealStripeSubscription &&
      (existingSubscription?.status === "ACTIVE" ||
        existingSubscription?.status === "CANCEL_AT_PERIOD_END")
    ) {
      return NextResponse.json(
        { code: "ALREADY_ACTIVE", error: "Your annual plan is active." },
        { status: 409 },
      );
    }

    if (campaign.newUsersOnly) {
      let previousTrialRedemption: { id: string } | null = null;
      try {
        previousTrialRedemption = await (prisma as any).acquisitionRedemption.findFirst({
          where: { userId, accessType: "FREE_TRIAL" },
          select: { id: true },
        });
      } catch {
        previousTrialRedemption = null;
      }
      if (previousTrialRedemption) {
        return NextResponse.json(
          { code: "TRIAL_ALREADY_REDEEMED", error: "You already used this trial offer." },
          { status: 409 },
        );
      }
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get or create a non-entitling subscription shell. The paid trial access
    // starts only after Stripe confirms Checkout and a payment method.
    let subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId,
          plan: "FREE_TRIAL",
          status: "PENDING_CHECKOUT",
          provider: "STRIPE",
          platform: "web",
        },
      });
    }

    // Get or create Stripe customer
    let stripeCustomerId = subscription?.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      }, {
        idempotencyKey: buildStripeIdempotencyKey(["stripe-customer", userId]),
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

    const priceId = campaign.stripePriceId || await getStripePriceIdForPlan(plan, cycle);

    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for ${plan} ${cycle}` },
        { status: cycle === "yearly" ? 400 : 503 },
      );
    }

    const appUrl = await getRuntimeConfigValue("NEXT_PUBLIC_APP_URL") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const now = new Date();
    const trialDays = campaign.trialDays || INDIVIDUAL_ANNUAL_TRIAL_DAYS;
    const firstChargeAt = new Date(now);
    firstChargeAt.setUTCDate(firstChargeAt.getUTCDate() + trialDays);
    const displayPrice = campaign.displayPriceLabel || "$79/year";
    const disclosureText = buildCheckoutDisclosureText({
      campaign,
      now,
      firstChargeAt,
      firstChargeAmount: displayPrice,
    });
    const requestHashes = getRequestHashSnapshot(request);
    const snapshot = buildSignupSnapshot({
      campaign: { ...campaign, stripePriceId: priceId },
      now,
      firstChargeAmount: displayPrice,
      disclosureText,
      consentAcceptedAt: now,
      ...requestHashes,
    });
    const snapshotText = campaignToSnapshotText(snapshot);
    const consentSnapshot = buildCheckoutConsentSnapshot({
      acceptedAt: now,
      disclosureText,
      ...requestHashes,
    });

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: "PENDING_CHECKOUT",
        billingInterval: "YEAR",
        firstChargeAt,
        firstChargeAmount: Number.parseFloat(displayPrice.replace(/[^0-9.]/g, "")) || null,
        campaignId: campaign.id || null,
        campaignCode: campaign.code,
        campaignSnapshot: snapshotText,
        checkoutConsentSnapshot: consentSnapshot,
        termsVersion: TERMS_VERSION,
        subscriptionPolicyVersion: SUBSCRIPTION_POLICY_VERSION,
        refundPolicyVersion: REFUND_POLICY_VERSION,
        stripePriceId: priceId,
        billingProductId: priceId,
        lastSyncedAt: now,
      },
    });

    try {
      const updatedSubscription = await prisma.subscription.findUnique({ where: { userId }, select: { id: true } });
      await (prisma as any).acquisitionRedemption.create({
        data: {
          campaignId: campaign.id || null,
          userId,
          subscriptionId: updatedSubscription?.id || null,
          accessType: "FREE_TRIAL",
          status: "PENDING_CHECKOUT",
          snapshot: snapshotText,
          consentAcceptedAt: now,
          consentIpHash: requestHashes.consentIpHash,
          consentUserAgentHash: requestHashes.consentUserAgentHash,
          termsVersion: TERMS_VERSION,
          subscriptionPolicyVersion: SUBSCRIPTION_POLICY_VERSION,
          refundPolicyVersion: REFUND_POLICY_VERSION,
          checkoutDisclosureTextHash: hashForSnapshot(disclosureText),
        },
      });
    } catch {
      // Snapshot is already stored on Subscription. The redemption table is
      // additive and may not exist for a brief rolling-deploy window.
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      client_reference_id: userId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      payment_method_collection: "always",
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          userId,
          plan,
          cycle,
          provider: "STRIPE",
          platform: "web",
          campaignCode: campaign.code,
          accessType: "FREE_TRIAL",
          checkoutDisclosureTextHash: hashForSnapshot(disclosureText) || "",
        },
      },
      // The plan query param is read by subscription-management to decide
      // which tier sticker to celebrate in the reveal modal.
      success_url: `${appUrl}/settings/subscription?success=true&plan=${encodeURIComponent(plan)}&trial=true`,
      cancel_url: `${appUrl}/api/stripe/checkout/cancel`,
      metadata: {
        userId,
        plan,
        cycle,
        provider: "STRIPE",
        platform: "web",
        campaignCode: campaign.code,
        accessType: "FREE_TRIAL",
        checkoutDisclosureTextHash: hashForSnapshot(disclosureText) || "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    if (error?.name === "BILLING_CONFIG_ERROR") {
      // Production-mode guard: a non-`sk_live_` key (or missing key) at
      // checkout time means real charges will never settle. Page ops via
      // Sentry so the misconfiguration is caught before it reaches users.
      const reason = error?.message || "Stripe not configured";
      console.error("[CHECKOUT] Stripe config rejected:", reason);
      captureMessage(`[CHECKOUT] Stripe config rejected: ${reason}`, "error");
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
