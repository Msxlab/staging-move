import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTrialExpiringEmail } from "@/lib/email-service";
import { verifyInternalAuth } from "@/lib/internal-secrets";

export const runtime = "nodejs";

// Cron handler for trial expiration checks and warnings
async function handleCron(request: NextRequest) {
  try {
    if (!verifyInternalAuth(request.headers.get("authorization"), "cron")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const reminderDays = [5, 3, 1];
    let sent = 0;
    let expired = 0;

    // Send expiry warning emails
    for (const days of reminderDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const subscriptions = await prisma.subscription.findMany({
        where: {
          plan: "FREE_TRIAL",
          status: "TRIALING",
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
          dedupeKey: `cron:trial-expiring:${sub.id}:${sub.trialEndsAt!.toISOString().slice(0, 10)}:${days}`,
          metadata: {
            userId: sub.userId,
            subscriptionId: sub.id,
          },
        });
        if (success) sent++;
      }
    }

    // Mark expired trials
    const expiredTrials = await prisma.subscription.updateMany({
      where: {
        plan: "FREE_TRIAL",
        status: "TRIALING",
        trialEndsAt: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });
    expired = expiredTrials.count;

    return NextResponse.json({ success: true, sent, expired });
  } catch (error) {
    console.error("Trial check cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

// Vercel cron sends GET requests
export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }
