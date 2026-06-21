/**
 * Canonical effective-entitlement resolver.
 *
 * Single source of truth for "does this user have access right now?"
 *
 * Read paths (API gates, /api/profile, admin user list/detail, subscription
 * management UI, mobile entitlement response, billing analytics, plan-limits)
 * MUST go through getEffectiveEntitlement so the answers stay in lockstep.
 *
 * The Subscription row is mirrored from Stripe / App Store / Play Store, or
 * written directly by the admin (manual premium / campaign grants). The fields
 * (status, accessType, provider, plan, expiry timestamps) are independently
 * writable, so combinations can drift. This helper interprets that drift
 * deterministically and surfaces inconsistencies as `warnings` so the admin UI
 * can flag them.
 */

import type {
  BillingPlan,
  BillingPlatform,
  BillingProvider,
  SubscriptionStatus,
} from "./billing";
// Value import is runtime-safe: consumer-free.ts imports ONLY a type from this
// module (erased at compile), so there is no runtime import cycle.
import { applyConsumerFreeOverride } from "./consumer-free";

export type EffectiveStatus =
  | "FREE_ACCESS_ACTIVE"
  | "FREE_ACCESS_EXPIRED"
  | "PROVIDER_TRIAL_ACTIVE"
  | "PROVIDER_TRIAL_CANCELED"
  | "PROVIDER_TRIAL_EXPIRED"
  | "PAID_ACTIVE"
  | "PAID_CANCEL_AT_PERIOD_END"
  | "PAID_PAST_DUE"
  | "PAID_GRACE_PERIOD"
  | "MANUAL_PREMIUM_ACTIVE"
  | "MANUAL_PREMIUM_EXPIRED"
  | "PENDING_CHECKOUT"
  | "CANCELED"
  | "REFUNDED"
  | "UNKNOWN";

export type AccessSource =
  | "DEFAULT_FREE_ACCESS"
  | "CAMPAIGN"
  | "ADMIN_MANUAL"
  | "STRIPE"
  | "APP_STORE"
  | "PLAY_STORE"
  | "NONE"
  | "UNKNOWN";

export interface EntitlementSubscriptionLike {
  plan?: string | null;
  status?: string | null;
  provider?: string | null;
  platform?: string | null;
  accessType?: string | null;
  trialEndsAt?: Date | string | null;
  freeAccessEndsAt?: Date | string | null;
  currentPeriodEndsAt?: Date | string | null;
  stripeCurrentPeriodEnd?: Date | string | null;
  premiumUntil?: Date | string | null;
  premiumGrantedBy?: string | null;
  premiumGrantedAt?: Date | string | null;
  gracePeriodEndsAt?: Date | string | null;
  cancelAtPeriodEnd?: boolean | null;
  autoRenew?: boolean | null;
  canceledAt?: Date | string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  originalTransactionId?: string | null;
  purchaseTokenHash?: string | null;
  campaignCode?: string | null;
  campaignId?: string | null;
}

export interface EffectiveEntitlement {
  hasAccess: boolean;
  hasPremium: boolean;
  effectivePlan: BillingPlan;
  effectiveStatus: EffectiveStatus;
  accessSource: AccessSource;
  billingProvider: BillingProvider;
  accessType: "FREE_ACCESS" | "FREE_TRIAL" | "PAID" | null;
  rawStatus: SubscriptionStatus | string | null;
  platform: BillingPlatform | string | null;
  expiresAt: Date | null;
  renewsAt: Date | null;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  managementKind: "stripe" | "store" | "admin" | "none";
  isManualOverride: boolean;
  reason: string;
  warnings: string[];
}

const PROVIDER_PAID_STATUSES = new Set([
  "ACTIVE",
  "CANCEL_AT_PERIOD_END",
  "PAST_DUE",
  "GRACE_PERIOD",
]);

const FREE_TRIAL_PLAN: BillingPlan = "FREE_TRIAL";
const INDIVIDUAL_PLAN: BillingPlan = "INDIVIDUAL";

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isAfter(date: Date | null, now: Date): boolean {
  return date !== null && date.getTime() > now.getTime();
}

function isManualAdminGrant(sub: EntitlementSubscriptionLike): boolean {
  // Manual admin grants are tagged by `premiumGrantedBy`. Campaign-driven
  // FREE_ACCESS grants also write provider=ADMIN but never stamp grantedBy,
  // so the two paths stay distinguishable without a schema flag.
  return Boolean(sub.premiumGrantedBy);
}

/**
 * Compute the canonical effective entitlement for a Subscription row.
 *
 * Pure function — accepts plain objects from Prisma, JSON, or tests. Returns
 * the same shape every read path can render against.
 */
export interface EffectiveEntitlementOptions {
  /**
   * Consumer read paths pass the resolved CONSUMER_FREE flag here so a pure
   * free / campaign / no-row consumer resolves to PRO (the everything-free
   * pivot). Admin / billing-truth / ownership-reconcile paths OMIT it → RAW
   * entitlement. H3-safe: never upgrades a real or lapsed stripe/store/admin
   * row (see applyConsumerFreeOverride). Default false → fully reversible.
   */
  applyConsumerFree?: boolean;
}

/**
 * Canonical effective-entitlement resolver. When `options.applyConsumerFree` is
 * true, the H3-safe consumer-free override is applied as the SINGLE, final step,
 * so every consumer gate that routes through here (plan-limits, the unified
 * snapshot, seats, connectors) gets PRO in one place (audit P1-2). Default false
 * leaves the billing-truth result untouched, so the preserve-suite and every
 * admin/billing read are unaffected and the pivot stays reversible.
 */
export function getEffectiveEntitlement(
  subscription: EntitlementSubscriptionLike | null | undefined,
  now: Date = new Date(),
  options?: EffectiveEntitlementOptions,
): EffectiveEntitlement {
  const result = computeEffectiveEntitlement(subscription, now);
  return applyConsumerFreeOverride(result, options?.applyConsumerFree ?? false);
}

