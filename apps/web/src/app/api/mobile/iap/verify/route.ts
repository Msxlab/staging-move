/**
 * POST /api/mobile/iap/verify
 *
 * Called by the mobile client after StoreKit2 (iOS) or Play Billing (Android)
 * reports a successful purchase. Verifies the receipt against the official
 * store API and links the subscription to the authenticated user.
 *
 * Body:
 *   { platform: "ios",     transactionId: string, signedTransaction?: string }
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
      signedTransaction: z.string().min(20).max(20000).optional(),
    }),
    z.object({
      platform: z.literal("android"),
      purchaseToken: z.string().min(20).max(4000),
      productId: z.string().min(1).max(191),
    }),
  ])
  .superRefine((val, ctx) => {
    if (val.platform === "ios" && !val.transactionId && !val.signedTransaction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["signedTransaction"],
        message: "transactionId or signedTransaction is required",
      });
    }
  });

export async function POST(request: NextRequest) {
  try {
    // 30 requests / min per IP — verify is cheap for us but hits the store API.
    const rl = await rateLimit(getRateLimitKey(request, "iap-verify"), {
      limit: 30,
      windowSeconds: 60,
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many verification attempts" }, { status: 429 });
    }

    const userId = await requireDbUserId();

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

      if (parsed.data.signedTransaction) {
        // Locally verify the client-supplied JWS first — cryptographic proof
        // it came from Apple without needing an extra API call to resolve
        // the originalTransactionId.
        let jwsPayload: AppleTransactionPayload;
        try {
          jwsPayload = verifyAppleJws<AppleTransactionPayload>(parsed.data.signedTransaction);
        } catch (err) {
          console.warn("[IAP] apple JWS verify failed:", (err as Error).message);
          return NextResponse.json({ error: "INVALID_RECEIPT" }, { status: 400 });
        }
        originalTransactionId = jwsPayload.originalTransactionId;
      } else if (parsed.data.transactionId) {
        originalTransactionId = parsed.data.transactionId;
      }

      if (!originalTransactionId) {
        return NextResponse.json({ error: "INVALID_RECEIPT" }, { status: 400 });
      }

      normalized = await refreshAppleSubscriptionFor(originalTransactionId);
      if (!normalized) {
        return NextResponse.json({ error: "SUBSCRIPTION_NOT_FOUND" }, { status: 404 });
      }
    } else {
      normalized = await refreshGoogleSubscriptionFor(parsed.data.purchaseToken);
      if (!normalized) {
        return NextResponse.json({ error: "SUBSCRIPTION_NOT_FOUND" }, { status: 404 });
      }
    }

    let subscription;
    try {
      subscription = await applyIapStateToUser({ userId, state: normalized });
    } catch (err: any) {
      if (err?.message === "IAP_TXN_OWNED_BY_ANOTHER_USER") {
        return NextResponse.json({ error: "RECEIPT_OWNED_BY_ANOTHER_ACCOUNT" }, { status: 409 });
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
    captureException(error, { route: "/api/mobile/iap/verify" });
    console.error("[IAP verify] error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
