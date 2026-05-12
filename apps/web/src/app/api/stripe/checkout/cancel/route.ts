import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SETTINGS_CANCELED_PATH = "/settings/subscription?canceled=true";

function canceledRedirect(request: NextRequest) {
  return NextResponse.redirect(new URL(SETTINGS_CANCELED_PATH, request.url));
}

async function resetPendingCheckoutForUser(userId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      accessType: true,
      freeAccessEndsAt: true,
      stripeSubscriptionId: true,
    },
  });

  if (!subscription) return false;
  if (subscription.status !== "PENDING_CHECKOUT") return false;
  if (subscription.stripeSubscriptionId) return false;

  const now = new Date();
  const freeAccessEndsAt = subscription.freeAccessEndsAt
    ? new Date(subscription.freeAccessEndsAt)
    : null;
  const restoredStatus =
    subscription.accessType === "FREE_ACCESS"
      ? freeAccessEndsAt && freeAccessEndsAt > now
        ? "ACTIVE"
        : "FREE_ACCESS_EXPIRED"
      : "CANCELED";

  const mutations: any[] = [
    prisma.subscription.update({
      where: { userId },
      data: {
        status: restoredStatus,
        autoRenew: false,
        cancelAtPeriodEnd: false,
        lastSyncedAt: now,
      },
    }),
  ];
  const redemptionDelegate = (prisma as any).acquisitionRedemption;
  if (subscription.id && redemptionDelegate?.updateMany) {
    mutations.push(redemptionDelegate.updateMany({
      where: {
        userId,
        subscriptionId: subscription.id,
        status: "PENDING_CHECKOUT",
      },
      data: { status: "CANCELED" },
    }));
  }
  if (typeof (prisma as any).$transaction === "function") {
    await (prisma as any).$transaction(mutations);
  } else {
    await Promise.all(mutations);
  }
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    await resetPendingCheckoutForUser(userId);
  } catch {
    // The user still needs to land back on the subscription page even if the
    // local pending reset cannot run, for example after an expired session.
  }

  return canceledRedirect(request);
}

// Called by the subscription management page when it detects a stuck
// PENDING_CHECKOUT (e.g. the user hit the browser back button from Stripe
// Checkout — Stripe's cancel_url is not fired in that path, so without this
// reset the row would stay PENDING_CHECKOUT until the 30 min cron sweep).
export async function POST() {
  try {
    const userId = await requireDbUserId();
    const reset = await resetPendingCheckoutForUser(userId);
    return NextResponse.json({ reset });
  } catch {
    return NextResponse.json({ reset: false }, { status: 200 });
  }
}
