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
import { hasProcessedWebhookEvent, markWebhookEventProcessed } from "@/lib/webhook-idempotency";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Apple App Store Server Notifications v2 envelopes are a single
// signedPayload JWS — even the chunkiest in-app purchase event is
// well under 64KB. The middleware exempts /api/webhooks/* from the
// global body-size limit so JWS verification can run on the raw
// bytes; re-introduce a per-route ceiling so a hostile client can't
// stream MB-scale junk hoping verifyAppleJws gives up.
const APPSTORE_WEBHOOK_MAX_BODY_BYTES = 64 * 1024;

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
      console.warn("[APPSTORE WEBHOOK] outer JWS verify failed:", (err as Error).message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (!outer?.notificationUUID) {
      return NextResponse.json({ error: "Missing notificationUUID" }, { status: 400 });
    }

    // Replay protection — reject payloads older than 72h.
    if (typeof outer.signedDate === "number") {
      const ageSec = (Date.now() - outer.signedDate) / 1000;
      if (ageSec > 72 * 60 * 60) {
        console.warn(`[APPSTORE WEBHOOK] stale notification ${outer.notificationUUID} (${Math.round(ageSec)}s)`);
        return NextResponse.json({ received: true, stale: true });
      }
    }

    // DB-backed idempotency — prevent double-processing across restarts.
    if (await hasProcessedWebhookEvent(outer.notificationUUID)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const complete = async (body: Record<string, unknown>) => {
      const markResult = await markWebhookEventProcessed(outer.notificationUUID, "appstore");
      if (markResult === "duplicate") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      return NextResponse.json(body);
    };

    const innerTransaction = outer.data?.signedTransactionInfo
      ? verifyAppleJws<AppleTransactionPayload>(outer.data.signedTransactionInfo)
      : null;
    const innerRenewal = outer.data?.signedRenewalInfo
      ? verifyAppleJws<AppleRenewalPayload>(outer.data.signedRenewalInfo)
      : null;

    const originalTransactionId =
      innerTransaction?.originalTransactionId || innerRenewal?.originalTransactionId || null;

    if (!originalTransactionId) {
      // TEST notifications from App Store Connect have no transaction payload.
      if (outer.notificationType === "TEST") {
        console.info("[APPSTORE WEBHOOK] received TEST notification");
        return complete({ received: true, test: true });
      }
      captureMessage(
        `[APPSTORE WEBHOOK] ${outer.notificationType}/${outer.subtype || "-"} missing originalTransactionId`,
        "warning",
      );
      return complete({ received: true, skipped: true });
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
      return complete({ received: true, unowned: true });
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
          return complete({ received: true, conflict: true });
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

    return complete({
      received: true,
      type: outer.notificationType,
      subtype: outer.subtype || null,
    });
  } catch (error) {
    captureException(error, { route: "/api/webhooks/appstore" });
    console.error("[APPSTORE WEBHOOK] error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
