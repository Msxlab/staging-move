/**
 * Cross-platform (Apple + Google) IAP normalization + DB writer.
 *
 * Converts verified subscription state from either store into the
 * Subscription row shape, preserving the user↔originalTransactionId
 * binding to prevent receipt sharing across accounts.
 */

import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";
import { classifyIapAccountToken } from "@locateflow/shared";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { reconcileSeatsForOwner } from "@/lib/workspace-ownership";
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
import {
  sendPaymentFailedEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCanceledEmail,
} from "@/lib/email-service";
import { sendAdminPurchaseAlert } from "@/lib/admin-alerts";
import type { BillingPlan, SubscriptionStatus } from "@/lib/shared-billing";
import {
  formatPlanLabel,
  formatDateForEmail,
  fireAndLogEmail as fireAndLogBillingEmail,
} from "@/lib/billing-email-utils";
import { isDeployedBillingEnvironment } from "@/lib/billing-config";
import {
  isMissingDbColumnError,
  warnSchemaCompatibilityFallback,
} from "@/lib/db-schema-compat";
import { decrypt, encrypt } from "@/lib/shared-encryption";

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
  /**
   * Receipt↔account binding token carried by the verified receipt (audit fix
   * 1.1). Apple: `appAccountToken` from the verified JWS transaction. Google:
   * `externalAccountIdentifiers.obfuscatedExternalAccountId` from the v2
   * subscription purchase. `null` for legacy receipts / older clients that did
   * not attach one — those MUST still grant (see applyIapStateToUser).
   */
  boundAccountToken: string | null;
  raw: unknown;
}

export interface MobilePlanResolution {
  plan: BillingPlan;
  billingInterval: IapBillingInterval | null;
}

const IAP_ACTIVE_STATUSES = new Set<SubscriptionStatus>(["ACTIVE", "TRIALING"]);
const IAP_PURCHASE_BLOCKING_STATUSES = new Set<SubscriptionStatus>([
  "ACTIVE",
  "TRIALING",
  "CANCEL_AT_PERIOD_END",
  "GRACE_PERIOD",
  "PAST_DUE",
  "PENDING_VALIDATION",
]);
const IAP_MANAGED_PROVIDERS = new Set(["STRIPE", "APP_STORE", "PLAY_STORE"]);
const IAP_CANCELED_STATUSES = new Set<SubscriptionStatus>([
  "CANCEL_AT_PERIOD_END",
  "TRIAL_CANCELED",
  "CANCELED",
  "EXPIRED",
  "REFUNDED",
]);
const IAP_PAYMENT_ATTENTION_STATUSES = new Set<SubscriptionStatus>([
  "PAST_DUE",
  "GRACE_PERIOD",
  "UNPAID",
]);

/**
 * Feature flag gating receipt↔account binding ENFORCEMENT (audit fix 1.1 —
 * mobile-iap-billing-01 / mobile-iap-purchase-01). DEFAULT OFF.
 *
 * Rollout safety: this is a HIGH-RISK BILLING change. The mobile clients that
 * attach the per-user account token must be in the field BEFORE an operator
 * flips this flag — otherwise legacy/in-flight receipts (which carry no token)
 * would be unaffected anyway, but a too-early flip buys no protection and adds
 * risk. When OFF, behavior is UNCHANGED: a token mismatch is logged (best
 * effort) but still grants to the resolving owner. When ON, a receipt that
 * CARRIES a token NOT matching the authed user is rejected. A token-LESS
 * receipt ALWAYS grants, flag on or off — never rejected.
 */
export const IAP_RECEIPT_BINDING_ENFORCE_FLAG = "iap_receipt_binding_enforce";

/**
 * Decide whether a verified receipt's carried account token blocks the grant
 * for `userId`. Throws IAP_RECEIPT_ACCOUNT_MISMATCH only when ALL hold:
 *   1. the receipt carries a token,
 *   2. that token does NOT match the token derived from the authed userId, AND
 *   3. the enforcement flag is enabled.
 * A token-less receipt (classify -> "absent") returns without throwing under
 * every flag state, so legacy receipts and older clients are never rejected.
 */
async function assertReceiptAccountBinding(userId: string, state: NormalizedIapState): Promise<void> {
  const classification = classifyIapAccountToken({
    userId,
    receiptToken: state.boundAccountToken,
  });
  if (classification !== "mismatch") return; // "absent" | "match" → never block.

  const enforce = await isFeatureEnabled(IAP_RECEIPT_BINDING_ENFORCE_FLAG, { userId });
  if (!enforce) {
    // Rollout-safety window: flag OFF → DO NOT block. Surface for telemetry so
    // operators can size the mismatch rate before flipping the flag on.
    console.warn(
      `[IAP] receipt account-token mismatch (enforcement OFF, granting) provider=${state.provider} userId=${userId}`,
    );
    return;
  }
  throw new Error("IAP_RECEIPT_ACCOUNT_MISMATCH");
}

export function hashPurchaseToken(purchaseToken: string | null | undefined): string | null {
  const normalized = purchaseToken?.trim();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

function isPurchaseTokenHashCompatError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || "");
  return (
    isMissingDbColumnError(error, "purchaseTokenHash") ||
    message.includes("Unknown argument `purchaseTokenHash`") ||
    message.includes("Unknown arg `purchaseTokenHash`")
  );
}

function withoutPurchaseTokenHash<T extends { purchaseTokenHash?: unknown }>(data: T) {
  const { purchaseTokenHash: _purchaseTokenHash, ...legacyData } = data;
  return legacyData;
}

function isPurchaseTokenEncryptedCompatError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || "");
  return (
    isMissingDbColumnError(error, "purchaseTokenEncrypted") ||
    message.includes("Unknown argument `purchaseTokenEncrypted`") ||
    message.includes("Unknown arg `purchaseTokenEncrypted`")
  );
}

function withoutPurchaseTokenEncrypted<T extends { purchaseTokenEncrypted?: unknown }>(data: T) {
  const { purchaseTokenEncrypted: _purchaseTokenEncrypted, ...legacyData } = data;
  return legacyData;
}

function encryptPurchaseTokenForStorage(purchaseToken: string | null | undefined): string | null {
  const normalized = purchaseToken?.trim();
  return normalized ? encrypt(normalized) : null;
}

export function decryptStoredPurchaseToken(subscription: {
  purchaseToken?: string | null;
  purchaseTokenEncrypted?: string | null;
}): string | null {
  if (subscription.purchaseTokenEncrypted) return decrypt(subscription.purchaseTokenEncrypted);
  return subscription.purchaseToken ? decrypt(subscription.purchaseToken) : null;
}

export function hasStoredPurchaseToken(subscription: {
  purchaseToken?: string | null;
  purchaseTokenEncrypted?: string | null;
}): boolean {
  return Boolean(subscription.purchaseTokenEncrypted || subscription.purchaseToken);
}

async function findSubscriptionByPurchaseTokenIdentifiers(
  purchaseTokenHash: string | null,
  purchaseToken: string | null,
): Promise<{ id: string; userId: string } | null> {
  if (!purchaseTokenHash && !purchaseToken) return null;

  if (purchaseTokenHash) {
    try {
      return await (prisma.subscription as any).findFirst({
        where: {
          OR: [
            { purchaseTokenHash },
            ...(purchaseToken ? [{ purchaseToken }] : []),
          ],
        },
        select: { id: true, userId: true },
      });
    } catch (error) {
      if (!isPurchaseTokenHashCompatError(error)) throw error;
      warnSchemaCompatibilityFallback("iap:purchase-token-hash-read", error);
    }
  }

  if (!purchaseToken) return null;
  return prisma.subscription.findFirst({
    where: { purchaseToken },
    select: { id: true, userId: true },
  });
}

function fireAndLogIapEmail(promise: Promise<unknown>, context: string) {
  fireAndLogBillingEmail(promise, context, { logPrefix: "[IAP]" });
}

