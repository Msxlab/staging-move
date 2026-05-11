import { prisma } from "@/lib/db";
import {
  createFallbackEntitlementSnapshot,
  DEFAULT_BILLING_PLAN,
  DEFAULT_SUBSCRIPTION_STATUS,
  getEffectiveEntitlement,
  TRIAL_DURATION_DAYS,
  type BillingPlan,
  type BillingProvider,
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

export const DEFAULT_STRIPE_ANNUAL_TRIAL_DAYS = 90;

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
 * monthly/yearly keys.
 */
export async function getStripePriceIdForPlanAndInterval(
  _plan: Extract<BillingPlan, "INDIVIDUAL">,
  billingInterval: StripeBillingInterval,
): Promise<string | null> {
  const [monthly, yearly, legacyMonthly] = await Promise.all([
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_MONTHLY"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_YEARLY"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL"),
  ]);

  if (billingInterval === "MONTH") return monthly || legacyMonthly || null;
  return yearly || null;
}

export async function getStripePriceIdForPlan(
  plan: Extract<BillingPlan, "INDIVIDUAL">,
  cycle: BillingCycle = "monthly",
) {
  return getStripePriceIdForPlanAndInterval(plan, billingCycleToInterval(cycle));
}

export async function mapStripePriceIdToPlanAndInterval(
  priceId: string | null | undefined,
): Promise<{ plan: Extract<BillingPlan, "INDIVIDUAL">; billingInterval: StripeBillingInterval } | null> {
  if (!priceId) return null;
  const [monthly, yearly, legacyMonthly] = await Promise.all([
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_MONTHLY"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_YEARLY"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL"),
  ]);
  if (monthly && priceId === monthly) return { plan: "INDIVIDUAL", billingInterval: "MONTH" };
  if (yearly && priceId === yearly) return { plan: "INDIVIDUAL", billingInterval: "YEAR" };
  if (legacyMonthly && priceId === legacyMonthly) return { plan: "INDIVIDUAL", billingInterval: "MONTH" };
  return null;
}

export async function mapStripePriceIdToPlan(priceId: string | null | undefined): Promise<BillingPlan | null> {
  return (await mapStripePriceIdToPlanAndInterval(priceId))?.plan || null;
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

export function buildUnifiedEntitlementSnapshot(subscription: any): UnifiedEntitlementSnapshot {
  if (!subscription) {
    return createFallbackEntitlementSnapshot({
      status: "UNKNOWN",
      isActive: false,
      trialEndsAt: null,
    });
  }

  // Backfill provider for legacy rows that have a Stripe customer but no
  // provider set, then delegate to the canonical effective entitlement
  // resolver. Every read path (admin, mobile, web settings, plan-limits)
  // goes through getEffectiveEntitlement so the answers stay in lockstep.
  const inferredProvider =
    subscription.provider || (subscription.stripeCustomerId ? "STRIPE" : "TRIAL");
  const effective = getEffectiveEntitlement({
    ...subscription,
    provider: inferredProvider,
  });

  const plan = (subscription.plan || DEFAULT_BILLING_PLAN) as BillingPlan;
  const status = subscription.status || DEFAULT_SUBSCRIPTION_STATUS;
  const provider = inferredProvider as BillingProvider;
  const accessType =
    effective.accessType || (plan === "INDIVIDUAL" ? "PAID" : null);
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
  stripePriceId: true,
  stripeCurrentPeriodEnd: true,
  billingProductId: true,
  originalTransactionId: true,
  latestTransactionId: true,
  purchaseToken: true,
  appStoreEnvironment: true,
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
  version: true,
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
    return await prisma.subscription.findUnique({
      where: { userId },
      select: SUBSCRIPTION_ENTITLEMENT_SELECT,
    });
  } catch (error) {
    if (!isMissingDbColumnError(error)) throw error;
    warnSchemaCompatibilityFallback("subscription:entitlement-read", error);
    try {
      return await prisma.subscription.findUnique({
        where: { userId },
        select: SUBSCRIPTION_LEGACY_SELECT,
      });
    } catch (legacyError) {
      if (!isMissingDbColumnError(legacyError)) throw legacyError;
      warnSchemaCompatibilityFallback("subscription:legacy-read", legacyError);
      return null;
    }
  }
}

export async function ensureSubscriptionDefaults(
  userId: string,
  options: { platform?: string | null; trialEndsAt?: Date } = {},
) {
  try {
    return await prisma.subscription.upsert({
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
    return ensureSubscriptionDefaultsSchemaCompat(userId, options);
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

async function getSubscriptionColumns() {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    "Subscription",
  );
  return new Set(
    rows
      .map((row) => row.COLUMN_NAME ?? row.column_name)
      .filter((value): value is string => typeof value === "string"),
  );
}

async function selectFallbackSubscription(userId: string, columns: Set<string>) {
  const selectColumns = SUBSCRIPTION_FALLBACK_SELECT_COLUMNS.filter((column) => columns.has(column));
  if (!selectColumns.includes("id") || !selectColumns.includes("userId")) {
    throw new Error("Subscription table is missing required id/userId columns.");
  }

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ${selectColumns.map(quoteIdentifier).join(", ")} FROM \`Subscription\` WHERE \`userId\` = ? LIMIT 1`,
    userId,
  );
  return rows[0] ?? null;
}

async function ensureSubscriptionDefaultsSchemaCompat(
  userId: string,
  options: { platform?: string | null; trialEndsAt?: Date } = {},
) {
  const columns = await getSubscriptionColumns();
  const existing = await selectFallbackSubscription(userId, columns);
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

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`Subscription\` (${insertColumns.map(quoteIdentifier).join(", ")}) ` +
      `VALUES (${insertColumns.map(() => "?").join(", ")}) ` +
      "ON DUPLICATE KEY UPDATE `userId` = `userId`",
    ...insertColumns.map((column) => insertValues.get(column)),
  );

  return await selectFallbackSubscription(userId, columns) ?? {
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
