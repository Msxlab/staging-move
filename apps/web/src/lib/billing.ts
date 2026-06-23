import { prisma } from "@/lib/db";
import type { Prisma } from "@locateflow/db";
import {
  createFallbackEntitlementSnapshot,
  DEFAULT_BILLING_PLAN,
  DEFAULT_SUBSCRIPTION_STATUS,
  getEffectiveEntitlement,
  applyConsumerFreeOverride,
  isPaidBillingPlan,
  TRIAL_DURATION_DAYS,
  type BillingPlan,
  type BillingProvider,
  type PaidBillingPlan,
  type UnifiedEntitlementSnapshot,
} from "@/lib/shared-billing";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import {
  isMissingDbColumnError,
  warnSchemaCompatibilityFallback,
} from "@/lib/db-schema-compat";
import { randomBytes } from "node:crypto";

export function createTrialEndsAt() {
  return new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export type BillingCycle = "monthly" | "yearly";
export type StripeBillingInterval = "MONTH" | "YEAR";

export const DEFAULT_STRIPE_ANNUAL_TRIAL_DAYS = 14;

export function billingCycleToInterval(cycle: BillingCycle): StripeBillingInterval {
  return cycle === "yearly" ? "YEAR" : "MONTH";
}

export function billingIntervalToCycle(interval: StripeBillingInterval): BillingCycle {
  return interval === "YEAR" ? "yearly" : "monthly";
}

/**
 * Resolve the Stripe Price ID for a plan + billing interval.
 *
 * DigitalOcean/deployment env is the production source of truth for these
 * keys unless STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED=true is set. The legacy
 * STRIPE_PRICE_INDIVIDUAL key is monthly-only and never beats the new
 * monthly/yearly keys. FAMILY/PRO resolve only when their price IDs are
 * configured; until then self-serve checkout for those tiers 503s while
 * admin-granted Family/Pro keeps working (it never reads a price ID).
 */
export async function getStripePriceIdForPlanAndInterval(
  plan: PaidBillingPlan,
  billingInterval: StripeBillingInterval,
): Promise<string | null> {
  if (plan === "INDIVIDUAL") {
    const [monthly, yearly, legacyMonthly] = await Promise.all([
      getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_MONTHLY"),
      getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_YEARLY"),
      getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL"),
    ]);
    if (billingInterval === "MONTH") return monthly || legacyMonthly || null;
    return yearly || null;
  }

  const monthlyKey = plan === "FAMILY" ? "STRIPE_PRICE_FAMILY_MONTHLY" : "STRIPE_PRICE_PRO_MONTHLY";
  const yearlyKey = plan === "FAMILY" ? "STRIPE_PRICE_FAMILY_YEARLY" : "STRIPE_PRICE_PRO_YEARLY";
  const [monthly, yearly] = await Promise.all([
    getRuntimeConfigValue(monthlyKey),
    getRuntimeConfigValue(yearlyKey),
  ]);
  return billingInterval === "MONTH" ? monthly || null : yearly || null;
}

export async function getStripePriceIdForPlan(
  plan: PaidBillingPlan,
  cycle: BillingCycle = "monthly",
) {
  return getStripePriceIdForPlanAndInterval(plan, billingCycleToInterval(cycle));
}

export async function mapStripePriceIdToPlanAndInterval(
  priceId: string | null | undefined,
): Promise<{ plan: PaidBillingPlan; billingInterval: StripeBillingInterval } | null> {
  if (!priceId) return null;
  const [
    indMonthly,
    indYearly,
    indLegacy,
    famMonthly,
    famYearly,
    proMonthly,
    proYearly,
  ] = await Promise.all([
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_MONTHLY"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_YEARLY"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL"),
    getRuntimeConfigValue("STRIPE_PRICE_FAMILY_MONTHLY"),
    getRuntimeConfigValue("STRIPE_PRICE_FAMILY_YEARLY"),
    getRuntimeConfigValue("STRIPE_PRICE_PRO_MONTHLY"),
    getRuntimeConfigValue("STRIPE_PRICE_PRO_YEARLY"),
  ]);
  if (indMonthly && priceId === indMonthly) return { plan: "INDIVIDUAL", billingInterval: "MONTH" };
  if (indYearly && priceId === indYearly) return { plan: "INDIVIDUAL", billingInterval: "YEAR" };
  if (indLegacy && priceId === indLegacy) return { plan: "INDIVIDUAL", billingInterval: "MONTH" };
  if (famMonthly && priceId === famMonthly) return { plan: "FAMILY", billingInterval: "MONTH" };
  if (famYearly && priceId === famYearly) return { plan: "FAMILY", billingInterval: "YEAR" };
  if (proMonthly && priceId === proMonthly) return { plan: "PRO", billingInterval: "MONTH" };
  if (proYearly && priceId === proYearly) return { plan: "PRO", billingInterval: "YEAR" };
  return null;
}

export async function mapStripePriceIdToPlan(priceId: string | null | undefined): Promise<BillingPlan | null> {
  return (await mapStripePriceIdToPlanAndInterval(priceId))?.plan || null;
}

async function hydrateStripePlanAndInterval<T extends Record<string, any> | null>(subscription: T): Promise<T> {
  if (!subscription?.stripePriceId || subscription.billingInterval) return subscription;
  const mapped = await mapStripePriceIdToPlanAndInterval(subscription.stripePriceId);
  if (!mapped) return subscription;
  return {
    ...subscription,
    plan: subscription.plan || mapped.plan,
    billingInterval: mapped.billingInterval,
  };
}

export async function getStripeAnnualTrialDays(): Promise<number> {
  const raw = await getRuntimeConfigValue("STRIPE_ANNUAL_TRIAL_DAYS");
  if (!raw) return DEFAULT_STRIPE_ANNUAL_TRIAL_DAYS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
    return DEFAULT_STRIPE_ANNUAL_TRIAL_DAYS;
  }
  return parsed;
}

