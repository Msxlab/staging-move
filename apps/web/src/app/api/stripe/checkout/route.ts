import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import {
  billingIntervalToCycle,
  getStripeAnnualTrialDays,
  getStripePriceIdForPlanAndInterval,
  type StripeBillingInterval,
} from "@/lib/billing";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { getConfiguredAppUrl } from "@/lib/app-url";
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
  findActivePublicIndividualAnnualTrialCampaign,
  findActivePublicIndividualMonthlyPaidOffer,
  getRequestHashSnapshot,
  hashForSnapshot,
} from "@/lib/acquisition-campaigns";
import {
  buildCheckoutDisclosureText,
  REFUND_POLICY_VERSION,
  SUBSCRIPTION_POLICY_VERSION,
  TERMS_VERSION,
} from "@/lib/shared-billing";
import { captureMessage } from "@/lib/sentry";
import {
  isMobileAppClient,
  mobileExternalBillingNotAllowedResponse,
} from "@/lib/mobile-external-billing-guard";
import Stripe from "stripe";

function normalizeBillingIntervalInput(input: unknown, legacyCycle: unknown): StripeBillingInterval {
  if (input === "YEAR" || input === "yearly") return "YEAR";
  if (input === "MONTH" || input === "monthly") return "MONTH";
  if (legacyCycle === "yearly") return "YEAR";
  return "MONTH";
}

const MANAGED_SUBSCRIPTION_BLOCKING_STATUSES = new Set([
  "ACTIVE",
  "TRIALING",
  "CANCEL_AT_PERIOD_END",
  "GRACE_PERIOD",
  "PAST_DUE",
  "PENDING_VALIDATION",
]);

