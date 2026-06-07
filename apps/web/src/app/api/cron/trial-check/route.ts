import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTrialExpiringEmail } from "@/lib/email-service";
import { guardCronRequest } from "@/lib/cron-guard";
import { INDIVIDUAL_ANNUAL_PRICE_LABEL } from "@/lib/shared-billing";
import { reconcileSeatsForOwner } from "@/lib/workspace-ownership";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// Cron handler for trial expiration checks and warnings
async function handleCron(request: NextRequest) {
  try {
    const guard = await guardCronRequest(request, "trial-check");
    if (!guard.ok) return guard.response;

    const now = new Date();
    const reminderDays = [7, 1];
    let sent = 0;
    let expired = 0;
    let freeAccessNotified = 0;
    let renewalNotified = 0;

    // Send expiry warning emails
    for (const days of reminderDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const subscriptions = await prisma.subscription.findMany({
        where: {
          accessType: "FREE_TRIAL",
          status: { in: ["TRIALING", "TRIAL_CANCELED"] },
          trialEndsAt: { gte: startOfDay, lt: endOfDay },
        },
        include: {
          user: { select: { email: true, firstName: true } },
        },
      });

      for (const sub of subscriptions) {
        const success = await sendTrialExpiringEmail({
          userEmail: sub.user.email,
          userName: sub.user.firstName || "",
          daysRemaining: days,
          userId: sub.userId,
          dedupeKey: `cron:trial-expiring:${sub.id}:${sub.trialEndsAt!.toISOString().slice(0, 10)}:${days}`,
          metadata: {
            userId: sub.userId,
            subscriptionId: sub.id,
          },
        });
        if (success) sent++;
      }
    }

    const freeAccessTarget = new Date(now);
    freeAccessTarget.setDate(freeAccessTarget.getDate() + 7);
    const freeAccessStart = new Date(freeAccessTarget.getFullYear(), freeAccessTarget.getMonth(), freeAccessTarget.getDate());
    const freeAccessEnd = new Date(freeAccessStart);
    freeAccessEnd.setDate(freeAccessEnd.getDate() + 1);
    const endingFreeAccess = await prisma.subscription.findMany({
      where: {
        accessType: "FREE_ACCESS",
        status: { in: ["ACTIVE", "FREE_ACCESS"] },
        freeAccessEndsAt: { gte: freeAccessStart, lt: freeAccessEnd },
      },
      select: { id: true, userId: true, freeAccessEndsAt: true },
    });

    for (const sub of endingFreeAccess) {
      const dedupe = `free-access-ending:${sub.id}:${sub.freeAccessEndsAt?.toISOString().slice(0, 10)}`;
      const existing = await prisma.notification.findFirst({
        where: {
          userId: sub.userId,
          type: "SYSTEM",
          metadata: { contains: dedupe },
        },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.notification.create({
        data: {
          userId: sub.userId,
          type: "SYSTEM",
          title: "Free Access ending soon",
          body: "Your Free Access ends in 7 days. You can choose an annual plan from Settings when you are ready.",
          href: "/settings/subscription",
          icon: "CreditCard",
          channel: "IN_APP",
          metadata: JSON.stringify({ kind: "free-access-ending", dedupe }),
        },
      });
      freeAccessNotified++;
    }

    const renewalTarget = new Date(now);
    renewalTarget.setDate(renewalTarget.getDate() + 30);
    const renewalStart = new Date(renewalTarget.getFullYear(), renewalTarget.getMonth(), renewalTarget.getDate());
    const renewalEnd = new Date(renewalStart);
    renewalEnd.setDate(renewalEnd.getDate() + 1);
    const renewingSubscriptions = await prisma.subscription.findMany({
      where: {
        provider: "STRIPE",
        status: "ACTIVE",
        billingInterval: "YEAR",
        cancelAtPeriodEnd: false,
        OR: [
          { currentPeriodEndsAt: { gte: renewalStart, lt: renewalEnd } },
          { stripeCurrentPeriodEnd: { gte: renewalStart, lt: renewalEnd } },
        ],
      },
      select: {
        id: true,
        userId: true,
        currentPeriodEndsAt: true,
        stripeCurrentPeriodEnd: true,
        firstChargeAmount: true,
      },
    });

    for (const sub of renewingSubscriptions) {
      const renewalDate = sub.currentPeriodEndsAt || sub.stripeCurrentPeriodEnd;
      const renewalDateText = renewalDate?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "the renewal date";
      const amount = sub.firstChargeAmount
        ? `$${sub.firstChargeAmount.toFixed(0)}/year`
        : INDIVIDUAL_ANNUAL_PRICE_LABEL;
      const dedupe = `annual-renewal:${sub.id}:${renewalDate?.toISOString().slice(0, 10) || "unknown"}`;
      const existing = await prisma.notification.findFirst({
        where: {
          userId: sub.userId,
          type: "SYSTEM",
          metadata: { contains: dedupe },
        },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.notification.create({
        data: {
          userId: sub.userId,
          type: "SYSTEM",
          title: "Annual renewal coming up",
          body: `Your Individual Annual plan renews on ${renewalDateText} for ${amount}. You can manage renewal in Settings.`,
          href: "/settings/subscription",
          icon: "CreditCard",
          channel: "IN_APP",
          metadata: JSON.stringify({ kind: "annual-renewal", dedupe }),
        },
      });
      renewalNotified++;
    }

    // Owners whose access this cron lapses must have their workspace seats
    // reconciled — otherwise members keep ACTIVE write access to a workspace
    // nobody is paying for. updateMany cannot return touched rows, so we read
    // the matching owner userIds (same `now` snapshot, same filter) right
    // before each transition, dedupe them, and reconcile after the updates.
    const affectedOwnerIds = new Set<string>();
    const collectOwners = async (where: Prisma.SubscriptionWhereInput) => {
      const rows = await prisma.subscription.findMany({ where, select: { userId: true } });
      for (const row of rows) affectedOwnerIds.add(row.userId);
    };

    // Mark expired legacy trials (plan=FREE_TRIAL but no Stripe-backed accessType).
    const legacyTrialWhere: Prisma.SubscriptionWhereInput = {
      plan: "FREE_TRIAL",
      accessType: { not: "FREE_TRIAL" },
      status: "TRIALING",
      trialEndsAt: { lt: now },
    };
    await collectOwners(legacyTrialWhere);
    const expiredTrials = await prisma.subscription.updateMany({
      where: legacyTrialWhere,
      data: {
        status: "EXPIRED",
      },
    });
    expired = expiredTrials.count;

    // Backstop: provider-backed FREE_TRIAL rows whose webhook delivery
    // dropped. Reconciliation cron normally catches these for Stripe, but
    // we expire them here too so users don't keep TRIALING+isActive past
    // the trial date if reconcile is delayed. Scoped tightly so we do not
    // touch rows that still have time left on their trial.
    const providerTrialWhere: Prisma.SubscriptionWhereInput = {
      accessType: "FREE_TRIAL",
      status: "TRIALING",
      trialEndsAt: { lt: now },
    };
    await collectOwners(providerTrialWhere);
    const expiredProviderTrials = await prisma.subscription.updateMany({
      where: providerTrialWhere,
      data: {
        status: "EXPIRED",
        autoRenew: false,
      },
    });
    expired += expiredProviderTrials.count;

    const freeAccessWhere: Prisma.SubscriptionWhereInput = {
      accessType: "FREE_ACCESS",
      // ADMIN-provider rows here are campaign FREE_ACCESS grants. Manual
      // admin premium grants live in a separate path below (premiumUntil
      // is the gate, not freeAccessEndsAt).
      premiumGrantedBy: null,
      status: { in: ["ACTIVE", "FREE_ACCESS"] },
      freeAccessEndsAt: { lt: now },
    };
    await collectOwners(freeAccessWhere);
    const expiredFreeAccess = await prisma.subscription.updateMany({
      where: freeAccessWhere,
      data: {
        status: "FREE_ACCESS_EXPIRED",
        autoRenew: false,
        cancelAtPeriodEnd: false,
      },
    });
    expired += expiredFreeAccess.count;

    // Manual admin premium grants: drop status to EXPIRED once premiumUntil
    // passes so getEffectiveEntitlement reports MANUAL_PREMIUM_EXPIRED and
    // plan-limits stops granting Individual limits.
    const manualPremiumWhere: Prisma.SubscriptionWhereInput = {
      provider: "ADMIN",
      premiumGrantedBy: { not: null },
      status: "ACTIVE",
      premiumUntil: { lt: now },
    };
    await collectOwners(manualPremiumWhere);
    const expiredManualPremium = await prisma.subscription.updateMany({
      where: manualPremiumWhere,
      data: {
        status: "EXPIRED",
        autoRenew: false,
        cancelAtPeriodEnd: false,
      },
    });
    expired += expiredManualPremium.count;

    // Seat-reconciliation safety net (SEAT-013): for every owner whose access
    // this cron lapsed, collapse over-limit workspaces they OWN to a single
    // seat (reconcileSeatsForOwner → reconcileWorkspaceSeats demotes non-owner
    // members to read-only OVERFLOW when the owner's entitlement hasAccess is
    // false, without demoting the OWNER). Best-effort: one owner's failure must
    // not abort the cron.
    let seatsReconciled = 0;
    for (const ownerUserId of affectedOwnerIds) {
      try {
        await reconcileSeatsForOwner(ownerUserId);
        seatsReconciled++;
      } catch (reconcileError) {
        console.error(`Seat reconcile failed for owner ${ownerUserId}:`, reconcileError);
      }
    }

    return NextResponse.json({ success: true, sent, freeAccessNotified, renewalNotified, expired, seatsReconciled });
  } catch (error) {
    console.error("Trial check cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

// Vercel cron sends GET requests
export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }
