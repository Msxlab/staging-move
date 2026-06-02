import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
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

function isMissingStripeCustomerError(error: unknown) {
  // Called only inside the customers.retrieve(id) catch — the only thing
  // that can be missing is the customer. Stripe returns param: 'id' for
  // retrieve-by-id and param: 'customer' when the customer is referenced
  // from another call, so we don't pin to param.
  const stripeError = error as {
    code?: string;
    raw?: { code?: string };
  };
  return (
    stripeError?.code === "resource_missing" ||
    stripeError?.raw?.code === "resource_missing"
  );
}

async function createStripeCustomer(stripe: Stripe, user: { email: string }, userId: string) {
  return stripe.customers.create({
    email: user.email,
    metadata: { userId },
  }, {
    idempotencyKey: buildStripeIdempotencyKey(["stripe-customer", userId]),
  });
}

/**
 * Family/Pro checkout — a straight paid recurring subscription with no
 * acquisition campaign and no trial. Kept self-contained so the battle-tested
 * Individual + campaign flow below stays byte-for-byte unchanged. Self-serve
 * only succeeds once the Family/Pro Stripe price IDs are configured
 * (STRIPE_PRICE_FAMILY_ and STRIPE_PRICE_PRO_ keys); until then it returns 503
 * and admin-granted Family/Pro is unaffected (it never hits checkout).
 * NOTE (legal): this stamps acceptedSubscriptionTerms + policy
 * versions but not the campaign-style disclosure/consent snapshot — review the
 * disclosure wording with legal before enabling public Family/Pro self-serve.
 */
