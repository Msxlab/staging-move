import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma, rawPrisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { mapStripePriceIdToPlanAndInterval } from "@/lib/billing";
import { reconcileSeatsForOwner } from "@/lib/workspace-ownership";
import { deriveStripeEntitlementFields } from "@/lib/stripe-subscription-mapping";
import { guardCronRequest } from "@/lib/cron-guard";
import { captureMessage } from "@/lib/sentry";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — reconciliation can walk thousands of subs

/**
 * Stripe reconciliation cron — nightly.
 *
 * Webhooks deliver state changes in real time, but webhooks CAN be
 * dropped (network failure, signature mismatch during a secret
 * rotation, retries exhausted after a long outage, etc.). Without a
 * second source of truth the DB mirror silently diverges from Stripe,
 * and the divergence compounds: users whose subscriptions were
 * canceled in Stripe continue to see premium features here; users who
 * upgraded in Stripe never get the new plan flag.
 *
 * This endpoint walks every `Subscription` row with a
 * `stripeSubscriptionId`, fetches the live Stripe object, and either
 * (a) marks the local row synced if they match, or (b) applies the
 * Stripe state as authoritative and emits a Sentry warning naming the
 * drift. Stripe is the source of truth for billing state.
 *
 * Uses `rawPrisma` so soft-deleted users' subscriptions are still
 * reconciled — a user who asked for deletion but whose Stripe sub is
 * still charging money needs urgent attention, not silent skipping.
 *
 * Schedule suggestion: 03:15 UTC daily via Ofelia or Vercel Cron.
 * Protected by CRON_SECRET (or INTERNAL_WEBHOOK_SECRET override).
 */

interface ReconcileReport {
  scanned: number;
  matched: number;
  driftCorrected: number;
  stripeMissing: number;
  errors: number;
  divergences: Array<{
    subId: string;
    userId: string;
    field: string;
    before: string | null;
    after: string | null;
  }>;
}