async function sendIapLifecycleEmail(opts: {
  userId: string;
  subscriptionId: string;
  state: NormalizedIapState;
  previousStatus: SubscriptionStatus | string | null | undefined;
}) {
  const previousStatus = opts.previousStatus as SubscriptionStatus | null | undefined;
  if (previousStatus === opts.state.status) return;

  // Soft-deleted users are hidden by the prisma soft-delete extension,
  // so a deleted account returns null from findUnique. The `!user`
  // guard covers both unknown-id and soft-deleted cases.
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { email: true, firstName: true, preferredLocale: true },
  });
  if (!user?.email) return;

  const dedupeBase = `iap:${opts.state.provider}:${opts.state.originalTransactionId}:${opts.state.latestTransactionId || opts.state.productId}:${opts.state.status}`;
  const metadata = {
    userId: opts.userId,
    subscriptionId: opts.subscriptionId,
    provider: opts.state.provider,
    platform: opts.state.platform,
    oldStatus: previousStatus || null,
    newStatus: opts.state.status,
  };
  const currentIsActive = IAP_ACTIVE_STATUSES.has(opts.state.status);
  const previousWasActive = previousStatus ? IAP_ACTIVE_STATUSES.has(previousStatus) : false;

  if (currentIsActive && !previousWasActive) {
    fireAndLogIapEmail(
      sendSubscriptionActivatedEmail({
        userEmail: user.email,
        userName: user.firstName || "there",
        planLabel: formatPlanLabel(opts.state.plan),
        locale: user.preferredLocale,
        dedupeKey: `${dedupeBase}:activated`,
        metadata,
      }),
      `activated userId=${opts.userId}`,
    );
    // Owner alert: first activation only — renewals keep the same ACTIVE
    // status and return earlier (previousStatus === status), and any other
    // active→active transition is excluded by the previousWasActive check
    // above. Deduped on the same IAP base; the helper never throws and
    // suppresses the allowlisted QA account internally.
    fireAndLogIapEmail(
      sendAdminPurchaseAlert({
        userId: opts.userId,
        email: user.email,
        plan: opts.state.plan,
        interval: opts.state.billingInterval,
        provider: opts.state.platform === "ios" ? "apple" : "google",
        dedupeKey: dedupeBase,
      }),
      `admin-purchase-alert userId=${opts.userId}`,
    );
    return;
  }

  if (IAP_CANCELED_STATUSES.has(opts.state.status)) {
    fireAndLogIapEmail(
      sendSubscriptionCanceledEmail({
        userEmail: user.email,
        userName: user.firstName || "there",
        planLabel: formatPlanLabel(opts.state.plan),
        accessEndsOn: formatDateForEmail(opts.state.expiresAt, user.preferredLocale),
        locale: user.preferredLocale,
        dedupeKey: `${dedupeBase}:canceled`,
        metadata,
      }),
      `canceled userId=${opts.userId}`,
    );
    return;
  }

  if (IAP_PAYMENT_ATTENTION_STATUSES.has(opts.state.status)) {
    fireAndLogIapEmail(
      sendPaymentFailedEmail({
        userEmail: user.email,
        userName: user.firstName || "there",
        nextAttemptOn: formatDateForEmail(opts.state.gracePeriodEndsAt || opts.state.expiresAt, user.preferredLocale),
        locale: user.preferredLocale,
        dedupeKey: `${dedupeBase}:payment-attention`,
        metadata,
      }),
      `payment-attention userId=${opts.userId}`,
    );
  }
}

export async function sendIapCancellationNotice(opts: {
  userId: string;
  provider: NormalizedIapState["provider"];
  platform: IapPlatform;
  dedupeKey: string;
}) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: opts.userId },
    select: {
      id: true,
      plan: true,
      currentPeriodEndsAt: true,
      user: { select: { email: true, firstName: true, preferredLocale: true, deletedAt: true } },
    },
  });
  if (!subscription?.user?.email || subscription.user.deletedAt) return;

  fireAndLogIapEmail(
    sendSubscriptionCanceledEmail({
      userEmail: subscription.user.email,
      userName: subscription.user.firstName || "there",
      planLabel: formatPlanLabel(subscription.plan),
      accessEndsOn: formatDateForEmail(subscription.currentPeriodEndsAt, subscription.user.preferredLocale),
      locale: subscription.user.preferredLocale,
      dedupeKey: opts.dedupeKey,
      metadata: {
        userId: opts.userId,
        subscriptionId: subscription.id,
        provider: opts.provider,
        platform: opts.platform,
        newStatus: "CANCELED",
      },
    }),
    `manual-canceled userId=${opts.userId}`,
  );
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
  const prefix = platform === "ios" ? "MOBILE_IOS_PRODUCT" : "MOBILE_ANDROID_PRODUCT";
  const candidates: Array<{
    plan: BillingPlan;
    billingInterval: IapBillingInterval;
    key: string;
  }> = [
    { plan: "INDIVIDUAL", billingInterval: "MONTH", key: `${prefix}_INDIVIDUAL` },
    { plan: "INDIVIDUAL", billingInterval: "YEAR", key: `${prefix}_INDIVIDUAL_YEARLY` },
    { plan: "FAMILY", billingInterval: "MONTH", key: `${prefix}_FAMILY` },
    { plan: "FAMILY", billingInterval: "YEAR", key: `${prefix}_FAMILY_YEARLY` },
    { plan: "PRO", billingInterval: "MONTH", key: `${prefix}_PRO` },
    { plan: "PRO", billingInterval: "YEAR", key: `${prefix}_PRO_YEARLY` },
  ];

  const productIds = await Promise.all(
    candidates.map(async (candidate) => ({
      ...candidate,
      productId: await getRuntimeConfigValue(candidate.key),
    })),
  );

  for (const candidate of productIds) {
    if (candidate.productId && productId === candidate.productId) {
      return { plan: candidate.plan, billingInterval: candidate.billingInterval };
    }
  }
  return null;
}

