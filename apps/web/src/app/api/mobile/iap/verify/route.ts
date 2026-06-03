/**
 * POST /api/mobile/iap/verify
 *
 * Called by the mobile client after StoreKit2 (iOS) or Play Billing (Android)
 * reports a successful purchase. Verifies the receipt against the official
 * store API and links the subscription to the authenticated user.
 *
 * Body:
 *   { platform: "ios",     signedTransaction: string, transactionId?: string }
 *   { platform: "android", purchaseToken: string, productId: string }
 *
 * Returns: the unified entitlement snapshot (same shape as /api/profile).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { captureException } from "@/lib/sentry";
import {
  applyIapStateToUser,
  normalizeAppleTransactionPayload,
  refreshAppleSubscriptionFor,
  refreshGoogleSubscriptionFor,
  type NormalizedIapState,
} from "@/lib/iap-common";
import { verifyAppleJws, type AppleTransactionPayload } from "@/lib/iap-apple";
import { buildUnifiedEntitlementSnapshot } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .discriminatedUnion("platform", [
    z.object({
      platform: z.literal("ios"),
      transactionId: z.string().min(4).max(64).optional(),
      signedTransaction: z.string().min(20).max(20000),
    }),
    z.object({
      platform: z.literal("android"),
      purchaseToken: z.string().min(20).max(4000),
      productId: z.string().min(1).max(191),
    }),
  ]);

export async function POST(request: NextRequest) {
  try {
    // 30 requests / min per IP — verify is cheap for us but hits the store API.
    const userId = await requireDbUserId();
    const [ipRl, userRl] = await Promise.all([
      rateLimit(getRateLimitKey(request, "iap-verify"), {
        limit: 30,
        windowSeconds: 60,
        failClosed: true,
      }),
      rateLimit(`iap-verify:user:${userId}`, {
        limit: 10,
        windowSeconds: 60,
        failClosed: true,
      }),
    ]);
    if (!ipRl.success || !userRl.success) {
      return NextResponse.json({ error: "Too many verification attempts" }, { status: 429 });
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_BODY", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    let normalized: NormalizedIapState | null = null;

    if (parsed.data.platform === "ios") {
      let originalTransactionId = "";
      let jwsPayload: AppleTransactionPayload | null = null;

      if (parsed.data.signedTransaction) {
        // Locally verify the client-supplied JWS first — cryptographic proof
        // it came from Apple without needing an extra API call to resolve
        // the originalTransactionId.
        try {
          jwsPayload = verifyAppleJws<AppleTransactionPayload>(parsed.data.signedTransaction);
        } catch (err) {
          console.warn("[IAP] apple JWS verify failed:", (err as Error).message);
          return NextResponse.json({ error: "INVALID_RECEIPT" }, { status: 400 });
        }
        if (!jwsPayload) {
          return NextResponse.json({ error: "INVALID_RECEIPT" }, { status: 400 });
        }
        if (parsed.data.transactionId && parsed.data.transactionId !== jwsPayload.transactionId) {
          return NextResponse.json({ error: "INVALID_RECEIPT" }, { status: 400 });
        }
        originalTransactionId = jwsPayload.originalTransactionId;
      }

      if (!originalTransactionId) {
        return NextResponse.json({ error: "INVALID_RECEIPT" }, { status: 400 });
      }

      try {
        normalized = await refreshAppleSubscriptionFor(originalTransactionId);
      } catch (err) {
        if (!jwsPayload) throw err;
        console.warn(
          "[IAP] apple server lookup failed; accepting locally verified signed transaction:",
          (err as Error).message,
        );
        normalized = await normalizeAppleTransactionPayload(jwsPayload);
      }
      if (!normalized && jwsPayload) {
        console.warn("[IAP] apple server lookup returned no subscription; using signed transaction fallback");
        normalized = await normalizeAppleTransactionPayload(jwsPayload);
      }
      if (!normalized) {
        return NextResponse.json({ error: "SUBSCRIPTION_NOT_FOUND" }, { status: 404 });
      }
    } else {
      normalized = await refreshGoogleSubscriptionFor(parsed.data.purchaseToken);
      if (!normalized) {
        return NextResponse.json({ error: "SUBSCRIPTION_NOT_FOUND" }, { status: 404 });
      }
      if (normalized.productId !== parsed.data.productId) {
        return NextResponse.json({ error: "INVALID_RECEIPT" }, { status: 400 });
      }
    }

    let subscription;
    try {
      subscription = await applyIapStateToUser({ userId, state: normalized });
    } catch (err: any) {
      if (err?.message === "IAP_TXN_OWNED_BY_ANOTHER_USER") {
        return NextResponse.json({ error: "RECEIPT_OWNED_BY_ANOTHER_ACCOUNT" }, { status: 409 });
      }
      if (err?.message === "ACTIVE_SUBSCRIPTION_MANAGED_ELSEWHERE") {
        return NextResponse.json({ error: "ACTIVE_SUBSCRIPTION_MANAGED_ELSEWHERE" }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      entitlement: buildUnifiedEntitlementSnapshot(subscription),
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        provider: subscription.provider,
        platform: subscription.platform,
        currentPeriodEndsAt: subscription.currentPeriodEndsAt,
        gracePeriodEndsAt: subscription.gracePeriodEndsAt,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "APPLE_API_CREDS_MISSING" || error?.message === "GOOGLE_API_CREDS_MISSING") {
      return NextResponse.json({ error: "IAP_NOT_CONFIGURED" }, { status: 503 });
    }
    if (typeof error?.message === "string" && error.message.startsWith("GOOGLE_OAUTH_")) {
      return NextResponse.json({ error: "IAP_NOT_CONFIGURED" }, { status: 424 });
    }
    if (
      error?.message === "GOOGLE_API_TIMEOUT" ||
      (typeof error?.message === "string" && error.message.startsWith("GOOGLE_API_"))
    ) {
      return NextResponse.json({ error: "IAP_PROVIDER_UNAVAILABLE" }, { status: 424 });
    }
    if (error?.message === "APPLE_JWS_BUNDLE_MISMATCH") {
      return NextResponse.json({ error: "INVALID_RECEIPT" }, { status: 400 });
    }
    if (typeof error?.message === "string" && error.message.startsWith("GOOGLE_ACK_")) {
      return NextResponse.json({ error: "IAP_ACKNOWLEDGEMENT_FAILED" }, { status: 503 });
    }
    if (error?.message === "GOOGLE_TEST_PURCHASE_IN_PRODUCTION") {
      return NextResponse.json({ error: "TEST_PURCHASE_NOT_ALLOWED" }, { status: 400 });
    }
    if (error?.name === "BILLING_CONFIG_ERROR") {
      return NextResponse.json({ error: "IAP_NOT_CONFIGURED" }, { status: 503 });
    }
    captureException(error, { route: "/api/mobile/iap/verify" });
    console.error("[IAP verify] error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
