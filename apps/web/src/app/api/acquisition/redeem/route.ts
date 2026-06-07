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

export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
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

    // Best-effort idempotency for the (user, campaign) pair: a duplicate POST
    // from a double-click or retry should not create a second redemption row.
    // This is a check-then-create guard only — the schema has no unique index
    // on (userId, campaignId) yet, so two truly concurrent requests can still
    // both pass here. The only DB-enforced guard inside the transaction below
    // is the campaign-level redemption cap; full per-user idempotency awaits a
    // @@unique([userId, campaignId]) migration.
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