export function buildUnifiedEntitlementSnapshot(
  subscription: any,
  opts?: { consumerFree?: boolean },
): UnifiedEntitlementSnapshot {
  if (!subscription) {
    if (!opts?.consumerFree) {
      return createFallbackEntitlementSnapshot({
        status: "UNKNOWN",
        isActive: false,
        trialEndsAt: null,
      });
    }
    // Consumer-free + no subscription row = the purest free/no-row consumer.
    // getEffectiveEntitlement(null) resolves to managementKind "none", so the
    // H3-safe override below upgrades it to active PRO (mobile/profile read
    // this). Normalize to an empty row so it shares the single derivation path
    // and the snapshot shape stays identical to the with-row case.
    // (docs/ai/free-pivot/16 M1)
    subscription = {};
  }

  // Backfill provider for legacy rows that have a Stripe customer but no
  // provider set, then delegate to the canonical effective entitlement
  // resolver. Every read path (admin, mobile, web settings, plan-limits)
  // goes through getEffectiveEntitlement so the answers stay in lockstep.
  const inferredProvider =
    subscription.provider || (subscription.stripeCustomerId ? "STRIPE" : "TRIAL");
  // Consumer read paths (profile/mobile snapshot) pass consumerFree=true so a
  // pure free / campaign / no-row consumer resolves to PRO. Admin / billing
  // metrics omit it → RAW entitlement (the override is H3-safe and never
  // touches a real or lapsed stripe/store/admin row). (docs/ai/free-pivot/16 H1)
  const effective = applyConsumerFreeOverride(
    getEffectiveEntitlement({
      ...subscription,
      provider: inferredProvider,
    }),
    opts?.consumerFree ?? false,
  );

  // Use the EFFECTIVE plan (accounts for admin grants + inherited workspace
  // tier), consistent with isActive/accessType below which already derive from
  // `effective`. Returning raw subscription.plan here surfaced the wrong tier
  // for admin-granted/inherited members (e.g. mobile plan-aware labels). (find-006)
  const plan = (effective.effectivePlan || subscription.plan || DEFAULT_BILLING_PLAN) as BillingPlan;
  const status = subscription.status || DEFAULT_SUBSCRIPTION_STATUS;
  const provider = inferredProvider as BillingProvider;
  const accessType =
    effective.accessType || (isPaidBillingPlan(plan) ? "PAID" : null);
  const trialEndsAt = subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const freeAccessEndsAt = subscription.freeAccessEndsAt ? new Date(subscription.freeAccessEndsAt) : null;
  const firstChargeAt = subscription.firstChargeAt ? new Date(subscription.firstChargeAt) : null;
  const currentPeriodEndsAt = subscription.currentPeriodEndsAt
    ? new Date(subscription.currentPeriodEndsAt)
    : subscription.stripeCurrentPeriodEnd
      ? new Date(subscription.stripeCurrentPeriodEnd)
      : subscription.premiumUntil
        ? new Date(subscription.premiumUntil)
        : null;
  const managementKind =
    effective.managementKind === "admin" ? "none" : effective.managementKind;

  return {
    plan,
    status,
    provider,
    platform: subscription.platform || null,
    accessType,
    isActive: effective.hasAccess,
    isTrial:
      effective.effectiveStatus === "PROVIDER_TRIAL_ACTIVE" ||
      effective.effectiveStatus === "PROVIDER_TRIAL_CANCELED",
    autoRenew: effective.autoRenew,
    cancelAtPeriodEnd: effective.cancelAtPeriodEnd,
    managementKind,
    trialEndsAt: trialEndsAt?.toISOString() || null,
    freeAccessEndsAt: freeAccessEndsAt?.toISOString() || null,
    firstChargeAt: firstChargeAt?.toISOString() || null,
    currentPeriodEndsAt: currentPeriodEndsAt?.toISOString() || null,
  };
}

const SUBSCRIPTION_ENTITLEMENT_SELECT = {
  id: true,
  userId: true,
  plan: true,
  status: true,
  provider: true,
  platform: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripeSubscriptionScheduleId: true,
  stripePriceId: true,
  stripeCurrentPeriodEnd: true,
  billingProductId: true,
  originalTransactionId: true,
  latestTransactionId: true,
  purchaseTokenHash: true,
  appStoreEnvironment: true,
  currentPeriodEndsAt: true,
  gracePeriodEndsAt: true,
  lastValidatedAt: true,
  lastSyncedAt: true,
  accessType: true,
  billingInterval: true,
  pendingPlan: true,
  pendingBillingInterval: true,
  pendingBillingIntervalEffectiveAt: true,
  freeAccessEndsAt: true,
  cancelAtPeriodEnd: true,
  firstChargeAt: true,
  firstChargeAmount: true,
  autoRenew: true,
  trialEndsAt: true,
  canceledAt: true,
  premiumUntil: true,
  premiumGrantedBy: true,
  premiumGrantedAt: true,
  premiumNote: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SUBSCRIPTION_SCHEMA_COMPAT_SELECT = {
  id: true,
  userId: true,
  plan: true,
  status: true,
  provider: true,
  platform: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripePriceId: true,
  stripeCurrentPeriodEnd: true,
  billingProductId: true,
  currentPeriodEndsAt: true,
  gracePeriodEndsAt: true,
  lastValidatedAt: true,
  lastSyncedAt: true,
  accessType: true,
  billingInterval: true,
  freeAccessEndsAt: true,
  cancelAtPeriodEnd: true,
  firstChargeAt: true,
  firstChargeAmount: true,
  autoRenew: true,
  trialEndsAt: true,
  canceledAt: true,
  premiumUntil: true,
  premiumGrantedBy: true,
  premiumGrantedAt: true,
  premiumNote: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SUBSCRIPTION_LEGACY_SELECT = {
  id: true,
  userId: true,
  plan: true,
  status: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripePriceId: true,
  stripeCurrentPeriodEnd: true,
  trialEndsAt: true,
  canceledAt: true,
  premiumUntil: true,
  premiumGrantedBy: true,
  premiumGrantedAt: true,
  premiumNote: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function findSubscriptionForEntitlement(userId: string) {
  try {
    return await hydrateStripePlanAndInterval(await prisma.subscription.findUnique({
      where: { userId },
      select: SUBSCRIPTION_ENTITLEMENT_SELECT,
    }));
  } catch (error) {
    if (!isMissingDbColumnError(error)) throw error;
    warnSchemaCompatibilityFallback("subscription:entitlement-read", error);
    try {
      return await hydrateStripePlanAndInterval(await prisma.subscription.findUnique({
        where: { userId },
        select: SUBSCRIPTION_SCHEMA_COMPAT_SELECT,
      }));
    } catch (compatError) {
      if (!isMissingDbColumnError(compatError)) throw compatError;
      warnSchemaCompatibilityFallback("subscription:schema-compat-read", compatError);
      try {
        return await hydrateStripePlanAndInterval(await prisma.subscription.findUnique({
          where: { userId },
          select: SUBSCRIPTION_LEGACY_SELECT,
        }));
      } catch (legacyError) {
        if (!isMissingDbColumnError(legacyError)) throw legacyError;
        warnSchemaCompatibilityFallback("subscription:legacy-read", legacyError);
        return null;
      }
    }
  }
}

// Accepts either the full app client (default) or an interactive
// transaction client, so callers that wrap multiple writes in
// prisma.$transaction can run subscription provisioning inside the same
// atomic unit. PrismaClient is structurally assignable to TransactionClient
// for the model + raw methods used below.
type SubscriptionDbClient = Prisma.TransactionClient;

export async function ensureSubscriptionDefaults(
  userId: string,
  options: { platform?: string | null; trialEndsAt?: Date } = {},
  tx: SubscriptionDbClient = prisma,
) {
  try {
    return await tx.subscription.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        plan: DEFAULT_BILLING_PLAN,
        status: DEFAULT_SUBSCRIPTION_STATUS,
        provider: "TRIAL",
        platform: options.platform || "web",
        accessType: "FREE_ACCESS",
        freeAccessEndsAt: options.trialEndsAt || createTrialEndsAt(),
      },
    });
  } catch (error) {
    if (!isMissingDbColumnError(error)) throw error;
    warnSchemaCompatibilityFallback("subscription:ensure-defaults", error);
    return ensureSubscriptionDefaultsSchemaCompat(userId, options, tx);
  }
}

const SUBSCRIPTION_FALLBACK_SELECT_COLUMNS = [
  "id",
  "userId",
  "plan",
  "status",
  "provider",
  "platform",
  "accessType",
  "freeAccessEndsAt",
  "trialEndsAt",
  "createdAt",
  "updatedAt",
] as const;

const SUBSCRIPTION_FALLBACK_INSERT_COLUMNS = [
  "id",
  "userId",
  "plan",
  "status",
  "provider",
  "platform",
  "accessType",
  "freeAccessEndsAt",
  "trialEndsAt",
  "createdAt",
  "updatedAt",
] as const;

function quoteIdentifier(identifier: string) {
  return `\`${identifier}\``;
}

function fallbackSubscriptionId() {
  return `sub_${randomBytes(12).toString("hex")}`;
}

async function getSubscriptionColumns(db: SubscriptionDbClient = prisma) {
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    "Subscription",
  );
  return new Set(
    rows
      .map((row) => row.COLUMN_NAME ?? row.column_name)
      .filter((value): value is string => typeof value === "string"),
  );
}

async function selectFallbackSubscription(
  userId: string,
  columns: Set<string>,
  db: SubscriptionDbClient = prisma,
) {
  const selectColumns = SUBSCRIPTION_FALLBACK_SELECT_COLUMNS.filter((column) => columns.has(column));
  if (!selectColumns.includes("id") || !selectColumns.includes("userId")) {
    throw new Error("Subscription table is missing required id/userId columns.");
  }

  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ${selectColumns.map(quoteIdentifier).join(", ")} FROM \`Subscription\` WHERE \`userId\` = ? LIMIT 1`,
    userId,
  );
  return rows[0] ?? null;
}

async function ensureSubscriptionDefaultsSchemaCompat(
  userId: string,
  options: { platform?: string | null; trialEndsAt?: Date } = {},
  db: SubscriptionDbClient = prisma,
) {
  const columns = await getSubscriptionColumns(db);
  const existing = await selectFallbackSubscription(userId, columns, db);
  if (existing) return existing;

  const now = new Date();
  const trialEndsAt = options.trialEndsAt || createTrialEndsAt();
  const insertValues = new Map<string, unknown>([
    ["id", fallbackSubscriptionId()],
    ["userId", userId],
    ["plan", DEFAULT_BILLING_PLAN],
    ["status", DEFAULT_SUBSCRIPTION_STATUS],
    ["provider", "TRIAL"],
    ["platform", options.platform || "web"],
    ["accessType", "FREE_ACCESS"],
    ["freeAccessEndsAt", trialEndsAt],
    ["trialEndsAt", trialEndsAt],
    ["createdAt", now],
    ["updatedAt", now],
  ]);
  const insertColumns = SUBSCRIPTION_FALLBACK_INSERT_COLUMNS.filter(
    (column) => columns.has(column) && insertValues.has(column),
  );

  if (!insertColumns.includes("id") || !insertColumns.includes("userId")) {
    throw new Error("Subscription table is missing required id/userId columns.");
  }

  await db.$executeRawUnsafe(
    `INSERT INTO \`Subscription\` (${insertColumns.map(quoteIdentifier).join(", ")}) ` +
      `VALUES (${insertColumns.map(() => "?").join(", ")}) ` +
      "ON DUPLICATE KEY UPDATE `userId` = `userId`",
    ...insertColumns.map((column) => insertValues.get(column)),
  );

  return await selectFallbackSubscription(userId, columns, db) ?? {
    id: insertValues.get("id"),
    userId,
    plan: DEFAULT_BILLING_PLAN,
    status: DEFAULT_SUBSCRIPTION_STATUS,
    provider: columns.has("provider") ? "TRIAL" : undefined,
    platform: columns.has("platform") ? options.platform || "web" : undefined,
    accessType: columns.has("accessType") ? "FREE_ACCESS" : undefined,
    freeAccessEndsAt: columns.has("freeAccessEndsAt") ? trialEndsAt : undefined,
    trialEndsAt: columns.has("trialEndsAt") ? trialEndsAt : undefined,
    createdAt: now,
    updatedAt: now,
  };
}