async function createWorkspacePlanCheckout(params: {
  stripeSecretKey: string;
  userId: string;
  plan: "FAMILY" | "PRO";
  rawBillingInterval: unknown;
  rawCycle: unknown;
  acceptedSubscriptionTerms: unknown;
  uiMode: "hosted" | "embedded";
}): Promise<NextResponse> {
  const { stripeSecretKey, userId, plan, rawBillingInterval, rawCycle, acceptedSubscriptionTerms, uiMode } = params;

  if (!acceptedSubscriptionTerms) {
    return NextResponse.json(
      { code: "TERMS_NOT_ACCEPTED", error: "Please accept the subscription terms before checkout." },
      { status: 400 },
    );
  }

  const billingInterval = normalizeBillingIntervalInput(rawBillingInterval, rawCycle);
  const cycle = billingIntervalToCycle(billingInterval);

  // Block re-checkout when a real paid subscription already exists (mirrors the
  // Individual guards; admin-granted Free Access is provider=ADMIN so it is not
  // blocked here).
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, provider: true, accessType: true, stripeSubscriptionId: true, platform: true },
  });
  const hasRealStripeSubscription =
    existingSubscription?.provider === "STRIPE" &&
    Boolean(existingSubscription?.stripeSubscriptionId) &&
    existingSubscription?.accessType !== "FREE_ACCESS";
  if (
    hasRealStripeSubscription &&
    (existingSubscription?.status === "ACTIVE" ||
      existingSubscription?.status === "CANCEL_AT_PERIOD_END" ||
      existingSubscription?.status === "TRIALING")
  ) {
    return NextResponse.json(
      { code: "ALREADY_ACTIVE", error: "You already have an active subscription. Manage it from billing settings." },
      { status: 409 },
    );
  }
  const hasActiveStoreSubscription =
    (existingSubscription?.provider === "APP_STORE" || existingSubscription?.provider === "PLAY_STORE") &&
    existingSubscription?.accessType !== "FREE_ACCESS" &&
    MANAGED_SUBSCRIPTION_BLOCKING_STATUSES.has(existingSubscription?.status || "");
  if (hasActiveStoreSubscription) {
    return NextResponse.json(
      { code: "SUBSCRIPTION_MANAGED_ELSEWHERE", error: "Your subscription is managed by the app store." },
      { status: 409 },
    );
  }

  const priceId = await getStripePriceIdForPlanAndInterval(plan, billingInterval);
  if (!priceId) {
    return NextResponse.json(
      { code: "PLAN_NOT_AVAILABLE", error: `${plan === "FAMILY" ? "Family" : "Pro"} checkout is not available yet.` },
      { status: 503 },
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: { userId, plan, status: "PENDING_CHECKOUT", provider: "STRIPE", platform: "web" },
    });
  }

  let stripeCustomerId = subscription?.stripeCustomerId ?? undefined;
  let shouldCreateStripeCustomer = !stripeCustomerId;
  if (stripeCustomerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(stripeCustomerId);
      if ("deleted" in existingCustomer && existingCustomer.deleted) shouldCreateStripeCustomer = true;
    } catch (error) {
      if (!isMissingStripeCustomerError(error)) throw error;
      shouldCreateStripeCustomer = true;
    }
  }
  if (shouldCreateStripeCustomer) {
    const customer = await createStripeCustomer(stripe, user, userId);
    stripeCustomerId = customer.id;
    await prisma.subscription.update({
      where: { userId },
      data: { stripeCustomerId, platform: "web", lastSyncedAt: new Date() },
    });
  }

  const appUrl = await getConfiguredAppUrl();
  await prisma.subscription.update({
    where: { userId },
    data: {
      status: "PENDING_CHECKOUT",
      billingInterval,
      termsVersion: TERMS_VERSION,
      subscriptionPolicyVersion: SUBSCRIPTION_POLICY_VERSION,
      refundPolicyVersion: REFUND_POLICY_VERSION,
      stripePriceId: priceId,
      billingProductId: priceId,
      lastSyncedAt: new Date(),
    },
  });

  const successPath = `/settings/subscription?success=true&plan=${encodeURIComponent(plan)}&trial=false`;
  const metadata: Record<string, string> = {
    userId,
    plan,
    cycle,
    billingInterval,
    provider: "STRIPE",
    platform: "web",
  };
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: stripeCustomerId,
    client_reference_id: userId,
    mode: "subscription",
    ui_mode: uiMode,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    payment_method_collection: "always",
    subscription_data: { metadata },
    metadata,
  };
  if (uiMode === "embedded") {
    sessionParams.return_url = `${appUrl}${successPath}`;
  } else {
    sessionParams.success_url = `${appUrl}${successPath}`;
    sessionParams.cancel_url = `${appUrl}/api/stripe/checkout/cancel`;
  }

  const session = await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: buildStripeIdempotencyKey([
      "stripe-checkout",
      userId,
      stripeCustomerId || "no-customer",
      plan,
      billingInterval,
      uiMode,
      String(Math.floor(Date.now() / 60_000)),
    ]),
  });

  if (uiMode === "embedded") {
    return NextResponse.json({ clientSecret: session.client_secret, sessionId: session.id });
  }
  return NextResponse.json({ url: session.url });
}

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
      // When the caller is rendering Stripe's Embedded Checkout (pricing
      // page Express path), it asks for a `client_secret` instead of a
      // hosted-redirect URL so the iframe can mount inline without losing
      // the page. Apple Pay / Google Pay buttons appear at the top of the
      // embedded form automatically (the same wallet detection that runs
      // on Hosted Checkout).
      uiMode: rawUiMode,
    } = await request.json();
    const uiMode: "hosted" | "embedded" = rawUiMode === "embedded" ? "embedded" : "hosted";

    // Family/Pro take an isolated paid-subscription path (no campaign/trial),
    // keeping the Individual campaign flow below untouched.
    if (plan === "FAMILY" || plan === "PRO") {
      return createWorkspacePlanCheckout({
        stripeSecretKey,
        userId,
        plan,
        rawBillingInterval,
        rawCycle,
        acceptedSubscriptionTerms,
        uiMode,
      });
    }
    if (plan !== "INDIVIDUAL") {
      return NextResponse.json({ error: "Invalid plan. Must be INDIVIDUAL, FAMILY, or PRO." }, { status: 400 });
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
    let stripeCustomerId = subscription?.stripeCustomerId ?? undefined;
    let shouldCreateStripeCustomer = !stripeCustomerId;
    if (stripeCustomerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(stripeCustomerId);
        if ("deleted" in existingCustomer && existingCustomer.deleted) {
          shouldCreateStripeCustomer = true;
        }
      } catch (error) {
        if (!isMissingStripeCustomerError(error)) throw error;
        shouldCreateStripeCustomer = true;
        console.warn("[CHECKOUT] Stored Stripe customer was not found in configured mode; creating a replacement.", {
          userId,
          stripeCustomerId,
        });
      }
    }
    if (shouldCreateStripeCustomer) {
      const customer = await createStripeCustomer(stripe, user, userId);
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

    // The plan query param is read by subscription-management to decide
    // which tier sticker to celebrate in the reveal modal.
    const successPath = `/settings/subscription?success=true&plan=${encodeURIComponent(plan)}&trial=${isTrialOffer ? "true" : "false"}`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      client_reference_id: userId,
      mode: "subscription",
      ui_mode: uiMode,
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
    };

    if (uiMode === "embedded") {
      // Embedded mode: Stripe loads the form inside the page's iframe and
      // we poll the session on completion via the return_url page (which
      // is the same `/settings/subscription?success=true` page that the
      // hosted flow lands on).
      sessionParams.return_url = `${appUrl}${successPath}`;
    } else {
      sessionParams.success_url = `${appUrl}${successPath}`;
      sessionParams.cancel_url = `${appUrl}/api/stripe/checkout/cancel`;
    }

    // Idempotency: a double-click or React StrictMode re-mount on the
    // pricing page must not create two Stripe Checkout sessions. Scope it
    // to a short server-side attempt bucket so a user can retry the same
    // offer later instead of being tied to a completed/expired session for
    // Stripe's full idempotency retention window.
    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: buildStripeIdempotencyKey([
        "stripe-checkout",
        userId,
        stripeCustomerId || "no-customer",
        plan,
        billingInterval,
        campaign.code,
        uiMode,
        String(Math.floor(now.getTime() / 60_000)),
      ]),
    });

    if (uiMode === "embedded") {
      return NextResponse.json({
        clientSecret: session.client_secret,
        sessionId: session.id,
      });
    }
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
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