// POST /api/stripe/checkout — Create a Stripe Checkout session for plan upgrade
export async function POST(request: NextRequest) {
  try {
    if (isMobileAppClient(request)) {
      return mobileExternalBillingNotAllowedResponse();
    }

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
      billingInterval: rawBillingInterval,
      cycle: rawCycle,
      campaignCode,
      acceptedSubscriptionTerms,
    } = await request.json();

    if (plan !== "INDIVIDUAL") {
      return NextResponse.json({ error: "Invalid plan. Must be INDIVIDUAL." }, { status: 400 });
    }

    let billingInterval = normalizeBillingIntervalInput(rawBillingInterval, rawCycle);
    let cycle = billingIntervalToCycle(billingInterval);

    const requestedCampaignCode =
      typeof campaignCode === "string" ? campaignCode.trim() : "";
    const campaign = requestedCampaignCode
      ? await findAcquisitionCampaign(requestedCampaignCode, { allowDefaultFallback: false })
      : billingInterval === "YEAR"
        ? await findActivePublicIndividualAnnualTrialCampaign()
        : await findActivePublicIndividualMonthlyPaidOffer();
    if (!campaign) {
      if (!requestedCampaignCode) {
        return NextResponse.json(
          { code: "OFFER_UNAVAILABLE", error: "This offer is not currently available." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { code: "CAMPAIGN_NOT_FOUND", error: "This offer is no longer available." },
        { status: 404 },
      );
    }
    if (
      requestedCampaignCode &&
      rawBillingInterval !== "YEAR" &&
      rawBillingInterval !== "MONTH" &&
      rawCycle !== "yearly" &&
      rawCycle !== "monthly" &&
      (campaign.billingInterval === "YEAR" || campaign.billingInterval === "MONTH")
    ) {
      billingInterval = campaign.billingInterval as StripeBillingInterval;
      cycle = billingIntervalToCycle(billingInterval);
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
    const expectedAccessType = billingInterval === "YEAR" ? "FREE_TRIAL" : "PAID";
    const expectedBillingInterval = billingInterval;
    if (campaign.accessType !== expectedAccessType) {
      return NextResponse.json(
        { code: "CAMPAIGN_WRONG_TYPE", error: "This offer is no longer available." },
        { status: 400 },
      );
    }
    if (campaign.billingInterval !== expectedBillingInterval) {
      return NextResponse.json(
        {
          code: "CAMPAIGN_WRONG_INTERVAL",
          error: cycle === "yearly"
            ? "Individual trial campaigns use annual billing."
            : "Individual monthly campaigns use monthly billing.",
        },
        { status: 400 },
      );
    }
    if (!campaign.displayPriceLabel) {
      return NextResponse.json(
        { code: "OFFER_UNAVAILABLE", error: "This offer is not currently available." },
        { status: 409 },
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
        platform: true,
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
    const hasActiveStoreSubscription =
      (existingSubscription?.provider === "APP_STORE" || existingSubscription?.provider === "PLAY_STORE") &&
      existingSubscription?.accessType !== "FREE_ACCESS" &&
      MANAGED_SUBSCRIPTION_BLOCKING_STATUSES.has(existingSubscription?.status || "");
    if (hasActiveStoreSubscription) {
      return NextResponse.json(
        {
          code: "SUBSCRIPTION_MANAGED_ELSEWHERE",
          error: "Your subscription is managed by the app store.",
        },
        { status: 409 },
      );
    }

    if (campaign.accessType === "FREE_TRIAL" && campaign.newUsersOnly) {
      let previousTrialRedemption: { id: string } | null = null;
      try {
        previousTrialRedemption = await (prisma as any).acquisitionRedemption.findFirst({
          where: { userId, accessType: "FREE_TRIAL", status: "REDEEMED" },
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
          plan: campaign.accessType === "PAID" ? "INDIVIDUAL" : "FREE_TRIAL",
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

    const priceId = await getStripePriceIdForPlanAndInterval(plan, billingInterval);

    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for ${plan} ${cycle}` },
        { status: billingInterval === "YEAR" ? 400 : 503 },
      );
    }

    const appUrl = await getConfiguredAppUrl();
    const now = new Date();
    const isTrialOffer = billingInterval === "YEAR";
    const trialDays = isTrialOffer ? await getStripeAnnualTrialDays() : null;
    const checkoutCampaign = {
      ...campaign,
      trialDays: isTrialOffer ? trialDays : campaign.trialDays,
      stripePriceId: priceId,
    };
    const firstChargeAt = new Date(now);
    if (trialDays) firstChargeAt.setUTCDate(firstChargeAt.getUTCDate() + trialDays);
    const displayPrice = campaign.displayPriceLabel;
    const disclosureText = buildCheckoutDisclosureText({
      campaign: checkoutCampaign,
      now,
      firstChargeAt,
      firstChargeAmount: displayPrice,
    });
    const requestHashes = getRequestHashSnapshot(request);
    const snapshot = buildSignupSnapshot({
      campaign: checkoutCampaign,
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
        billingInterval: expectedBillingInterval,
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
          accessType: campaign.accessType,
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
        ...(trialDays ? { trial_period_days: trialDays } : {}),
        metadata: {
          userId,
          plan,
          cycle,
          billingInterval,
          provider: "STRIPE",
          platform: "web",
          campaignCode: campaign.code,
          accessType: campaign.accessType,
          checkoutDisclosureTextHash: hashForSnapshot(disclosureText) || "",
        },
      },
      // The plan query param is read by subscription-management to decide
      // which tier sticker to celebrate in the reveal modal.
      success_url: `${appUrl}/settings/subscription?success=true&plan=${encodeURIComponent(plan)}&trial=${isTrialOffer ? "true" : "false"}`,
      cancel_url: `${appUrl}/api/stripe/checkout/cancel`,
      metadata: {
        userId,
        plan,
        cycle,
        billingInterval,
        provider: "STRIPE",
        platform: "web",
        campaignCode: campaign.code,
        accessType: campaign.accessType,
        checkoutDisclosureTextHash: hashForSnapshot(disclosureText) || "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    if (error?.name === "BILLING_CONFIG_ERROR" || error?.name === "APP_URL_CONFIG_ERROR") {
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
