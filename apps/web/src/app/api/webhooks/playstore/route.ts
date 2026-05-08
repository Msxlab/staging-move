/**
 * POST /api/webhooks/playstore
 *
 * Google Play Real-time Developer Notifications (RTDN), delivered via
 * Cloud Pub/Sub push.
 *
 * Pub/Sub wraps the RTDN payload like:
 *   {
 *     "message": {
 *       "data": "<base64-encoded JSON>",   // the RTDN
 *       "messageId": "12345",
 *       "publishTime": "...",
 *       "attributes": { ... }
 *     },
 *     "subscription": "projects/.../subscriptions/..."
 *   }
 *
 * Authentication is done via OIDC: Pub/Sub includes a bearer JWT in the
 * `Authorization` header signed by Google, with `aud = <webhook URL>` and
 * `email = <push-auth service account>`. We verify this against Google's JWKS.
 *
 * Reference:
 * https://developer.android.com/google/play/billing/rtdn-reference
 * https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { captureException, captureMessage } from "@/lib/sentry";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { verifyPubsubOidcToken } from "@/lib/iap-google";
import { hasProcessedWebhookEvent, markWebhookEventProcessed } from "@/lib/webhook-idempotency";
import { emitSecurityEvent } from "@/lib/security-events";
import {
  applyIapStateToUser,
  findUserByIapIdentifier,
  refreshGoogleSubscriptionFor,
  sendIapCancellationNotice,
} from "@/lib/iap-common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RtdnSubscriptionNotification {
  version: string;
  notificationType: number; // 1..13
  purchaseToken: string;
  subscriptionId: string;
}

interface RtdnOneTimePurchaseNotification {
  version: string;
  notificationType: number;
  purchaseToken: string;
  sku: string;
}

interface RtdnPayload {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: RtdnSubscriptionNotification;
  oneTimeProductNotification?: RtdnOneTimePurchaseNotification;
  voidedPurchaseNotification?: {
    purchaseToken: string;
    orderId: string;
    productType: number;
    refundType: number;
  };
  testNotification?: { version: string };
}

// Pub/Sub wraps a single base64 RTDN payload — even with attributes
// the envelope stays well under 64KB. Cap here so a hostile client
// (or a misbehaving Pub/Sub push) can't waste OIDC verification on a
// multi-MB body.
const PLAYSTORE_WEBHOOK_MAX_BODY_BYTES = 64 * 1024;

function isProductionLikeRuntime() {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  return (
    process.env.NODE_ENV === "production" ||
    appEnv === "production" ||
    appEnv === "staging" ||
    appEnv === "preview"
  );
}

function emitPlaystoreFailure(reason: string, context: Record<string, unknown> = {}) {
  emitSecurityEvent({
    type: "WEBHOOK_SIG_FAILURE",
    severity: "warn",
    group: "webhook",
    context: {
      provider: "playstore",
      reason,
      environment: process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      ...context,
    },
  });
}

export async function POST(request: NextRequest) {
  let idempotencyId: string | null = null;
  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > PLAYSTORE_WEBHOOK_MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    // ── 1. Verify OIDC token from Pub/Sub (authenticity + audience). ──
    const authHeader = request.headers.get("authorization") || "";
    const oidcToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    const [expectedAudience, expectedServiceAccountEmail, expectedSubject] = await Promise.all([
      getRuntimeConfigValue("GOOGLE_PLAY_RTDN_AUDIENCE"),
      getRuntimeConfigValue("EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL"),
      getRuntimeConfigValue("EXPECTED_PLAYSTORE_WEBHOOK_SUBJECT"),
    ]);

    if (expectedAudience) {
      if (!oidcToken) {
        emitPlaystoreFailure("missing_oidc_token", {
          tokenLength: 0,
          correlationId: request.headers.get("x-cloud-trace-context") || null,
        });
        return NextResponse.json({ error: "Missing OIDC token" }, { status: 401 });
      }
      if (isProductionLikeRuntime() && !expectedServiceAccountEmail && !expectedSubject) {
        emitPlaystoreFailure("missing_expected_identity", { tokenLength: oidcToken.length });
        captureMessage(
          "[PLAYSTORE WEBHOOK] expected OIDC identity unset in production-like runtime; rejecting RTDN",
          "error",
        );
        return NextResponse.json(
          { error: "Google Play RTDN identity is not configured" },
          { status: 503 },
        );
      }
      try {
        const verified = await verifyPubsubOidcToken(oidcToken, expectedAudience);
        if (expectedServiceAccountEmail) {
          const expectedEmail = expectedServiceAccountEmail.toLowerCase();
          if (!verified.emailVerified || verified.email.toLowerCase() !== expectedEmail) {
            emitPlaystoreFailure("unexpected_service_account", { tokenLength: oidcToken.length });
            return NextResponse.json({ error: "Invalid OIDC identity" }, { status: 401 });
          }
        }
        if (expectedSubject && verified.subject !== expectedSubject) {
          emitPlaystoreFailure("unexpected_subject", { tokenLength: oidcToken.length });
          return NextResponse.json({ error: "Invalid OIDC identity" }, { status: 401 });
        }
      } catch (err) {
        emitPlaystoreFailure("oidc_verify_failed", { tokenLength: oidcToken.length });
        console.warn("[PLAYSTORE WEBHOOK] OIDC verify failed:", (err as Error).message);
        return NextResponse.json({ error: "Invalid OIDC token" }, { status: 401 });
      }
    } else if (isProductionLikeRuntime()) {
      emitPlaystoreFailure("missing_expected_audience");
      captureMessage(
        "[PLAYSTORE WEBHOOK] GOOGLE_PLAY_RTDN_AUDIENCE unset in production-like runtime; rejecting RTDN",
        "error",
      );
      return NextResponse.json(
        { error: "Google Play RTDN audience is not configured" },
        { status: 503 },
      );
    } else {
      // Development/test escape hatch only. Production rejects before parsing.
      console.warn("[PLAYSTORE WEBHOOK] GOOGLE_PLAY_RTDN_AUDIENCE unset - skipping OIDC verification");
    }

    // ── 2. Parse Pub/Sub envelope + extract RTDN. ──
    const envelope = await request.json().catch(() => null);
    const messageId = envelope?.message?.messageId as string | undefined;
    const dataB64 = envelope?.message?.data as string | undefined;

    if (!messageId || !dataB64) {
      // Empty payload — Pub/Sub sometimes sends these to verify the endpoint.
      return NextResponse.json({ received: true, empty: true });
    }

    let rtdn: RtdnPayload;
    try {
      rtdn = JSON.parse(Buffer.from(dataB64, "base64").toString("utf8")) as RtdnPayload;
    } catch (err) {
      captureException(err, { route: "/api/webhooks/playstore", messageId });
      return NextResponse.json({ error: "Invalid RTDN JSON" }, { status: 400 });
    }

    // ── 3. Idempotency (Pub/Sub may deliver the same messageId multiple times). ──
    idempotencyId = `playstore:${messageId}`;
    if (await hasProcessedWebhookEvent(idempotencyId)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const complete = async (body: Record<string, unknown>) => {
      const markResult = await markWebhookEventProcessed(idempotencyId!, "playstore");
      if (markResult === "duplicate") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      return NextResponse.json(body);
    };

    // ── 4. Validate package name matches our app (defense in depth). ──
    const expectedPackage = await getRuntimeConfigValue("GOOGLE_PLAY_PACKAGE_NAME");
    if (isProductionLikeRuntime() && !expectedPackage) {
      emitPlaystoreFailure("missing_expected_package", { messageId });
      captureMessage(
        "[PLAYSTORE WEBHOOK] GOOGLE_PLAY_PACKAGE_NAME unset in production-like runtime; rejecting RTDN",
        "error",
      );
      return NextResponse.json(
        { error: "Google Play package name is not configured" },
        { status: 503 },
      );
    }
    if (expectedPackage && rtdn.packageName && rtdn.packageName !== expectedPackage) {
      emitPlaystoreFailure("package_mismatch", { messageId });
      captureMessage(
        "[PLAYSTORE WEBHOOK] package mismatch",
        "warning",
      );
      const markResult = await markWebhookEventProcessed(idempotencyId!, "playstore");
      if (markResult === "duplicate") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      return NextResponse.json(
        { received: true, skipped: "package_mismatch" },
        { status: 400 },
      );
    }

    if (rtdn.testNotification) {
      console.info("[PLAYSTORE WEBHOOK] received TEST notification");
      return complete({ received: true, test: true });
    }

    // ── 5. Only subscription events drive our Subscription rows today. ──
    const subNotif = rtdn.subscriptionNotification;
    const voidNotif = rtdn.voidedPurchaseNotification;

    if (voidNotif?.purchaseToken) {
      const owner = await findUserByIapIdentifier({ purchaseToken: voidNotif.purchaseToken });
      if (owner) {
        await prisma.subscription.updateMany({
          where: { userId: owner.userId, purchaseToken: voidNotif.purchaseToken },
          data: {
            status: "CANCELED",
            canceledAt: new Date(),
            lastSyncedAt: new Date(),
          },
        });
        await sendIapCancellationNotice({
          userId: owner.userId,
          provider: "PLAY_STORE",
          platform: "android",
          dedupeKey: `iap:manual-canceled:PLAY_STORE:${voidNotif.purchaseToken.slice(0, 32)}`,
        }).catch((err) => {
          console.error("[PLAYSTORE WEBHOOK] voided email failed:", err);
        });
      }
      return complete({ received: true, type: "voided" });
    }

    if (!subNotif?.purchaseToken) {
      return complete({ received: true, skipped: "no_subscription" });
    }

    const owner = await findUserByIapIdentifier({ purchaseToken: subNotif.purchaseToken });
    if (!owner) {
      // No row yet — the client's /verify call will create one when it lands.
      console.warn(
        `[PLAYSTORE WEBHOOK] no owner for purchaseToken=${subNotif.purchaseToken.slice(0, 16)}... (${subNotif.notificationType})`,
      );
      return complete({ received: true, unowned: true });
    }

    const refreshed = await refreshGoogleSubscriptionFor(subNotif.purchaseToken);
    if (!refreshed) {
      // Purchase revoked server-side — mark canceled.
      await prisma.subscription.updateMany({
        where: { userId: owner.userId, purchaseToken: subNotif.purchaseToken },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
          lastSyncedAt: new Date(),
        },
      });
      await sendIapCancellationNotice({
        userId: owner.userId,
        provider: "PLAY_STORE",
        platform: "android",
        dedupeKey: `iap:manual-canceled:PLAY_STORE:${subNotif.purchaseToken.slice(0, 32)}`,
      }).catch((err) => {
        console.error("[PLAYSTORE WEBHOOK] revoked email failed:", err);
      });
      return complete({ received: true, revoked: true });
    }

    try {
      await applyIapStateToUser({ userId: owner.userId, state: refreshed });
    } catch (err: any) {
      if (err?.message === "IAP_TXN_OWNED_BY_ANOTHER_USER") {
        captureMessage(
          `[PLAYSTORE WEBHOOK] owner conflict for ${subNotif.purchaseToken.slice(0, 16)}...`,
          "warning",
        );
        return complete({ received: true, conflict: true });
      }
      throw err;
    }

    return complete({
      received: true,
      type: subNotif.notificationType,
    });
  } catch (error: any) {
    if (error?.message === "GOOGLE_TEST_PURCHASE_IN_PRODUCTION") {
      if (idempotencyId) {
        const markResult = await markWebhookEventProcessed(idempotencyId, "playstore");
        if (markResult === "duplicate") {
          return NextResponse.json({ received: true, duplicate: true });
        }
      }
      return NextResponse.json({ received: true, skipped: "test_purchase_production" });
    }
    captureException(error, { route: "/api/webhooks/playstore" });
    console.error("[PLAYSTORE WEBHOOK] error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
