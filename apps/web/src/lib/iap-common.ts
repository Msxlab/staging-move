/**
 * Cross-platform (Apple + Google) IAP normalization + DB writer.
 *
 * Converts verified subscription state from either store into the
 * Subscription row shape, preserving the user↔originalTransactionId
 * binding to prevent receipt sharing across accounts.
 */

import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import {
  getAppleSubscriptionStatus,
  mapAppleStatus,
  type AppleSubscriptionStatusResult,
} from "@/lib/iap-apple";
import {
  getGoogleSubscription,
  acknowledgeGoogleSubscription,
  mapGoogleSubscriptionState,
  type GoogleSubscriptionResult,
} from "@/lib/iap-google";
import type { BillingPlan, SubscriptionStatus } from "@/lib/shared-billing";
import { isBillingProductionLike } from "@/lib/billing-config";

export type IapPlatform = "ios" | "android";
export type IapBillingInterval = "MONTH" | "YEAR";

export interface NormalizedIapState {
  platform: IapPlatform;
  plan: BillingPlan;
  status: SubscriptionStatus;
  provider: "APP_STORE" | "PLAY_STORE";
  productId: string;
  billingInterval: IapBillingInterval | null;
  originalTransactionId: string;
  latestTransactionId: string | null;
  purchaseToken: string | null;
  expiresAt: Date | null;
  gracePeriodEndsAt: Date | null;
  environment: string | null;
  raw: unknown;
}

export interface MobilePlanResolution {
  plan: BillingPlan;
  billingInterval: IapBillingInterval | null;
}

/**
 * Resolve a store productId to our internal plan + billing interval.
 *
 * The runtime-config keys are the trust anchor — the frontend never sees them
 * and an attacker can't smuggle an arbitrary SKU into the verify endpoint
 * because anything that doesn't match a configured key returns null and the
 * verify route 404s.
 */
export async function mapProductIdToPlan(
  platform: IapPlatform,
  productId: string,
): Promise<MobilePlanResolution | null> {
  const monthlyKey = platform === "ios"
    ? "MOBILE_IOS_PRODUCT_INDIVIDUAL"
    : "MOBILE_ANDROID_PRODUCT_INDIVIDUAL";
  const yearlyKey = platform === "ios"
    ? "MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY"
    : "MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY";

  const [monthlyId, yearlyId] = await Promise.all([
    getRuntimeConfigValue(monthlyKey),
    getRuntimeConfigValue(yearlyKey),
  ]);

  if (monthlyId && productId === monthlyId) {
    return { plan: "INDIVIDUAL", billingInterval: "MONTH" };
  }
  if (yearlyId && productId === yearlyId) {
    return { plan: "INDIVIDUAL", billingInterval: "YEAR" };
  }
  return null;
}

export async function normalizeAppleResult(
  result: AppleSubscriptionStatusResult,
): Promise<NormalizedIapState | null> {
  const resolved = await mapProductIdToPlan("ios", result.transaction.productId);
  if (!resolved) return null;

  const expiresAt = result.transaction.expiresDate
    ? new Date(result.transaction.expiresDate)
    : null;
  const gracePeriodEndsAt = result.renewal?.gracePeriodExpiresDate
    ? new Date(result.renewal.gracePeriodExpiresDate)
    : null;

  const now = Date.now();
  let status: SubscriptionStatus = mapAppleStatus(result.rawStatus) as SubscriptionStatus;
  if (status === "ACTIVE" && expiresAt && expiresAt.getTime() < now) {
    // Clock skew or stale API response — downgrade defensively.
    status = "EXPIRED";
  }
  if (result.transaction.revocationDate) {
    status = "CANCELED";
  }

  return {
    platform: "ios",
    plan: resolved.plan,
    status,
    provider: "APP_STORE",
    productId: result.transaction.productId,
    billingInterval: resolved.billingInterval,
    originalTransactionId: result.transaction.originalTransactionId,
    latestTransactionId: result.transaction.transactionId,
    purchaseToken: null,
    expiresAt,
    gracePeriodEndsAt,
    environment: result.environment,
    raw: { transaction: result.transaction, renewal: result.renewal, rawStatus: result.rawStatus },
  };
}

export async function normalizeGoogleResult(
  result: GoogleSubscriptionResult,
): Promise<NormalizedIapState | null> {
  if (result.response.testPurchase && isBillingProductionLike()) {
    throw new Error("GOOGLE_TEST_PURCHASE_IN_PRODUCTION");
  }

  const lineItem = result.response.lineItems?.[0];
  if (!lineItem?.productId) return null;

  const resolved = await mapProductIdToPlan("android", lineItem.productId);
  if (!resolved) return null;

  const expiresAt = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
  const status = mapGoogleSubscriptionState(result.response.subscriptionState) as SubscriptionStatus;

  return {
    platform: "android",
    plan: resolved.plan,
    status,
    provider: "PLAY_STORE",
    productId: lineItem.productId,
    billingInterval: resolved.billingInterval,
    originalTransactionId: result.response.latestOrderId || result.purchaseToken,
    latestTransactionId: result.response.latestOrderId || null,
    purchaseToken: result.purchaseToken,
    expiresAt,
    gracePeriodEndsAt: null,
    environment: result.response.testPurchase ? "Sandbox" : "Production",
    raw: result.response,
  };
}

/**
 * Attach a verified IAP state to a user's Subscription row.
 *
 * Race-safe: uses a compare-and-update on the unique `originalTransactionId`
 * to prevent two accounts from claiming the same receipt.
 * Returns the persisted Subscription.
 */
export async function applyIapStateToUser(opts: {
  userId: string;
  state: NormalizedIapState;
}) {
  const { userId, state } = opts;

  // Guard: if another user already owns this originalTransactionId, refuse.
  const existingByTxn = state.originalTransactionId
    ? await prisma.subscription.findUnique({
        where: { originalTransactionId: state.originalTransactionId },
      })
    : null;

  if (existingByTxn && existingByTxn.userId !== userId) {
    throw new Error("IAP_TXN_OWNED_BY_ANOTHER_USER");
  }

  const now = new Date();
  // accessType is "PAID" once a real store transaction has cleared. Trial
  // status comes from the store's own status field — Apple sets status=4
  // (TRIALING via mapAppleStatus) during an introductory offer; Google sets
  // subscriptionState=SUBSCRIPTION_STATE_IN_GRACE_PERIOD or _ON_HOLD for
  // billing retry. The unified entitlement resolver reads `status` directly,
  // so writing a static accessType=PAID here is correct: a TRIALING status
  // overrides the access banner via deriveUserSubscriptionState.
  const data = {
    plan: state.plan,
    status: state.status,
    provider: state.provider,
    platform: state.platform,
    accessType: state.status === "TRIALING" ? "FREE_TRIAL" : "PAID",
    billingInterval: state.billingInterval,
    billingProductId: state.productId,
    originalTransactionId: state.originalTransactionId,
    latestTransactionId: state.latestTransactionId,
    purchaseToken: state.purchaseToken,
    currentPeriodEndsAt: state.expiresAt,
    trialEndsAt: state.status === "TRIALING" ? state.expiresAt : null,
    gracePeriodEndsAt: state.gracePeriodEndsAt,
    appStoreEnvironment: state.environment,
    lastValidatedAt: now,
    lastSyncedAt: now,
  } as const;

  try {
    return await prisma.subscription.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  } catch (error: any) {
    if (
      error?.code === "P2002" &&
      Array.isArray(error?.meta?.target) &&
      error.meta.target.includes("originalTransactionId")
    ) {
      throw new Error("IAP_TXN_OWNED_BY_ANOTHER_USER");
    }
    throw error;
  }
}

/**
 * Find a user by the IAP identifier alone (for webhook flows where
 * no authenticated session is present).
 */
export async function findUserByIapIdentifier(opts: {
  originalTransactionId?: string;
  purchaseToken?: string;
}): Promise<{ id: string; userId: string } | null> {
  if (opts.originalTransactionId) {
    const row = await prisma.subscription.findUnique({
      where: { originalTransactionId: opts.originalTransactionId },
      select: { id: true, userId: true },
    });
    if (row) return row;
  }
  if (opts.purchaseToken) {
    const row = await prisma.subscription.findFirst({
      where: { purchaseToken: opts.purchaseToken },
      select: { id: true, userId: true },
    });
    if (row) return row;
  }
  return null;
}

export async function refreshAppleSubscriptionFor(originalTransactionId: string) {
  const result = await getAppleSubscriptionStatus(originalTransactionId);
  if (!result) return null;
  return normalizeAppleResult(result);
}

export async function refreshGoogleSubscriptionFor(purchaseToken: string) {
  const result = await getGoogleSubscription(purchaseToken);
  if (!result) return null;
  const normalized = await normalizeGoogleResult(result);

  if (
    normalized &&
    normalized.status === "ACTIVE" &&
    result.response.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING"
  ) {
    // Best-effort ack; do not fail the flow if Google rejects.
    await acknowledgeGoogleSubscription({
      purchaseToken,
      productId: normalized.productId,
    }).catch((err) => {
      console.error("[IAP] google ack failed:", err);
    });
  }

  return normalized;
}
