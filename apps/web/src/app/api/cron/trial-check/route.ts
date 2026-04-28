import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTrialExpiringEmail } from "@/lib/email-service";
import { verifyInternalAuth } from "@/lib/internal-secrets";
import { INDIVIDUAL_ANNUAL_PRICE_LABEL } from "@/lib/shared-billing";

export const runtime = "nodejs";

// Cron handler for trial expiration checks and warnings
async function handleCron(request: NextRequest) {
  try {
    if (!verifyInternalAuth(request.headers.get("authorization"), "cron")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Mark expired trials
    const expiredTrials = await prisma.subscription.updateMany({
      where: {
        plan: "FREE_TRIAL",
        accessType: { not: "FREE_TRIAL" },
        status: "TRIALING",
        trialEndsAt: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });
    expired = expiredTrials.count;

    const expiredFreeAccess = await prisma.subscription.updateMany({
      where: {
        accessType: "FREE_ACCESS",
        status: { in: ["ACTIVE", "FREE_ACCESS"] },
        freeAccessEndsAt: { lt: now },
      },
      data: {
        status: "FREE_ACCESS_EXPIRED",
        autoRenew: false,
        cancelAtPeriodEnd: false,
      },
    });
    expired += expiredFreeAccess.count;

    return NextResponse.json({ success: true, sent, freeAccessNotified, renewalNotified, expired });
  } catch (error) {
    console.error("Trial check cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

// Vercel cron sends GET requests
export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }
