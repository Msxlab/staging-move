import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getRequiredRuntimeConfigValues } from "@/lib/runtime-config";
import {
  isBillingProductionLike,
  requireAppleEnvironmentForBilling,
  validateStripeSecretKeyForEnv,
} from "@/lib/billing-config";
import {
  getCanonicalSiteUrl,
  isNoIndexEnvironment,
  shouldBlockForRequestHosts,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

interface Check {
  status: "ok" | "fail" | "skip";
  durationMs?: number;
  detail?: string;
}

function isProductionLikeRuntime() {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  return (
    process.env.NODE_ENV === "production" ||
    appEnv === "production" ||
    appEnv === "staging" ||
    appEnv === "preview" ||
    Boolean(process.env.DIGITALOCEAN_APP_ID)
  );
}

async function getSeoDiagnostics() {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host")?.split(",")[0]?.trim() || null;
  const host = h.get("host")?.split(",")[0]?.trim() || null;
  const canonicalSiteUrl = getCanonicalSiteUrl();
  const environmentBlocksIndexing = isNoIndexEnvironment(canonicalSiteUrl);
  const hostBlocksIndexing = shouldBlockForRequestHosts([forwardedHost, host]);
  const shouldIndexPublicPages = !environmentBlocksIndexing && !hostBlocksIndexing;

  return {
    appEnv: process.env.APP_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
    siteUrl: process.env.SITE_URL || null,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL || null,
    nextPublicAdminUrl: process.env.NEXT_PUBLIC_ADMIN_URL || null,
    forwardedHost,
    host,
    canonicalSiteUrl,
    environmentBlocksIndexing,
    hostBlocksIndexing,
    shouldIndexPublicPages,
    seoMode: shouldIndexPublicPages ? "indexable" : "blocked",
    blockedReason: shouldIndexPublicPages
      ? null
      : [
          environmentBlocksIndexing ? "environment-or-canonical" : null,
          hostBlocksIndexing ? "request-host" : null,
        ].filter(Boolean).join(", "),
    digitalOceanAppIdPresent: Boolean(process.env.DIGITALOCEAN_APP_ID),
    commitSha:
      process.env.SOURCE_COMMIT ||
      process.env.GIT_COMMIT_SHA ||
      process.env.COMMIT_SHA ||
      process.env.DIGITALOCEAN_GIT_COMMIT_SHA ||
      null,
  };
}

async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ ok: boolean; ms: number; value?: T; err?: unknown }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t0, value };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, err };
  }
}

