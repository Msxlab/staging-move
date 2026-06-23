/**
 * POST /api/webhooks/appstore
 *
 * Apple App Store Server Notifications v2.
 * Apple POSTs a single JSON body: { signedPayload: "<JWS>" }.
 *
 * The JWS is signed by Apple's AppleRootCA-G3 chain — we verify it
 * locally (no shared-secret header needed). The inner payload contains
 * `notificationUUID` which we use for replay/idempotency.
 *
 * Reference:
 * https://developer.apple.com/documentation/appstoreservernotifications
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { captureException, captureMessage } from "@/lib/sentry";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { reserveWebhookEvent, releaseWebhookEvent } from "@/lib/webhook-idempotency";
import {
  verifyAppleJws,
  type AppleNotificationPayload,
  type AppleTransactionPayload,
  type AppleRenewalPayload,
} from "@/lib/iap-apple";
import {
  applyIapStateToUser,
  findUserByIapIdentifier,
  refreshAppleSubscriptionFor,
  sendIapCancellationNotice,
} from "@/lib/iap-common";
import { isDeployedBillingEnvironment } from "@/lib/billing-config";
import { emitSecurityEvent } from "@/lib/security-events";
import { alertWebhookSignatureFailure } from "@/lib/security-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Apple App Store Server Notifications v2 envelopes are a single
// signedPayload JWS — even the chunkiest in-app purchase event is
// well under 64KB. The middleware exempts /api/webhooks/* from the
// global body-size limit so JWS verification can run on the raw
// bytes; re-introduce a per-route ceiling so a hostile client can't
// stream MB-scale junk hoping verifyAppleJws gives up.
const APPSTORE_WEBHOOK_MAX_BODY_BYTES = 64 * 1024;

// Audit 4.4: unified with the shared deployed-environment predicate so the
// production-like gate here can never drift from the IAP sandbox-allowlist gate
// in iap-common (production OR staging OR preview OR NODE_ENV=production).
const isProductionLikeRuntime = () => isDeployedBillingEnvironment();

function emitAppstoreFailure(reason: string, context: Record<string, unknown> = {}) {
  emitSecurityEvent({
    type: "WEBHOOK_SIG_FAILURE",
    severity: "warn",
    group: "webhook",
    context: {
      provider: "appstore",
      reason,
      environment: process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      ...context,
    },
  });
  // Operator email alarm (deduped to one per UTC day per reason) — detection
  // only; never throws (audit SEC-ALERT "DETECT: web off").
  void alertWebhookSignatureFailure({ provider: "appstore", reason });
}

export async function POST(request: NextRequest) {
  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > APPSTORE_WEBHOOK_MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const body = await request.json().catch(() => null);
    const signedPayload = body && typeof body.signedPayload === "string" ? body.signedPayload : null;
    if (!signedPayload) {
      return NextResponse.json({ error: "Missing signedPayload" }, { status: 400 });
    }

    let outer: AppleNotificationPayload;
    try {
      outer = verifyAppleJws<AppleNotificationPayload>(signedPayload);
    } catch (err) {
      // Same event payload as before, now routed through the shared helper so
      // the operator email alarm fires alongside the structured event.
      emitAppstoreFailure("outer_jws_verify_failed", { tokenLength: signedPayload.length });
      console.warn("[APPSTORE WEBHOOK] outer JWS verify failed:", (err as Error).message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (!outer?.notificationUUID) {
      return NextResponse.json({ error: "Missing notificationUUID" }, { status: 400 });
    }

    const expectedBundleId = await getRuntimeConfigValue("APPLE_BUNDLE_ID");
    // Mirror the Play Store handler: in a production-like runtime we MUST be able
    // to verify the notification targets our bundle. Without APPLE_BUNDLE_ID the
    // bundle checks below silently no-op, so a valid Apple-signed notification for
    // a DIFFERENT app would be processed. Fail closed instead of skipping the check.
    if (!expectedBundleId && isProductionLikeRuntime()) {
      emitAppstoreFailure("missing_expected_bundle", { correlationId: outer.notificationUUID });
      return NextResponse.json({ error: "App Store bundle id is not configured" }, { status: 503 });
    }
    if (expectedBundleId && outer.data?.bundleId && outer.data.bundleId !== expectedBundleId) {
      emitAppstoreFailure("bundle_mismatch", { correlationId: outer.notificationUUID });
      return NextResponse.json({ error: "Invalid bundle" }, { status: 400 });
    }

    // Replay protection — reject payloads older than 72h.
    if (typeof outer.signedDate === "number") {
      const ageSec = (Date.now() - outer.signedDate) / 1000;
      if (ageSec > 72 * 60 * 60) {
        console.warn(`[APPSTORE WEBHOOK] stale notification ${outer.notificationUUID} (${Math.round(ageSec)}s)`);
        return NextResponse.json({ received: true, stale: true });
      }
    }

    let innerTransaction: AppleTransactionPayload | null = null;
    let innerRenewal: AppleRenewalPayload | null = null;
    try {
      innerTransaction = outer.data?.signedTransactionInfo
        ? verifyAppleJws<AppleTransactionPayload>(outer.data.signedTransactionInfo)
        : null;
      innerRenewal = outer.data?.signedRenewalInfo
        ? verifyAppleJws<AppleRenewalPayload>(outer.data.signedRenewalInfo)
        : null;
    } catch {
      // Same event payload as before, routed through the shared helper (which
      // also raises the operator email alarm).
      emitAppstoreFailure("inner_jws_verify_failed", {
        tokenLength: Math.max(
          outer.data?.signedTransactionInfo?.length ?? 0,
          outer.data?.signedRenewalInfo?.length ?? 0,
        ),
        correlationId: outer.notificationUUID,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (expectedBundleId && innerTransaction?.bundleId && innerTransaction.bundleId !== expectedBundleId) {
      emitAppstoreFailure("inner_bundle_mismatch", { correlationId: outer.notificationUUID });
      return NextResponse.json({ error: "Invalid bundle" }, { status: 400 });
    }

    // DB-backed idempotency — atomically RESERVE this notification BEFORE any
    // side-effect runs (mirrors the Stripe webhook). Placed AFTER signature /
    // bundle verification (those 400 with no side-effect, so they need no
    // reservation) but BEFORE the first side-effect. A concurrently-delivered
    // duplicate loses the unique-key create race and bails here, so the
    // subscription refresh / entitlement apply / cancellation notice can never
    // double-run. The reservation is RELEASED on failure (catch below) so a
    // legitimate Apple retry can reprocess; it stays marked on success and on
    // terminal no-op outcomes (TEST / unowned / conflict) since those are fully
    // processed.
    const reservation = await reserveWebhookEvent(outer.notificationUUID, "appstore");
    if (reservation === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    try {
      const originalTransactionId =
        innerTransaction?.originalTransactionId || innerRenewal?.originalTransactionId || null;

      if (!originalTransactionId) {
        // TEST notifications from App Store Connect have no transaction payload.
        if (outer.notificationType === "TEST") {
          console.info("[APPSTORE WEBHOOK] received TEST notification");
          return NextResponse.json({ received: true, test: true });
        }
        captureMessage(
          `[APPSTORE WEBHOOK] ${outer.notificationType}/${outer.subtype || "-"} missing originalTransactionId`,
          "warning",
        );
        return NextResponse.json({ received: true, skipped: true });
      }

      // Find the owning user. The subscription row was linked during /api/mobile/iap/verify
      // when the user originally purchased — so the mapping should already exist.
      const owner = await findUserByIapIdentifier({ originalTransactionId });
      if (!owner) {
        // Apple can send notifications for cross-family purchases (e.g. Family
        // Sharing) that we haven't indexed yet. Log and swallow so Apple doesn't
        // keep retrying — the next /verify call from the client will claim it.
        console.warn(
          `[APPSTORE WEBHOOK] no owner for originalTransactionId=${originalTransactionId} (${outer.notificationType})`,
        );
        return NextResponse.json({ received: true, unowned: true });
      }

      const refreshed = await refreshAppleSubscriptionFor(originalTransactionId);
      if (refreshed) {
        try {
          await applyIapStateToUser({ userId: owner.userId, state: refreshed });
        } catch (err: any) {
          if (err?.message === "IAP_TXN_OWNED_BY_ANOTHER_USER") {
            // Someone else claimed this txn — log and move on.
            captureMessage(
              `[APPSTORE WEBHOOK] owner conflict for ${originalTransactionId}`,
              "warning",
            );
            return NextResponse.json({ received: true, conflict: true });
          }
          throw err;
        }
      } else if (outer.notificationType === "REVOKE" || outer.notificationType === "REFUND") {
        // Refunds may 404 in the Server API — mark canceled manually.
        await prisma.subscription.updateMany({
          where: { userId: owner.userId, originalTransactionId },
          data: {
            status: "CANCELED",
            canceledAt: new Date(),
            lastSyncedAt: new Date(),
          },
        });
        await sendIapCancellationNotice({
          userId: owner.userId,
          provider: "APP_STORE",
          platform: "ios",
          dedupeKey: `iap:manual-canceled:APP_STORE:${originalTransactionId}`,
        }).catch((err) => {
          console.error("[APPSTORE WEBHOOK] cancellation email failed:", err);
        });
      }

      return NextResponse.json({
        received: true,
        type: outer.notificationType,
        subtype: outer.subtype || null,
      });
    } catch (err: any) {
      // A sandbox receipt reaching production for a non-allowlisted user is a
      // TERMINAL "skip" outcome, not a transient failure — retrying can't turn
      // a sandbox purchase into a real one. KEEP the reservation (don't fall
      // through to the release below) so Apple's redelivery is treated as a
      // duplicate, and surface a 200 so Apple stops retrying. Mirrors the
      // Play Store GOOGLE_TEST_PURCHASE_IN_PRODUCTION terminal-skip handling.
      if (err?.message === "APPLE_SANDBOX_PURCHASE_IN_PRODUCTION") {
        console.warn(
          `[APPSTORE WEBHOOK] sandbox purchase in production rejected for ${outer.notificationUUID}`,
        );
        return NextResponse.json({ received: true, skipped: "sandbox_purchase_production" });
      }
      // Processing failed after the notification was reserved — release the
      // reservation so Apple's retry re-processes it instead of seeing a
      // duplicate and dropping the work.
      await releaseWebhookEvent(outer.notificationUUID, "appstore").catch(() => {});
      throw err;
    }
  } catch (error) {
    captureException(error, { route: "/api/webhooks/appstore" });
    console.error("[APPSTORE WEBHOOK] error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
