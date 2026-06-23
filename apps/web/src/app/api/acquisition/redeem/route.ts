import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import {
  assertCampaignAvailable,
  buildSignupSnapshot,
  campaignToSnapshotText,
  findAcquisitionCampaign,
  getRequestHashSnapshot,
} from "@/lib/acquisition-campaigns";
import {
  REFUND_POLICY_VERSION,
  SUBSCRIPTION_POLICY_VERSION,
  TERMS_VERSION,
} from "@/lib/shared-billing";
import { reconcileSeatsForOwner } from "@/lib/workspace-ownership";
import { auditImpersonatedMutation, blockIfImpersonating } from "@/lib/impersonation-audit";

// Statuses that mean "a paid subscription is live / mid-lifecycle". Kept in sync
// with MANAGED_SUBSCRIPTION_BLOCKING_STATUSES in /api/stripe/checkout — a user
// in any of these must not be able to overwrite their billing row via a redeem.
const MANAGED_SUBSCRIPTION_BLOCKING_STATUSES = new Set([
  "ACTIVE",
  "TRIALING",
  "CANCEL_AT_PERIOD_END",
  "GRACE_PERIOD",
  "PAST_DUE",
  "PENDING_VALIDATION",
]);

export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const blocked = await blockIfImpersonating(request, { action: "ACQ_REDEEM", route: "/api/acquisition/redeem" });
    if (blocked) return blocked;
    const rlKey = getRateLimitKey(request, "acquisition:redeem", { userId });
    const rl = await rateLimit(rlKey, { limit: 10, windowSeconds: 60, failClosed: true });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code : "";
    const campaign = await findAcquisitionCampaign(code);
    if (!campaign) {
      return NextResponse.json(
        { code: "CAMPAIGN_NOT_FOUND", error: "This offer is no longer available." },
        { status: 404 },
      );
    }
    try {
      assertCampaignAvailable(campaign);
    } catch (error: any) {
      return NextResponse.json(
        { code: "CAMPAIGN_UNAVAILABLE", error: error?.message || "This offer is no longer available." },
        { status: 400 },
      );
    }
    if (campaign.accessType !== "FREE_ACCESS") {
      return NextResponse.json(
        { code: "CAMPAIGN_WRONG_TYPE", error: "This campaign requires checkout to start the trial." },
        { status: 400 },
      );
    }
    if (!campaign.freeAccessDays || campaign.freeAccessDays < 1) {
      return NextResponse.json(
        { code: "CAMPAIGN_MISCONFIGURED", error: "Free Access duration is not configured." },
        { status: 400 },
      );
    }

    if (campaign.newUsersOnly) {
      const previousRedemption = await (prisma as any).acquisitionRedemption.findFirst({
        where: { userId },
        select: { id: true },
      });
      if (previousRedemption) {
        return NextResponse.json(
          { code: "ALREADY_REDEEMED", error: "You already used this offer." },
          { status: 409 },
        );
      }
    }

    // Fast-path idempotency for the (user, campaign) pair: a duplicate POST
    // from a double-click or retry should return ALREADY_REDEEMED without
    // hitting the transaction. This is only a check-then-create guard — two
    // truly concurrent requests can both pass here — but it doesn't stand
    // alone: AcquisitionRedemption carries @@unique([userId, campaignId])
    // (schema.prisma), so the loser of a real race fails the create with
    // P2002 and is converted to ALREADY_REDEEMED in the catch below. The
    // campaign-level cap is enforced separately inside the transaction.
    if (campaign.id) {
      const existingForCampaign = await (prisma as any).acquisitionRedemption.findFirst({
        where: { userId, campaignId: campaign.id },
        select: { id: true, subscriptionId: true },
      });
      if (existingForCampaign) {
        return NextResponse.json(
          { code: "ALREADY_REDEEMED", error: "You already used this offer." },
          { status: 409 },
        );
      }
    }

    // Block redemption when the user already has a REAL, non-FREE_ACCESS paid
    // subscription managed by Stripe or an app store. The upsert below would
    // otherwise rewrite that billing row to provider=ADMIN / accessType=FREE_ACCESS,
    // silently collapsing the customer's entitlement to FREE_TRIAL limits while
    // the external provider keeps charging them — and neither the reconcile cron
    // nor the Stripe webhooks repair an ADMIN-provider row, so the corruption
    // persists until the next renewal. Mirrors the guard in /api/stripe/checkout
    // (hasRealStripeSubscription) and the IAP path (ACTIVE_SUBSCRIPTION_MANAGED_ELSEWHERE).
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, provider: true, accessType: true, stripeSubscriptionId: true },
    });
    const hasRealStripeSubscription =
      existingSubscription?.provider === "STRIPE" &&
      Boolean(existingSubscription?.stripeSubscriptionId) &&
      existingSubscription?.accessType !== "FREE_ACCESS" &&
      MANAGED_SUBSCRIPTION_BLOCKING_STATUSES.has(existingSubscription?.status || "");
    const hasActiveStoreSubscription =
      (existingSubscription?.provider === "APP_STORE" || existingSubscription?.provider === "PLAY_STORE") &&
      existingSubscription?.accessType !== "FREE_ACCESS" &&
      MANAGED_SUBSCRIPTION_BLOCKING_STATUSES.has(existingSubscription?.status || "");
    if (hasRealStripeSubscription || hasActiveStoreSubscription) {
      return NextResponse.json(
        {
          code: "SUBSCRIPTION_MANAGED_ELSEWHERE",
          error:
            "You already have an active paid subscription. Manage it from billing settings before redeeming an offer.",
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const freeAccessEndsAt = new Date(now);
    freeAccessEndsAt.setUTCDate(freeAccessEndsAt.getUTCDate() + campaign.freeAccessDays);
    const requestHashes = getRequestHashSnapshot(request);
    const snapshot = buildSignupSnapshot({
      campaign,
      now,
      ...requestHashes,
    });
    const snapshotText = campaignToSnapshotText(snapshot);

    const result = await prisma.$transaction(async (tx: any) => {
      const subscription = await tx.subscription.upsert({
        where: { userId },
        update: {
          plan: "INDIVIDUAL",
          status: "ACTIVE",
          provider: "ADMIN",
          platform: "web",
          accessType: "FREE_ACCESS",
          billingInterval: null,
          freeAccessEndsAt,
          trialEndsAt: null,
          firstChargeAt: null,
          firstChargeAmount: null,
          autoRenew: false,
          cancelAtPeriodEnd: false,
          campaignId: campaign.id || null,
          campaignCode: campaign.code,
          campaignSnapshot: snapshotText,
          checkoutConsentSnapshot: null,
          termsVersion: TERMS_VERSION,
          subscriptionPolicyVersion: SUBSCRIPTION_POLICY_VERSION,
          refundPolicyVersion: REFUND_POLICY_VERSION,
          lastSyncedAt: now,
        },
        create: {
          userId,
          plan: "INDIVIDUAL",
          status: "ACTIVE",
          provider: "ADMIN",
          platform: "web",
          accessType: "FREE_ACCESS",
          freeAccessEndsAt,
          autoRenew: false,
          cancelAtPeriodEnd: false,
          campaignId: campaign.id || null,
          campaignCode: campaign.code,
          campaignSnapshot: snapshotText,
          termsVersion: TERMS_VERSION,
          subscriptionPolicyVersion: SUBSCRIPTION_POLICY_VERSION,
          refundPolicyVersion: REFUND_POLICY_VERSION,
          lastSyncedAt: now,
        },
      });

      const redemption = await tx.acquisitionRedemption.create({
        data: {
          campaignId: campaign.id || null,
          userId,
          subscriptionId: subscription.id,
          accessType: "FREE_ACCESS",
          status: "REDEEMED",
          snapshot: snapshotText,
          consentIpHash: requestHashes.consentIpHash,
          consentUserAgentHash: requestHashes.consentUserAgentHash,
          termsVersion: TERMS_VERSION,
          subscriptionPolicyVersion: SUBSCRIPTION_POLICY_VERSION,
          refundPolicyVersion: REFUND_POLICY_VERSION,
        },
      });

      if (campaign.id) {
        // Concurrency-safe cap enforcement: under load, the precondition
        // check above can pass for two parallel requests when only one
        // slot remains. We re-issue the increment as a conditional
        // updateMany so the database resolves the race — the row only
        // updates if status, time window, and cap all still hold at
        // commit time. count === 0 means the campaign closed in the gap;
        // throw to roll back the subscription + redemption rows.
        const cap = typeof campaign.maxRedemptions === "number" ? campaign.maxRedemptions : null;
        const updated = await tx.acquisitionCampaign.updateMany({
          where: {
            id: campaign.id,
            status: "ACTIVE",
            // Re-check the time window inside the transaction. The
            // application-side check above can race with an admin
            // ending the campaign, or with the system clock crossing
            // `endsAt` between assertCampaignAvailable and this update.
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
            ...(cap !== null ? { redemptionCount: { lt: cap } } : {}),
          },
          data: { redemptionCount: { increment: 1 } },
        });
        if (updated.count === 0) {
          throw new Error("CAMPAIGN_FULL");
        }
      }

      return { subscription, redemption };
    });

    // The redeem forces plan=INDIVIDUAL. If the user previously owned a Family/Pro
    // workspace (e.g. their paid sub had lapsed, so it wasn't blocked above),
    // their seats must collapse to the new plan — reconcile best-effort, never
    // blocking the redemption response. Mirrors the IAP path's reconcile call.
    await reconcileSeatsForOwner(userId).catch(() => {});

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "REDEEM", entityType: "Subscription", entityId: result.subscription.id, route: "/api/acquisition/redeem" });

    return NextResponse.json({
      accessType: "FREE_ACCESS",
      freeAccessEndsAt: result.subscription.freeAccessEndsAt,
      redemptionId: result.redemption.id,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "CAMPAIGN_FULL") {
      return NextResponse.json(
        { code: "CAMPAIGN_UNAVAILABLE", error: "This offer is no longer available." },
        { status: 409 },
      );
    }
    if (error?.code === "P2002") {
      // Lost the @@unique([userId, campaignId]) race with a concurrent
      // redemption — the other request already granted this user free access.
      return NextResponse.json(
        { code: "ALREADY_REDEEMED", error: "You already used this offer." },
        { status: 409 },
      );
    }
    console.error("Failed to redeem acquisition campaign:", error);
    return NextResponse.json({ error: "Failed to redeem campaign" }, { status: 500 });
  }
}