/**
 * Finding 4.2: reject Apple Family Sharing recipients. A subscription shared via
 * Family Sharing reports inAppOwnershipType "FAMILY_SHARED" on the recipient's
 * transaction (the purchaser sees "PURCHASED"). Granting an entitlement on a
 * FAMILY_SHARED transaction would let any family member's device claim premium
 * on their own LocateFlow account off a single purchase. Only "PURCHASED" (and
 * a missing field, for forward-compat with older payloads) grants. Decline
 * (return null) otherwise so the verify route does not grant.
 */
function isAppleOwnershipGranted(inAppOwnershipType: string | null | undefined): boolean {
  return !inAppOwnershipType || inAppOwnershipType === "PURCHASED";
}

export async function normalizeAppleResult(
  result: AppleSubscriptionStatusResult,
): Promise<NormalizedIapState | null> {
  if (!isAppleOwnershipGranted(result.transaction.inAppOwnershipType)) return null;

  const resolved = await mapProductIdToPlan("ios", result.transaction.productId);
  if (!resolved) return null;

  const expiresAt = result.transaction.expiresDate
    ? new Date(result.transaction.expiresDate)
    : null;
  let gracePeriodEndsAt = result.renewal?.gracePeriodExpiresDate
    ? new Date(result.renewal.gracePeriodExpiresDate)
    : null;

  const now = Date.now();
  let status: SubscriptionStatus = mapAppleStatus(result.rawStatus) as SubscriptionStatus;
  if (
    status === "ACTIVE" &&
    result.transaction.offerDiscountType === "FREE_TRIAL" &&
    expiresAt &&
    expiresAt.getTime() > now
  ) {
    status = "TRIALING";
  }
  if (status === "ACTIVE" && expiresAt && expiresAt.getTime() < now) {
    // Clock skew or stale API response — downgrade defensively.
    status = "EXPIRED";
  }
  if (status === "ACTIVE" && result.renewal?.autoRenewStatus === 0 && expiresAt && expiresAt.getTime() > now) {
    status = "CANCEL_AT_PERIOD_END";
  }
  if (result.transaction.revocationDate) {
    status = "REFUNDED";
  }

  // Apple billing-retry (rawStatus 3 → PAST_DUE) means the renewal card was
  // declined but the user has NOT canceled and Apple keeps retrying. Without a
  // grace window the entitlement resolver revokes access instantly, while an
  // equivalent Stripe/web subscriber keeps access for 7 days (dunning grace).
  // Give iOS the same 7-day courtesy grace, anchored to the period end, when
  // Apple itself did not provide one.
  if (status === "PAST_DUE" && !gracePeriodEndsAt) {
    const graceAnchor = expiresAt ?? new Date(now);
    gracePeriodEndsAt = new Date(graceAnchor.getTime() + 7 * 24 * 60 * 60 * 1000);
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
    boundAccountToken: result.transaction.appAccountToken ?? null,
    raw: { transaction: result.transaction, renewal: result.renewal, rawStatus: result.rawStatus },
  };
}

export async function normalizeAppleTransactionPayload(
  transaction: AppleSubscriptionStatusResult["transaction"],
): Promise<NormalizedIapState | null> {
  const expectedBundleId = await getRuntimeConfigValue("APPLE_BUNDLE_ID");
  if (!expectedBundleId) {
    throw new Error("APPLE_API_CREDS_MISSING");
  }
  if (transaction.bundleId !== expectedBundleId) {
    throw new Error("APPLE_JWS_BUNDLE_MISMATCH");
  }

  // Finding 4.2: decline Family Sharing recipients (see normalizeAppleResult).
  if (!isAppleOwnershipGranted(transaction.inAppOwnershipType)) return null;

  const resolved = await mapProductIdToPlan("ios", transaction.productId);
  if (!resolved) return null;

  const expiresAt = transaction.expiresDate ? new Date(transaction.expiresDate) : null;
  const now = Date.now();
  let status: SubscriptionStatus = "ACTIVE";

  if (transaction.revocationDate) {
    status = "REFUNDED";
  } else if (expiresAt && expiresAt.getTime() < now) {
    status = "EXPIRED";
  } else if (transaction.offerDiscountType === "FREE_TRIAL") {
    status = "TRIALING";
  }

  return {
    platform: "ios",
    plan: resolved.plan,
    status,
    provider: "APP_STORE",
    productId: transaction.productId,
    billingInterval: resolved.billingInterval,
    originalTransactionId: transaction.originalTransactionId,
    latestTransactionId: transaction.transactionId,
    purchaseToken: null,
    expiresAt,
    gracePeriodEndsAt: null,
    environment: transaction.environment,
    boundAccountToken: transaction.appAccountToken ?? null,
    raw: { transaction, source: "signedTransactionFallback" },
  };
}

export async function normalizeGoogleResult(
  result: GoogleSubscriptionResult,
): Promise<NormalizedIapState | null> {
  const lineItem = result.response.lineItems?.[0];
  if (!lineItem?.productId) return null;

  const resolved = await mapProductIdToPlan("android", lineItem.productId);
  if (!resolved) return null;

  const expiresAt = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
  const status = mapGoogleSubscriptionState(result.response.subscriptionState) as SubscriptionStatus;

  // Google grace ("in billing retry") and on-hold customers HAVE paid and
  // Google requires they retain access during the grace window. The entitlement
  // resolver gates GRACE_PERIOD/PAST_DUE access on `gracePeriodEndsAt`, so a
  // null here would lock a paying customer out the instant the renewal card
  // declines. Anchor the grace window to the store-reported expiry (or +7 days
  // when Google does not report one) — symmetric with the Apple PAST_DUE
  // backstop in normalizeAppleResult.
  let gracePeriodEndsAt: Date | null = null;
  if (status === "GRACE_PERIOD" || status === "PAST_DUE") {
    const graceAnchor = expiresAt ?? new Date();
    gracePeriodEndsAt = new Date(graceAnchor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

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
    gracePeriodEndsAt,
    environment: result.response.testPurchase ? "Sandbox" : "Production",
    boundAccountToken:
      result.response.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    raw: result.response,
  };
}

function parseEmailAllowlist(value: string | null | undefined): Set<string> {
  return new Set(
    (value || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isGooglePlayTestPurchaseState(state: NormalizedIapState): boolean {
  return (
    state.provider === "PLAY_STORE" &&
    state.environment === "Sandbox" &&
    typeof state.raw === "object" &&
    state.raw !== null &&
    "testPurchase" in state.raw
  );
}

async function assertGooglePlayTestPurchaseAllowedForUser(userId: string, state: NormalizedIapState) {
  // Audit 4.4: gate on the unified deployed-environment predicate so staging and
  // preview enforce the test-purchase allowlist like production (previously they
  // skipped the gate because `isBillingProductionLike` is false off-prod).
  if (!isGooglePlayTestPurchaseState(state) || !isDeployedBillingEnvironment()) return;

  const [user, qaEmail, extraEmails] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
    getRuntimeConfigValue("QA_RESETTABLE_ACCOUNT_EMAIL"),
    getRuntimeConfigValue("GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS"),
  ]);
  const allowedEmails = parseEmailAllowlist(extraEmails);
  if (qaEmail) allowedEmails.add(qaEmail.trim().toLowerCase());

  const userEmail = user?.email?.trim().toLowerCase();
  if (!userEmail || !allowedEmails.has(userEmail)) {
    throw new Error("GOOGLE_TEST_PURCHASE_IN_PRODUCTION");
  }
}

function isAppleSandboxPurchaseState(state: NormalizedIapState): boolean {
  return state.provider === "APP_STORE" && state.environment === "Sandbox";
}

/**
 * Apple sandbox receipts (TestFlight / App Review / a tester's sandbox Apple
 * ID) must not grant production entitlements to arbitrary users. Apple's App
 * Review uses sandbox, so we can't reject sandbox outright — instead we mirror
 * the Google test-purchase gate: in a production-like billing environment, only
 * allowlisted QA/review emails may claim a sandbox subscription. Everyone else
 * is refused, closing the "buy a $0 sandbox sub in TestFlight → real premium"
 * hole that previously existed only on the Apple side (Google already had this).
 */
async function assertAppleSandboxPurchaseAllowedForUser(userId: string, state: NormalizedIapState) {
  // Audit 4.4: gate on the unified deployed-environment predicate so staging and
  // preview enforce the sandbox allowlist like production (previously they
  // skipped the gate because `isBillingProductionLike` is false off-prod).
  if (!isAppleSandboxPurchaseState(state) || !isDeployedBillingEnvironment()) return;

  const [user, qaEmail, extraEmails] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
    getRuntimeConfigValue("QA_RESETTABLE_ACCOUNT_EMAIL"),
    getRuntimeConfigValue("APPLE_SANDBOX_PURCHASE_USER_EMAILS"),
  ]);
  const allowedEmails = parseEmailAllowlist(extraEmails);
  if (qaEmail) allowedEmails.add(qaEmail.trim().toLowerCase());

  const userEmail = user?.email?.trim().toLowerCase();
  if (!userEmail || !allowedEmails.has(userEmail)) {
    throw new Error("APPLE_SANDBOX_PURCHASE_IN_PRODUCTION");
  }
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
  const purchaseTokenHash = hashPurchaseToken(state.purchaseToken);
  const purchaseTokenEncrypted = encryptPurchaseTokenForStorage(state.purchaseToken);

  // Guard: if another user already owns this originalTransactionId, refuse.
  const existingByTxn = state.originalTransactionId
    ? await prisma.subscription.findUnique({
        where: { originalTransactionId: state.originalTransactionId },
      })
    : null;

  if (existingByTxn && existingByTxn.userId !== userId) {
    throw new Error("IAP_TXN_OWNED_BY_ANOTHER_USER");
  }
  const existingByPurchaseToken = await findSubscriptionByPurchaseTokenIdentifiers(
    purchaseTokenHash,
    state.purchaseToken,
  );
  if (existingByPurchaseToken && existingByPurchaseToken.userId !== userId) {
    throw new Error("IAP_TXN_OWNED_BY_ANOTHER_USER");
  }

  const existingByUser = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      provider: true,
      accessType: true,
      originalTransactionId: true,
      stripeSubscriptionId: true,
    },
  });

  const existingProvider = existingByUser?.provider || null;
  const existingStatus = existingByUser?.status as SubscriptionStatus | null | undefined;
  const existingBlocksNewPurchase =
    Boolean(existingByUser) &&
    existingByUser?.accessType !== "FREE_ACCESS" &&
    IAP_MANAGED_PROVIDERS.has(String(existingProvider)) &&
    Boolean(existingStatus && IAP_PURCHASE_BLOCKING_STATUSES.has(existingStatus));
  if (existingBlocksNewPurchase && existingProvider !== state.provider) {
    throw new Error("ACTIVE_SUBSCRIPTION_MANAGED_ELSEWHERE");
  }
  await assertGooglePlayTestPurchaseAllowedForUser(userId, state);
  await assertAppleSandboxPurchaseAllowedForUser(userId, state);
  // Receipt↔account binding (audit fix 1.1). Flag-gated, default OFF; token-less
  // receipts are never rejected. Runs before any write so a mismatch grants
  // nothing.
  await assertReceiptAccountBinding(userId, state);

  const now = new Date();
  // accessType is "PAID" once a real store transaction has cleared. Trial and
  // billing-retry status comes from the store-specific normalized status; the
  // unified entitlement resolver reads `status` directly, so a TRIALING status
  // overrides the access banner via deriveUserSubscriptionState.
  const data: any = {
    plan: state.plan,
    status: state.status,
    provider: state.provider,
    platform: state.platform,
    accessType: state.status === "TRIALING" ? "FREE_TRIAL" : "PAID",
    billingInterval: state.billingInterval,
    billingProductId: state.productId,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    stripeCurrentPeriodEnd: null,
    originalTransactionId: state.originalTransactionId,
    latestTransactionId: state.latestTransactionId,
    purchaseToken: null,
    purchaseTokenEncrypted,
    purchaseTokenHash,
    currentPeriodEndsAt: state.expiresAt,
    trialEndsAt: state.status === "TRIALING" ? state.expiresAt : null,
    gracePeriodEndsAt: state.gracePeriodEndsAt,
    appStoreEnvironment: state.environment,
    cancelAtPeriodEnd: state.status === "CANCEL_AT_PERIOD_END",
    autoRenew: !IAP_CANCELED_STATUSES.has(state.status),
    canceledAt: IAP_CANCELED_STATUSES.has(state.status) ? now : null,
    // A real store purchase takes over the single per-user subscription row.
    // Clear any admin-grant / free-access remnants so the row can't end up
    // both provider=APP_STORE/PLAY_STORE AND still carrying premiumGrantedBy /
    // premiumUntil / freeAccessEndsAt from a prior admin comp (a contradictory
    // row the entitlement resolver and MRR accounting would misread).
    premiumGrantedBy: null,
    premiumUntil: null,
    premiumGrantedAt: null,
    premiumNote: null,
    freeAccessEndsAt: null,
    lastValidatedAt: now,
    lastSyncedAt: now,
  };

  try {
    const subscription = await prisma.subscription.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    // A store plan change/expiry shifts this owner's seat limit — reconcile any
    // workspaces they own so over-limit members are demoted (best-effort).
    await reconcileSeatsForOwner(userId).catch(() => {});
    await sendIapLifecycleEmail({
      userId,
      subscriptionId: subscription.id,
      state,
      previousStatus: existingByUser?.status,
    }).catch((err) => {
      console.error("[IAP] lifecycle email lookup failed:", err);
    });
    return subscription;
  } catch (error: any) {
    if (
      error?.code === "P2002" &&
      Array.isArray(error?.meta?.target) &&
      (error.meta.target.includes("originalTransactionId") ||
        error.meta.target.includes("purchaseTokenHash"))
    ) {
      throw new Error("IAP_TXN_OWNED_BY_ANOTHER_USER");
    }
    if (isPurchaseTokenHashCompatError(error)) {
      warnSchemaCompatibilityFallback("iap:purchase-token-hash-write", error);
      const legacyData = withoutPurchaseTokenHash(data);
      const subscription = await prisma.subscription.upsert({
        where: { userId },
        create: { userId, ...legacyData },
        update: legacyData,
      });
      await reconcileSeatsForOwner(userId).catch(() => {});
      await sendIapLifecycleEmail({
        userId,
        subscriptionId: subscription.id,
        state,
        previousStatus: existingByUser?.status,
      }).catch((err) => {
        console.error("[IAP] lifecycle email lookup failed:", err);
      });
      return subscription;
    }
    if (isPurchaseTokenEncryptedCompatError(error)) {
      warnSchemaCompatibilityFallback("iap:purchase-token-encrypted-write", error);
      // If the encrypted column has not landed yet, keep the old column
      // encrypted rather than reintroducing plaintext storage.
      const legacyStorageData = withoutPurchaseTokenEncrypted({
        ...data,
        purchaseToken: purchaseTokenEncrypted,
      });
      const subscription = await prisma.subscription.upsert({
        where: { userId },
        create: { userId, ...legacyStorageData },
        update: legacyStorageData,
      });
      await reconcileSeatsForOwner(userId).catch(() => {});
      await sendIapLifecycleEmail({
        userId,
        subscriptionId: subscription.id,
        state,
        previousStatus: existingByUser?.status,
      }).catch((err) => {
        console.error("[IAP] lifecycle email lookup failed:", err);
      });
      return subscription;
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
  const purchaseTokenHash = hashPurchaseToken(opts.purchaseToken);
  if (purchaseTokenHash || opts.purchaseToken) {
    const row = await findSubscriptionByPurchaseTokenIdentifiers(
      purchaseTokenHash,
      opts.purchaseToken || null,
    );
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
    await acknowledgeGoogleSubscription({
      purchaseToken,
      productId: normalized.productId,
    });
  }

  return normalized;
}
