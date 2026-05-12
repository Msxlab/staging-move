import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardCronRequest } from "@/lib/cron-guard";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Stale PENDING_CHECKOUT sweeper.
 *
 * /api/stripe/checkout flips the user's Subscription row to
 * `status='PENDING_CHECKOUT'` before redirecting to Stripe. Stripe's
 * `cancel_url` (apps/web/src/app/api/stripe/checkout/cancel/route.ts)
 * restores the row when the user clicks "Cancel" inside Checkout, but
 * if the user simply closes the tab Stripe never fires anything — the
 * row stays PENDING_CHECKOUT permanently and the upgrade banner reads
 * "Activating checkout..." forever.
 *
 * This cron sweeps rows older than the threshold and restores them to
 * the same state the cancel-redirect would have written. It is idempotent
 * and scoped tightly: only rows with `stripeSubscriptionId IS NULL`
 * (i.e. checkout never completed at Stripe) are touched, so a row that
 * raced past this gate but is genuinely waiting for the webhook will
 * not be clobbered.
 *
 * Schedule suggestion: every 5 minutes.
 */

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min

interface CleanupReport {
  scanned: number;
  restoredFreeAccess: number;
  restoredFreeAccessExpired: number;
  restoredCanceled: number;
  expiredRedemptions: number;
  errors: number;
}

async function handleCron(request: NextRequest) {
  const guard = await guardCronRequest(request, "checkout-cleanup");
  if (!guard.ok) return guard.response;

  const now = new Date();
  const cutoff = new Date(now.getTime() - STALE_THRESHOLD_MS);
  const report: CleanupReport = {
    scanned: 0,
    restoredFreeAccess: 0,
    restoredFreeAccessExpired: 0,
    restoredCanceled: 0,
    expiredRedemptions: 0,
    errors: 0,
  };

  const stale = await prisma.subscription.findMany({
    where: {
      status: "PENDING_CHECKOUT",
      stripeSubscriptionId: null,
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      userId: true,
      accessType: true,
      freeAccessEndsAt: true,
    },
    take: 500,
  });

  for (const sub of stale) {
    report.scanned += 1;
    const freeAccessEndsAt = sub.freeAccessEndsAt ? new Date(sub.freeAccessEndsAt) : null;
    let restoredStatus: "ACTIVE" | "FREE_ACCESS_EXPIRED" | "CANCELED";
    if (sub.accessType === "FREE_ACCESS") {
      restoredStatus = freeAccessEndsAt && freeAccessEndsAt > now ? "ACTIVE" : "FREE_ACCESS_EXPIRED";
    } else {
      restoredStatus = "CANCELED";
    }

    try {
      const mutations: any[] = [
        prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: restoredStatus,
            autoRenew: false,
            cancelAtPeriodEnd: false,
            lastSyncedAt: now,
            version: { increment: 1 },
          },
        }),
      ];
      const redemptionDelegate = (prisma as any).acquisitionRedemption;
      if (redemptionDelegate?.updateMany) {
        mutations.push(redemptionDelegate.updateMany({
          where: {
            userId: sub.userId,
            subscriptionId: sub.id,
            status: "PENDING_CHECKOUT",
          },
          data: { status: "EXPIRED" },
        }));
      }
      const results = typeof (prisma as any).$transaction === "function"
        ? await (prisma as any).$transaction(mutations)
        : await Promise.all(mutations);
      const redemptionResult = results[1] as { count?: number } | undefined;
      report.expiredRedemptions += redemptionResult?.count || 0;
      if (restoredStatus === "ACTIVE") report.restoredFreeAccess += 1;
      else if (restoredStatus === "FREE_ACCESS_EXPIRED") report.restoredFreeAccessExpired += 1;
      else report.restoredCanceled += 1;
    } catch (err: any) {
      report.errors += 1;
      logger.error("checkout-cleanup: restore failed", {
        subId: sub.id,
        error: err?.message || String(err),
      });
    }
  }

  logger.info("checkout-cleanup completed", { action: "CHECKOUT_CLEANUP", ...report });

  return NextResponse.json({ success: true, ...report });
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