function computeEffectiveEntitlement(
  subscription: EntitlementSubscriptionLike | null | undefined,
  now: Date = new Date(),
): EffectiveEntitlement {
  const warnings: string[] = [];

  if (!subscription) {
    return {
      hasAccess: false,
      hasPremium: false,
      effectivePlan: FREE_TRIAL_PLAN,
      effectiveStatus: "UNKNOWN",
      accessSource: "NONE",
      billingProvider: "UNKNOWN",
      accessType: null,
      rawStatus: null,
      platform: null,
      expiresAt: null,
      renewsAt: null,
      autoRenew: false,
      cancelAtPeriodEnd: false,
      managementKind: "none",
      isManualOverride: false,
      reason: "No subscription row",
      warnings,
    };
  }

  const provider = (subscription.provider || "UNKNOWN") as BillingProvider;
  const rawStatus = (subscription.status || null) as SubscriptionStatus | string | null;
  const accessType = (subscription.accessType || null) as
    | "FREE_ACCESS"
    | "FREE_TRIAL"
    | "PAID"
    | null;
  const plan = ((subscription.plan as BillingPlan) || FREE_TRIAL_PLAN) as BillingPlan;

  const trialEndsAt = asDate(subscription.trialEndsAt);
  const freeAccessEndsAt = asDate(subscription.freeAccessEndsAt);
  const premiumUntil = asDate(subscription.premiumUntil);
  const gracePeriodEndsAt = asDate(subscription.gracePeriodEndsAt);
  const stripePeriodEnd = asDate(subscription.stripeCurrentPeriodEnd);
  const periodEnd = asDate(subscription.currentPeriodEndsAt) || stripePeriodEnd;
  const cancelAtPeriodEnd = Boolean(subscription.cancelAtPeriodEnd);
  const isManual = isManualAdminGrant(subscription);

  // Cross-field consistency warnings — surfaced to the admin UI rather than
  // silently corrected. Auto-correcting here would mask bad writes.
  if (cancelAtPeriodEnd && subscription.autoRenew === true) {
    warnings.push("cancelAtPeriodEnd=true but autoRenew=true (inconsistent)");
  }
  if (rawStatus === "TRIALING" && !trialEndsAt) {
    warnings.push("status=TRIALING but trialEndsAt is null");
  }
  if (accessType === "FREE_ACCESS" && !freeAccessEndsAt && !isManual) {
    warnings.push("accessType=FREE_ACCESS but freeAccessEndsAt is null");
  }
  if (accessType === "PAID" && (provider === "TRIAL" || provider === "ADMIN") && !isManual) {
    warnings.push(`accessType=PAID but provider=${provider} (no real payment provider)`);
  }
  if (provider === "STRIPE" && !subscription.stripeSubscriptionId &&
      typeof rawStatus === "string" && PROVIDER_PAID_STATUSES.has(rawStatus)) {
    warnings.push("provider=STRIPE in paid status but stripeSubscriptionId is null");
  }
  if (provider === "APP_STORE" && !subscription.originalTransactionId &&
      typeof rawStatus === "string" && PROVIDER_PAID_STATUSES.has(rawStatus)) {
    warnings.push("provider=APP_STORE in paid status but originalTransactionId is null");
  }
  if (provider === "PLAY_STORE" && !subscription.purchaseTokenHash &&
      typeof rawStatus === "string" && PROVIDER_PAID_STATUSES.has(rawStatus)) {
    warnings.push("provider=PLAY_STORE in paid status but purchaseTokenHash is null");
  }

  // ── 1. Refund / explicit canceled / pending-checkout terminal states. ──
  if (rawStatus === "REFUNDED") {
    return finalize({
      hasAccess: false,
      hasPremium: false,
      effectivePlan: plan,
      effectiveStatus: "REFUNDED",
      reason: "Refunded",
      provider,
      accessType,
      rawStatus,
      platform: subscription.platform || null,
      expiresAt: periodEnd,
      renewsAt: null,
      autoRenew: false,
      cancelAtPeriodEnd: false,
      isManualOverride: isManual,
      warnings,
    });
  }

  if (rawStatus === "PENDING_CHECKOUT" || rawStatus === "PENDING_VALIDATION") {
    // Fall back to free-access grant if one is still in effect underneath
    // the pending checkout (Stripe checkout flow flips status BEFORE the
    // webhook clears the underlying free access).
    const fallback = freeAccessFallbackForPending(subscription, freeAccessEndsAt, now);
    return finalize({
      hasAccess: fallback?.hasAccess ?? false,
      hasPremium: fallback?.hasPremium ?? false,
      effectivePlan: fallback?.effectivePlan ?? plan,
      effectiveStatus: "PENDING_CHECKOUT",
      reason: "Checkout pending",
      provider,
      accessType,
      rawStatus,
      platform: subscription.platform || null,
      expiresAt: fallback?.expiresAt ?? periodEnd,
      renewsAt: null,
      autoRenew: false,
      cancelAtPeriodEnd: false,
      isManualOverride: isManual,
      warnings,
    });
  }

  // ── 2. Real payment-provider lifecycle (Stripe / App Store / Play Store). ──
  // Match on either an explicit payment-provider value, or on
  // accessType=FREE_TRIAL/PAID — both unambiguously mean a real provider
  // (Stripe / Apple / Google) is in charge of billing. Older rows or test
  // fixtures may have accessType set but provider missing; treating them
  // as provider-paid keeps gating behavior stable.
  const isProviderPaid =
    ((provider === "STRIPE" || provider === "APP_STORE" || provider === "PLAY_STORE") &&
      accessType !== "FREE_ACCESS") ||
    accessType === "FREE_TRIAL" ||
    (accessType === "PAID" && provider !== "ADMIN" && provider !== "TRIAL");

  if (isProviderPaid) {
    if (rawStatus === "TRIALING") {
      const trialActive = isAfter(trialEndsAt, now);
      if (!trialActive) {
        return finalize({
          hasAccess: false,
          hasPremium: false,
          effectivePlan: plan,
          effectiveStatus: "PROVIDER_TRIAL_EXPIRED",
          reason: "Provider trial expired",
          provider,
          accessType,
          rawStatus,
          platform: subscription.platform || null,
          expiresAt: trialEndsAt,
          renewsAt: null,
          autoRenew: false,
          cancelAtPeriodEnd,
          isManualOverride: false,
          warnings,
        });
      }
      return finalize({
        hasAccess: true,
        hasPremium: true,
        effectivePlan: plan,
        effectiveStatus: cancelAtPeriodEnd ? "PROVIDER_TRIAL_CANCELED" : "PROVIDER_TRIAL_ACTIVE",
        reason: cancelAtPeriodEnd ? "Provider trial active (renewal canceled)" : "Provider trial active",
        provider,
        accessType: accessType || "FREE_TRIAL",
        rawStatus,
        platform: subscription.platform || null,
        expiresAt: trialEndsAt,
        renewsAt: cancelAtPeriodEnd ? null : trialEndsAt,
        autoRenew: !cancelAtPeriodEnd,
        cancelAtPeriodEnd,
        isManualOverride: false,
        warnings,
      });
    }

    if (rawStatus === "TRIAL_CANCELED") {
      const trialActive = isAfter(trialEndsAt, now);
      return finalize({
        hasAccess: trialActive,
        hasPremium: trialActive,
        effectivePlan: plan,
        effectiveStatus: trialActive ? "PROVIDER_TRIAL_CANCELED" : "PROVIDER_TRIAL_EXPIRED",
        reason: trialActive ? "Trial active until period end" : "Provider trial expired",
        provider,
        accessType: accessType || "FREE_TRIAL",
        rawStatus,
        platform: subscription.platform || null,
        expiresAt: trialEndsAt,
        renewsAt: null,
        autoRenew: false,
        cancelAtPeriodEnd: true,
        isManualOverride: false,
        warnings,
      });
    }

    if (rawStatus === "ACTIVE") {
      const periodActive = !periodEnd || isAfter(periodEnd, now);
      if (!periodActive && subscription.canceledAt) {
        return finalize({
          hasAccess: false,
          hasPremium: false,
          effectivePlan: plan,
          effectiveStatus: "CANCELED",
          reason: "Subscription canceled",
          provider,
          accessType,
          rawStatus,
          platform: subscription.platform || null,
          expiresAt: periodEnd,
          renewsAt: null,
          autoRenew: false,
          cancelAtPeriodEnd,
          isManualOverride: false,
          warnings,
        });
      }
      return finalize({
        hasAccess: true,
        hasPremium: true,
        effectivePlan: plan,
        effectiveStatus: cancelAtPeriodEnd ? "PAID_CANCEL_AT_PERIOD_END" : "PAID_ACTIVE",
        reason: cancelAtPeriodEnd ? "Paid (renewal canceled)" : "Paid and active",
        provider,
        accessType: accessType || "PAID",
        rawStatus,
        platform: subscription.platform || null,
        expiresAt: periodEnd,
        renewsAt: cancelAtPeriodEnd ? null : periodEnd,
        autoRenew: !cancelAtPeriodEnd,
        cancelAtPeriodEnd,
        isManualOverride: false,
        warnings,
      });
    }

    if (rawStatus === "CANCEL_AT_PERIOD_END") {
      const periodActive = !periodEnd || isAfter(periodEnd, now);
      return finalize({
        hasAccess: periodActive,
        hasPremium: periodActive,
        effectivePlan: plan,
        effectiveStatus: periodActive ? "PAID_CANCEL_AT_PERIOD_END" : "CANCELED",
        reason: periodActive ? "Paid until period end" : "Period ended",
        provider,
        accessType: accessType || "PAID",
        rawStatus,
        platform: subscription.platform || null,
        expiresAt: periodEnd,
        renewsAt: null,
        autoRenew: false,
        cancelAtPeriodEnd: true,
        isManualOverride: false,
        warnings,
      });
    }

    if (rawStatus === "GRACE_PERIOD") {
      // A paying customer in grace must keep access for the grace window.
      // Some providers (notably Google Play) don't always stamp an explicit
      // gracePeriodEndsAt; fall back to the period end so a dropped/empty
      // grace timestamp can't instantly lock out a customer who has paid.
      const graceDeadline = gracePeriodEndsAt || periodEnd;
      const graceActive = isAfter(graceDeadline, now);
      return finalize({
        hasAccess: graceActive,
        hasPremium: graceActive,
        effectivePlan: plan,
        effectiveStatus: graceActive ? "PAID_GRACE_PERIOD" : "PAID_PAST_DUE",
        reason: graceActive ? "Payment grace period" : "Past due",
        provider,
        accessType: accessType || "PAID",
        rawStatus,
        platform: subscription.platform || null,
        expiresAt: graceDeadline,
        renewsAt: null,
        autoRenew: false,
        cancelAtPeriodEnd,
        isManualOverride: false,
        warnings,
      });
    }

    if (rawStatus === "PAST_DUE") {
      const graceDeadline = gracePeriodEndsAt || periodEnd;
      const graceActive = isAfter(graceDeadline, now);
      return finalize({
        hasAccess: graceActive,
        hasPremium: graceActive,
        effectivePlan: plan,
        effectiveStatus: graceActive ? "PAID_GRACE_PERIOD" : "PAID_PAST_DUE",
        reason: graceActive ? "In grace period" : "Past due",
        provider,
        accessType: accessType || "PAID",
        rawStatus,
        platform: subscription.platform || null,
        expiresAt: graceDeadline,
        renewsAt: null,
        autoRenew: false,
        cancelAtPeriodEnd,
        isManualOverride: false,
        warnings,
      });
    }

    if (rawStatus === "CANCELED" || rawStatus === "EXPIRED" || rawStatus === "UNPAID") {
      return finalize({
        hasAccess: false,
        hasPremium: false,
        effectivePlan: plan,
        effectiveStatus: "CANCELED",
        reason: "Subscription canceled",
        provider,
        accessType,
        rawStatus,
        platform: subscription.platform || null,
        expiresAt: periodEnd,
        renewsAt: null,
        autoRenew: false,
        cancelAtPeriodEnd,
        isManualOverride: false,
        warnings,
      });
    }
  }

  // ── 3. Admin manual premium (provider=ADMIN, premiumGrantedBy set). ──
  if (provider === "ADMIN" && isManual) {
    const premiumActive = isAfter(premiumUntil, now);
    if (premiumUntil === null) {
      warnings.push("Admin manual premium has no premiumUntil");
    }
    return finalize({
      hasAccess: premiumActive,
      hasPremium: premiumActive,
      effectivePlan: premiumActive ? (plan || INDIVIDUAL_PLAN) : FREE_TRIAL_PLAN,
      effectiveStatus: premiumActive ? "MANUAL_PREMIUM_ACTIVE" : "MANUAL_PREMIUM_EXPIRED",
      reason: premiumActive ? "Admin manual premium" : "Admin manual premium expired",
      provider,
      accessType: accessType,
      rawStatus,
      platform: subscription.platform || null,
      expiresAt: premiumUntil,
      renewsAt: null,
      autoRenew: false,
      cancelAtPeriodEnd: false,
      isManualOverride: true,
      warnings,
    });
  }

  // ── 4. Free Access (default signup, campaign, or non-grant ADMIN row). ──
  // Match strictly on accessType=FREE_ACCESS so that legacy rows with
  // provider=TRIAL but plan=FREE_TRIAL + trialEndsAt fall through to the
  // legacy-trial branch below instead of being treated as expired free
  // access.
  if (accessType === "FREE_ACCESS") {
    const freeActive = isAfter(freeAccessEndsAt, now);
    return finalize({
      hasAccess: freeActive,
      hasPremium: false,
      effectivePlan: FREE_TRIAL_PLAN,
      effectiveStatus: freeActive ? "FREE_ACCESS_ACTIVE" : "FREE_ACCESS_EXPIRED",
      reason: freeActive ? "Free access active" : "Free access expired",
      provider,
      accessType,
      rawStatus,
      platform: subscription.platform || null,
      expiresAt: freeAccessEndsAt,
      renewsAt: null,
      autoRenew: false,
      cancelAtPeriodEnd: false,
      isManualOverride: false,
      warnings,
    });
  }

  // ── 5. Legacy plan=FREE_TRIAL with no Stripe trial yet. ──
  if (plan === FREE_TRIAL_PLAN) {
    const trialActive = isAfter(trialEndsAt, now);
    return finalize({
      hasAccess: trialActive,
      hasPremium: false,
      effectivePlan: FREE_TRIAL_PLAN,
      effectiveStatus: trialActive ? "FREE_ACCESS_ACTIVE" : "FREE_ACCESS_EXPIRED",
      reason: trialActive ? "Legacy free trial active" : "Legacy free trial expired",
      provider,
      accessType: accessType,
      rawStatus,
      platform: subscription.platform || null,
      expiresAt: trialEndsAt,
      renewsAt: null,
      autoRenew: false,
      cancelAtPeriodEnd: false,
      isManualOverride: false,
      warnings,
    });
  }

  return finalize({
    hasAccess: false,
    hasPremium: false,
    effectivePlan: plan,
    effectiveStatus: "UNKNOWN",
    reason: "Unrecognized subscription state",
    provider,
    accessType,
    rawStatus,
    platform: subscription.platform || null,
    expiresAt: periodEnd,
    renewsAt: null,
    autoRenew: false,
    cancelAtPeriodEnd,
    isManualOverride: isManual,
    warnings,
  });
}