export async function GET() {
  const runtimeValues = await getRequiredRuntimeConfigValues([
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "APP_URL",
    "NEXT_PUBLIC_APP_URL",
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
    "STRIPE_PRICE_INDIVIDUAL_YEARLY",
    "STRIPE_ANNUAL_TRIAL_DAYS",
    "STRIPE_WEBHOOK_SECRET",
    "APPLE_APP_STORE_ENVIRONMENT",
    "MOBILE_IOS_PRODUCT_INDIVIDUAL",
    "GOOGLE_PLAY_RTDN_AUDIENCE",
    "MOBILE_ANDROID_PRODUCT_INDIVIDUAL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SUPPORT_EMAIL",
    "EMAIL_REPLY_TO",
    "FIELD_ENCRYPTION_KEY",
    "R2_BUCKET",
    "R2_ENDPOINT",
    "NEXT_PUBLIC_IMGPROXY_URL",
    "R2_PUBLIC_BASE_URL",
  ]);

  const checks: Record<string, Check> = {};
  let healthy = true;

  const db = await timed(() => prisma.$queryRaw`SELECT 1`);
  checks.database = { status: db.ok ? "ok" : "fail", durationMs: db.ms };
  if (!db.ok) healthy = false;

  const nullTrialExpiry = await timed(() =>
    prisma.subscription.count({
      where: { plan: "FREE_TRIAL", trialEndsAt: null },
    }),
  );

  if (
    runtimeValues.UPSTASH_REDIS_REST_URL &&
    runtimeValues.UPSTASH_REDIS_REST_TOKEN
  ) {
    const redis = await timed(async () => {
      const res = await fetch(`${runtimeValues.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: {
          Authorization: `Bearer ${runtimeValues.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
    checks.redis = { status: redis.ok ? "ok" : "fail", durationMs: redis.ms };
  } else {
    checks.redis = {
      status: "skip",
      detail: "Not configured (in-memory fallback)",
    };
  }

  const stripeKeyValidation = validateStripeSecretKeyForEnv(runtimeValues.STRIPE_SECRET_KEY);
  const billingProductionLike = isBillingProductionLike();
  const missingBillingConfig = [
    !runtimeValues.STRIPE_PRICE_INDIVIDUAL_MONTHLY ? "STRIPE_PRICE_INDIVIDUAL_MONTHLY" : null,
    !runtimeValues.STRIPE_PRICE_INDIVIDUAL_YEARLY ? "STRIPE_PRICE_INDIVIDUAL_YEARLY" : null,
    !runtimeValues.STRIPE_WEBHOOK_SECRET ? "STRIPE_WEBHOOK_SECRET" : null,
    !runtimeValues.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" : null,
    !(runtimeValues.APP_URL || runtimeValues.NEXT_PUBLIC_APP_URL) ? "APP_URL or NEXT_PUBLIC_APP_URL" : null,
  ].filter(Boolean);
  const stripeStatus =
    stripeKeyValidation.ok && missingBillingConfig.length === 0
      ? "ok"
      : billingProductionLike
        ? "fail"
        : "skip";
  checks.stripe = {
    status: stripeStatus,
    detail:
      stripeStatus === "ok"
        ? undefined
        : [
            stripeKeyValidation.reason,
            missingBillingConfig.length > 0
              ? `Missing billing config: ${missingBillingConfig.join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
  };
  if (billingProductionLike && stripeStatus === "fail") healthy = false;

  const iosIapEnabled = Boolean(runtimeValues.MOBILE_IOS_PRODUCT_INDIVIDUAL);
  if (!iosIapEnabled) {
    checks.appleIap = { status: "skip", detail: "iOS IAP product is not configured." };
  } else {
    try {
      requireAppleEnvironmentForBilling(runtimeValues.APPLE_APP_STORE_ENVIRONMENT);
      checks.appleIap = { status: "ok" };
    } catch (err) {
      checks.appleIap = {
        status: billingProductionLike ? "fail" : "skip",
        detail: err instanceof Error ? err.message : "Apple IAP is misconfigured",
      };
      if (billingProductionLike) healthy = false;
    }
  }

  const androidIapEnabled = Boolean(runtimeValues.MOBILE_ANDROID_PRODUCT_INDIVIDUAL);
  const googleIapDetail = runtimeValues.GOOGLE_PLAY_RTDN_AUDIENCE
    ? undefined
    : !androidIapEnabled
      ? "Android IAP product is not configured."
      : billingProductionLike
        ? "GOOGLE_PLAY_RTDN_AUDIENCE missing for production Android IAP webhook verification"
        : "GOOGLE_PLAY_RTDN_AUDIENCE not set";
  checks.googleIap = {
    status: runtimeValues.GOOGLE_PLAY_RTDN_AUDIENCE || !androidIapEnabled
      ? "ok"
      : billingProductionLike
        ? "fail"
        : "skip",
    detail: googleIapDetail,
  };
  if (billingProductionLike && checks.googleIap.status === "fail") healthy = false;

  checks.trialExpiry = {
    status:
      nullTrialExpiry.ok && nullTrialExpiry.value === 0
        ? "ok"
        : billingProductionLike
          ? "fail"
          : "skip",
    detail: nullTrialExpiry.ok
      ? nullTrialExpiry.value === 0
        ? undefined
        : "Free-trial subscriptions with null trialEndsAt are present and are treated as inactive."
      : "Could not audit trial expiry configuration.",
  };

  const productionLike = isProductionLikeRuntime();
  const missingEmailConfig = [
    !runtimeValues.RESEND_API_KEY ? "RESEND_API_KEY" : null,
    !runtimeValues.EMAIL_FROM ? "EMAIL_FROM" : null,
    !(runtimeValues.SUPPORT_EMAIL || runtimeValues.EMAIL_REPLY_TO) ? "SUPPORT_EMAIL or EMAIL_REPLY_TO" : null,
  ].filter(Boolean);
  checks.email = {
    status: missingEmailConfig.length === 0 ? "ok" : productionLike ? "fail" : "skip",
    detail:
      missingEmailConfig.length === 0
        ? undefined
        : `Missing email config: ${missingEmailConfig.join(", ")}`,
  };
  if (productionLike && missingEmailConfig.length > 0) healthy = false;

  const encOk = runtimeValues.FIELD_ENCRYPTION_KEY?.length === 64;
  checks.encryption = {
    status: encOk ? "ok" : "fail",
    detail: encOk ? undefined : "FIELD_ENCRYPTION_KEY missing or wrong length",
  };
  if (!encOk) healthy = false;

  const hasR2 = Boolean(runtimeValues.R2_BUCKET && runtimeValues.R2_ENDPOINT);
  const hasImageDelivery = Boolean(
    runtimeValues.NEXT_PUBLIC_IMGPROXY_URL || runtimeValues.R2_PUBLIC_BASE_URL,
  );
  checks.storage = {
    status: hasR2 ? "ok" : "skip",
    detail: hasR2
      ? hasImageDelivery
        ? "R2 storage configured with public delivery path"
        : "R2 storage configured; image delivery URL not set"
      : "R2 storage not configured",
  };

  const mem = process.memoryUsage();
  const memInfo = {
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
  };
  const seo = await getSeoDiagnostics();

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "unknown",
      uptimeSec: Math.floor(process.uptime()),
      memory: memInfo,
      seo,
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