async function handleCron(request: NextRequest) {
  // Stripe reconcile is heavy (hits Stripe + writes to DB for every sub).
  // Cap at 2/min so a leaked secret cannot trigger thousands of API calls.
  const guard = await guardCronRequest(request, "stripe-reconcile", { limit: 2 });
  if (!guard.ok) return guard.response;

  const stripeSecretKey = await getRuntimeConfigValue("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 503 },
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
  const report: ReconcileReport = {
    scanned: 0,
    matched: 0,
    driftCorrected: 0,
    stripeMissing: 0,
    errors: 0,
    divergences: [],
  };

  // Walk in pages — a single findMany on a growing billing table is a
  // latent OOM waiting to happen. Page size of 200 keeps peak memory
  // bounded and lets the cron checkpoint progress in logs.
  const PAGE_SIZE = 200;
  let cursor: string | undefined = undefined;

  while (true) {
    const batch: Array<{
      id: string;
      userId: string;
      stripeSubscriptionId: string | null;
      stripePriceId: string | null;
      stripeCurrentPeriodEnd: Date | null;
      status: string;
      plan: string;
      billingInterval: string | null;
      canceledAt: Date | null;
      accessType: string | null;
      cancelAtPeriodEnd: boolean;
      autoRenew: boolean | null;
    }> = await rawPrisma.subscription.findMany({
      where: {
        stripeSubscriptionId: { not: null },
        // Defensive: skip rows whose provider is ADMIN. Admin manual grants
        // clear stripeSubscriptionId on write, but legacy rows may still
        // carry stale IDs. Those IDs may resolve to canceled Stripe subs,
        // which would flip the ADMIN row's status to CANCELED and silently
        // revoke the manual premium.
        provider: { not: "ADMIN" },
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        userId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        stripeCurrentPeriodEnd: true,
        status: true,
        plan: true,
        billingInterval: true,
        canceledAt: true,
        accessType: true,
        cancelAtPeriodEnd: true,
        autoRenew: true,
      },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (const sub of batch) {
      report.scanned += 1;
      if (!sub.stripeSubscriptionId) continue;

      let live: Stripe.Subscription;
      try {
        live = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      } catch (err: any) {
        // 404 → row points at a sub that no longer exists in Stripe.
        // Mark the row as `canceled` so we stop honoring it, and log
        // loud — an admin should investigate whether it was a legit
        // cancellation that the webhook missed or data corruption.
        if (err?.statusCode === 404) {
          report.stripeMissing += 1;
          captureMessage(
            `Stripe reconcile: subscription ${sub.stripeSubscriptionId} missing from Stripe`,
            "warning",
          );
          await rawPrisma.subscription
            .update({
              where: { id: sub.id },
              data: {
                status: "CANCELED",
                canceledAt: sub.canceledAt ?? new Date(),
                lastSyncedAt: new Date(),
              },
            })
            .catch(() => null);
          continue;
        }
        report.errors += 1;
        logger.error("Stripe reconcile: fetch failed", {
          subId: sub.id,
          stripeSubId: sub.stripeSubscriptionId,
          error: err?.message || String(err),
        });
        continue;
      }

      const livePriceId = live.items?.data?.[0]?.price?.id ?? null;
      const mappedPrice = livePriceId
        ? await mapStripePriceIdToPlanAndInterval(livePriceId).catch(() => null)
        : null;
      const livePlan = mappedPrice?.plan || sub.plan;
      const liveBillingInterval = mappedPrice?.billingInterval || sub.billingInterval;
      const livePeriodEnd = (live as any).current_period_end
        ? new Date((live as any).current_period_end * 1000)
        : null;
      // Derive status/accessType/cancel/autoRenew the SAME way the Stripe
      // webhook does (shared helper) so this nightly reconcile can't drift
      // from it. Previously it used a cancel-unaware status map and never
      // synced accessType — silently re-activating canceled subs and leaving
      // trial→paid conversions stuck at FREE_TRIAL ($0 in MRR).
      const entitlement = deriveStripeEntitlementFields(live);
      const liveStatus = entitlement.status;
      const liveCanceledAt = live.canceled_at
        ? new Date(live.canceled_at * 1000)
        : null;

      const diffs: Array<{ field: string; before: string | null; after: string | null }> = [];
      if (sub.status !== liveStatus) {
        diffs.push({ field: "status", before: sub.status, after: liveStatus });
      }
      if (sub.plan !== livePlan) {
        diffs.push({ field: "plan", before: sub.plan, after: livePlan });
      }
      if (sub.billingInterval !== liveBillingInterval) {
        diffs.push({ field: "billingInterval", before: sub.billingInterval, after: liveBillingInterval });
      }
      if (sub.stripePriceId !== livePriceId) {
        diffs.push({
          field: "stripePriceId",
          before: sub.stripePriceId,
          after: livePriceId,
        });
      }
      const localPeriodMs = sub.stripeCurrentPeriodEnd?.getTime() ?? null;
      const livePeriodMs = livePeriodEnd?.getTime() ?? null;
      if (localPeriodMs !== livePeriodMs) {
        diffs.push({
          field: "stripeCurrentPeriodEnd",
          before: sub.stripeCurrentPeriodEnd?.toISOString() ?? null,
          after: livePeriodEnd?.toISOString() ?? null,
        });
      }
      const localCanceledMs = sub.canceledAt?.getTime() ?? null;
      const liveCanceledMs = liveCanceledAt?.getTime() ?? null;
      if (localCanceledMs !== liveCanceledMs) {
        diffs.push({
          field: "canceledAt",
          before: sub.canceledAt?.toISOString() ?? null,
          after: liveCanceledAt?.toISOString() ?? null,
        });
      }
      if (sub.accessType !== entitlement.accessType) {
        diffs.push({ field: "accessType", before: sub.accessType, after: entitlement.accessType });
      }
      if (sub.cancelAtPeriodEnd !== entitlement.cancelAtPeriodEnd) {
        diffs.push({
          field: "cancelAtPeriodEnd",
          before: String(sub.cancelAtPeriodEnd),
          after: String(entitlement.cancelAtPeriodEnd),
        });
      }
      if (sub.autoRenew !== entitlement.autoRenew) {
        diffs.push({
          field: "autoRenew",
          before: String(sub.autoRenew),
          after: String(entitlement.autoRenew),
        });
      }

      if (diffs.length === 0) {
        report.matched += 1;
        await rawPrisma.subscription
          .update({ where: { id: sub.id }, data: { lastSyncedAt: new Date() } })
          .catch(() => null);
        continue;
      }

      // Drift detected — apply Stripe as authoritative and record each
      // field's before/after in the report for operator visibility.
      report.driftCorrected += 1;
      for (const d of diffs) {
        report.divergences.push({
          subId: sub.id,
          userId: sub.userId,
          field: d.field,
          before: d.before,
          after: d.after,
        });
      }
      captureMessage(
        `Stripe reconcile: drift corrected for sub ${sub.id} (${diffs.map((d) => d.field).join(", ")})`,
        "warning",
      );
      await rawPrisma.subscription
        .update({
          where: { id: sub.id },
          data: {
            status: liveStatus,
            accessType: entitlement.accessType,
            cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
            autoRenew: entitlement.autoRenew,
            plan: livePlan,
            billingInterval: liveBillingInterval,
            stripePriceId: livePriceId,
            stripeCurrentPeriodEnd: livePeriodEnd,
            // Write BOTH period-end fields. The entitlement resolver prefers
            // currentPeriodEndsAt; if reconcile only updated stripeCurrentPeriodEnd,
            // a dropped renewal webhook would leave currentPeriodEndsAt stale and
            // the user would read as expired despite Stripe being current.
            currentPeriodEndsAt: livePeriodEnd,
            canceledAt: liveCanceledAt,
            lastSyncedAt: new Date(),
          },
        })
        .catch((err) => {
          report.errors += 1;
          logger.error("Stripe reconcile: update failed", {
            subId: sub.id,
            error: err?.message || String(err),
          });
        });
      // Drift may have changed the tier (or revoked access) → reconcile seats
      // for any workspaces this user owns, catching downgrades that arrived via
      // a dropped webhook.
      await reconcileSeatsForOwner(sub.userId).catch(() => {});
    }

    if (batch.length < PAGE_SIZE) break;
  }

  logger.info("Stripe reconcile completed", { action: "STRIPE_RECONCILE", ...report });

  // Quiet warm-reference to the filtered client so imports tree-shake
  // consistently and the bundle analyzer doesn't flag unreferenced
  // `prisma` when this file eventually calls into helpers that use it.
  void prisma;

  return NextResponse.json({ success: true, ...report });
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