function freeAccessFallbackForPending(
  sub: EntitlementSubscriptionLike,
  freeAccessEndsAt: Date | null,
  now: Date,
): { hasAccess: boolean; hasPremium: boolean; effectivePlan: BillingPlan; expiresAt: Date | null } | null {
  // The Stripe checkout flow writes status=PENDING_CHECKOUT BEFORE the user
  // returns. If the same row was previously a Free Access grant, the user
  // should retain Free Access until checkout actually completes.
  if (sub.accessType === "FREE_ACCESS" && isAfter(freeAccessEndsAt, now)) {
    return { hasAccess: true, hasPremium: false, effectivePlan: FREE_TRIAL_PLAN, expiresAt: freeAccessEndsAt };
  }
  return null;
}

interface FinalizeInput {
  hasAccess: boolean;
  hasPremium: boolean;
  effectivePlan: BillingPlan;
  effectiveStatus: EffectiveStatus;
  reason: string;
  provider: BillingProvider;
  accessType: "FREE_ACCESS" | "FREE_TRIAL" | "PAID" | null;
  rawStatus: SubscriptionStatus | string | null;
  platform: BillingPlatform | string | null;
  expiresAt: Date | null;
  renewsAt: Date | null;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  isManualOverride: boolean;
  warnings: string[];
}

function finalize(input: FinalizeInput): EffectiveEntitlement {
  return {
    hasAccess: input.hasAccess,
    hasPremium: input.hasPremium,
    effectivePlan: input.effectivePlan,
    effectiveStatus: input.effectiveStatus,
    accessSource: deriveAccessSource(input),
    billingProvider: input.provider,
    accessType: input.accessType,
    rawStatus: input.rawStatus,
    platform: input.platform,
    expiresAt: input.expiresAt,
    renewsAt: input.renewsAt,
    autoRenew: input.autoRenew,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    managementKind: deriveManagementKind(input.provider, input.isManualOverride),
    isManualOverride: input.isManualOverride,
    reason: input.reason,
    warnings: input.warnings,
  };
}

function deriveAccessSource(input: FinalizeInput): AccessSource {
  if (input.isManualOverride) return "ADMIN_MANUAL";
  if (input.provider === "STRIPE") return "STRIPE";
  if (input.provider === "APP_STORE") return "APP_STORE";
  if (input.provider === "PLAY_STORE") return "PLAY_STORE";
  if (input.provider === "ADMIN") return "CAMPAIGN";
  if (input.provider === "TRIAL") return "DEFAULT_FREE_ACCESS";
  if (input.effectiveStatus === "UNKNOWN") return "UNKNOWN";
  return "NONE";
}

function deriveManagementKind(
  provider: BillingProvider,
  isManualOverride: boolean,
): "stripe" | "store" | "admin" | "none" {
  if (provider === "STRIPE") return "stripe";
  if (provider === "APP_STORE" || provider === "PLAY_STORE") return "store";
  if (provider === "ADMIN" && isManualOverride) return "admin";
  return "none";
}

/**
 * Friendly, user-facing label per effective status. Centralizes the wording
 * so admin UI, settings UI, and emails stay in sync.
 */
export function effectiveStatusLabel(status: EffectiveStatus): string {
  switch (status) {
    case "FREE_ACCESS_ACTIVE": return "Free Access (active)";
    case "FREE_ACCESS_EXPIRED": return "Free Access (expired)";
    case "PROVIDER_TRIAL_ACTIVE": return "Trial (active)";
    case "PROVIDER_TRIAL_CANCELED": return "Trial (canceling)";
    case "PROVIDER_TRIAL_EXPIRED": return "Trial (expired)";
    case "PAID_ACTIVE": return "Paid (active)";
    case "PAID_CANCEL_AT_PERIOD_END": return "Paid (renewal canceled)";
    case "PAID_PAST_DUE": return "Past due";
    case "PAID_GRACE_PERIOD": return "Grace period";
    case "MANUAL_PREMIUM_ACTIVE": return "Manual Premium (active)";
    case "MANUAL_PREMIUM_EXPIRED": return "Manual Premium (expired)";
    case "PENDING_CHECKOUT": return "Activating checkout…";
    case "CANCELED": return "Canceled";
    case "REFUNDED": return "Refunded";
    case "UNKNOWN":
    default: return "Unknown";
  }
}

export function accessSourceLabel(source: AccessSource): string {
  switch (source) {
    case "DEFAULT_FREE_ACCESS": return "Default Free Access";
    case "CAMPAIGN": return "Campaign";
    case "ADMIN_MANUAL": return "Manual Admin Grant";
    case "STRIPE": return "Stripe";
    case "APP_STORE": return "Apple In-App Purchase";
    case "PLAY_STORE": return "Google Play";
    case "NONE": return "None";
    case "UNKNOWN":
    default: return "Unknown";
  }
}
