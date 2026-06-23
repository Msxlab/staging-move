/**
 * Production startup config validation.
 *
 * Package 4 removed dummy build-time secrets from Dockerfiles, but at
 * runtime the app can still start with critical env vars missing — for
 * example, an Ofelia container restarted with stale env, or a
 * DigitalOcean App Spec that lost a secret during a manual rollback.
 * Without a startup gate, the app silently serves traffic with a
 * fall-through state: USER_JWT_SECRET undefined makes every login fail
 * with an opaque 500, FIELD_ENCRYPTION_KEY missing silently writes
 * un-encrypted data into PII columns.
 *
 * This module computes a structured readiness report from process.env
 * (and a few derived signals like DB connectivity) and a compact summary
 * suitable for a /api/ready endpoint and orchestrator health checks. The
 * goal is to fail clearly and early — the deployment pipeline should
 * never accept traffic until /api/ready returns 200.
 *
 * The module deliberately does NOT throw on import. Production hosts
 * sometimes need a degraded process to come up so an operator can connect
 * with a console; throwing at import time would make that impossible.
 */

import { validateRuntimeConfigValueShape } from "@/lib/shared-runtime-config";
import {
  LEGAL_ENTITY_PLACEHOLDER,
  COMPANY_ADDRESS_PLACEHOLDER,
} from "@/lib/legal-info";

const PROD_ENVS = new Set(["production", "staging"]);
export const READINESS_CONFIG_KEYS = [
  "NODE_ENV",
  "APP_ENV",
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_ADMIN_URL",
  "NEXT_PUBLIC_LEGAL_ENTITY_NAME",
  "NEXT_PUBLIC_COMPANY_ADDRESS",
  "DATABASE_URL",
  "USER_JWT_SECRET",
  "ADMIN_JWT_SECRET",
  "FIELD_ENCRYPTION_KEY",
  "CRON_SECRET",
  "INTERNAL_WEBHOOK_SECRET",
  "IMPERSONATION_HANDOFF_SECRET",
  "QA_RESETTABLE_ACCOUNT_EMAIL",
  "QA_PERSONA_ACCOUNTS",
  "STORE_REVIEW_ACCOUNT_EMAILS",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "RESEND_FROM",
  "MAIL_FROM",
  "EMAIL_REPLY_TO",
  "SUPPORT_EMAIL",
  "ALERT_EMAIL_FROM",
  "ALERT_EMAIL_TO",
  "ADMIN_ALERT_EMAIL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
  "STRIPE_PRICE_INDIVIDUAL_YEARLY",
  "STRIPE_PRICE_FAMILY_MONTHLY",
  "STRIPE_PRICE_FAMILY_YEARLY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
  "STRIPE_ANNUAL_TRIAL_DAYS",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_MAPS_API_KEY",
  "PLACES_AUTOCOMPLETE_ENABLED",
  "PLACES_AUTOCOMPLETE_DAILY_LIMIT",
  "PLACES_AUTOCOMPLETE_DAILY_USER_LIMIT",
  "PLACES_AUTOCOMPLETE_DAILY_IP_LIMIT",
  "PLACES_DETAILS_DAILY_USER_LIMIT",
  "PLACES_DETAILS_DAILY_IP_LIMIT",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "R2_REGION",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_BASE_URL",
  "BACKUP_STORAGE_PROVIDER",
  "BACKUP_STORAGE_BUCKET",
  "BACKUP_STORAGE_REGION",
  "BACKUP_STORAGE_ENDPOINT",
  "BACKUP_STORAGE_ACCESS_KEY_ID",
  "BACKUP_STORAGE_SECRET_ACCESS_KEY",
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_PLAY_OAUTH_CLIENT_ID",
  "GOOGLE_PLAY_OAUTH_CLIENT_SECRET",
  "GOOGLE_PLAY_OAUTH_REFRESH_TOKEN",
  "GOOGLE_PLAY_RTDN_AUDIENCE",
  "APPLE_BUNDLE_ID",
  "APPLE_TEAM_ID",
  "TRUSTED_PROXY_HEADERS",
  "FCC_BDC_ENABLED",
  "FCC_BDC_API_KEY",
  "FCC_BDC_USERNAME",
  "FCC_BDC_API_BASE",
  "ELECTRIC_LOOKUP_ENABLED",
  "OPENEI_API_KEY",
  "AIRNOW_API_KEY",
  "CENSUS_API_KEY",
] as const;

export function getReadinessConfigKeys(): string[] {
  return [...READINESS_CONFIG_KEYS];
}

function isProductionLike(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = (env.APP_ENV || env.VERCEL_ENV || "").toLowerCase();
  if (PROD_ENVS.has(explicit)) return true;
  if (env.NODE_ENV === "production") return true;
  if (env.DIGITALOCEAN_APP_ID) return true;
  return false;
}

function isLocalhostUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return (
    v.includes("localhost") ||
    v.includes("127.0.0.1") ||
    v.includes("0.0.0.0") ||
    v.includes("::1")
  );
}

function isHexKey(value: string | undefined, expectedLength = 64): boolean {
  if (!value) return false;
  return new RegExp(`^[0-9a-fA-F]{${expectedLength}}$`).test(value);
}

function hasMinSecret(value: string | undefined, minLength = 32): boolean {
  if (!value) return false;
  if (value.includes("REPLACE")) return false;
  if (/^(test|dev|dummy|changeme)/i.test(value)) return false;
  return value.length >= minLength;
}

function isEnabledFlag(value: string | undefined): boolean {
  return ["true", "1", "yes", "on"].includes((value || "").trim().toLowerCase());
}

export type ReadinessSeverity = "ok" | "warn" | "fail";

export interface ReadinessIssue {
  key: string;
  severity: ReadinessSeverity;
  message: string;
}

export interface ReadinessReport {
  ready: boolean;
  productionLike: boolean;
  failCount: number;
  warnCount: number;
  issues: ReadinessIssue[];
}

/**
 * Build a readiness report. Pure: reads only `env` and the
 * `productionLike` parameter (defaults to detecting from env). Never
 * touches DB. Callers that want DB readiness should compose this with
 * their own SELECT 1 probe.
 */
export function buildReadinessReport(
  env: NodeJS.ProcessEnv = process.env,
  productionLike: boolean = isProductionLike(env),
  effectiveConfig: Record<string, string | null | undefined> = {},
): ReadinessReport {
  const issues: ReadinessIssue[] = [];
  const readConfig = (key: string): string | undefined => {
    if (Object.prototype.hasOwnProperty.call(effectiveConfig, key)) {
      return effectiveConfig[key] || undefined;
    }
    return env[key];
  };

  function fail(key: string, message: string) {
    issues.push({ key, severity: productionLike ? "fail" : "warn", message });
  }

  function warn(key: string, message: string) {
    issues.push({ key, severity: "warn", message });
  }

  const userJwtSecret = readConfig("USER_JWT_SECRET");
  const adminJwtSecret = readConfig("ADMIN_JWT_SECRET");
  const fieldEncryptionKey = readConfig("FIELD_ENCRYPTION_KEY");
  const cronSecret = readConfig("CRON_SECRET");
  const internalWebhookSecret = readConfig("INTERNAL_WEBHOOK_SECRET");
  const impersonationHandoffSecret = readConfig("IMPERSONATION_HANDOFF_SECRET");
  const databaseUrl = readConfig("DATABASE_URL");
  const upstashRedisRestUrl = readConfig("UPSTASH_REDIS_REST_URL");
  const upstashRedisRestToken = readConfig("UPSTASH_REDIS_REST_TOKEN");

  // ── Auth / session secrets ───────────────────────────────────
  if (!hasMinSecret(userJwtSecret)) {
    fail("USER_JWT_SECRET", "USER_JWT_SECRET must be set and at least 32 characters in production.");
  }
  if (!hasMinSecret(adminJwtSecret)) {
    fail("ADMIN_JWT_SECRET", "ADMIN_JWT_SECRET must be set and at least 32 characters in production.");
  }
  if (env.SESSION_SECRET !== undefined && !hasMinSecret(env.SESSION_SECRET)) {
    warn("SESSION_SECRET", "SESSION_SECRET is set but too short; remove it or rotate to ≥32 chars.");
  }

  // ── Field encryption key (256-bit hex) ───────────────────────
  if (!fieldEncryptionKey) {
    fail(
      "FIELD_ENCRYPTION_KEY",
      "FIELD_ENCRYPTION_KEY must be a 64-character hex string in production. Encrypted columns will fail without it.",
    );
  } else if (!isHexKey(fieldEncryptionKey, 64)) {
    fail(
      "FIELD_ENCRYPTION_KEY",
      "FIELD_ENCRYPTION_KEY is set but is not a 64-character hex string (256-bit key).",
    );
  }

  // ── Cron / internal webhook / impersonation secrets ──────────
  if (!hasMinSecret(cronSecret)) {
    fail("CRON_SECRET", "CRON_SECRET must be set and at least 32 characters in production.");
  }
  if (!hasMinSecret(internalWebhookSecret)) {
    // Required-in-production per the runtime-config catalog. Without
    // it, server-to-server internal webhook routes reject every call,
    // breaking IP-rule cache refresh, security event fan-out, and
    // rate-limit log shipping.
    fail(
      "INTERNAL_WEBHOOK_SECRET",
      "INTERNAL_WEBHOOK_SECRET must be set and at least 32 characters in production. Required independently from CRON_SECRET.",
    );
  }
  if (!hasMinSecret(impersonationHandoffSecret)) {
    // Required-in-production per the runtime-config catalog. Guards
    // the admin → web impersonation handoff endpoint; missing in
    // production disables the impersonation flow entirely.
    fail(
      "IMPERSONATION_HANDOFF_SECRET",
      "IMPERSONATION_HANDOFF_SECRET must be set and at least 32 characters in production. Required independently from CRON_SECRET and INTERNAL_WEBHOOK_SECRET.",
    );
  }

  // ── Database ─────────────────────────────────────────────────
  if (!databaseUrl) {
    fail("DATABASE_URL", "DATABASE_URL must be set.");
  } else if (productionLike && isLocalhostUrl(databaseUrl)) {
    fail(
      "DATABASE_URL",
      "DATABASE_URL points to localhost in a production-like environment.",
    );
  }

  // ── Redis (rate-limit / step-up store) ───────────────────────
  if (productionLike) {
    if (!upstashRedisRestUrl || !upstashRedisRestToken) {
      fail(
        "UPSTASH_REDIS",
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured in production for rate limiting and shared step-up state.",
      );
    } else if (
      upstashRedisRestUrl.includes("REPLACE") ||
      upstashRedisRestToken.includes("REPLACE")
    ) {
      fail(
        "UPSTASH_REDIS",
        "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN still contains a placeholder value.",
      );
    }
  }

  // ── Public URLs ──────────────────────────────────────────────
  const publicUrls: Array<[string, string | undefined]> = [
    ["APP_URL", readConfig("APP_URL")],
    ["NEXT_PUBLIC_APP_URL", readConfig("NEXT_PUBLIC_APP_URL")],
    ["NEXT_PUBLIC_ADMIN_URL", readConfig("NEXT_PUBLIC_ADMIN_URL")],
  ];
  for (const [key, value] of publicUrls) {
    if (productionLike && !value) {
      fail(key, `${key} must be set in a production-like environment.`);
    } else if (productionLike && value && isLocalhostUrl(value)) {
      fail(key, `${key} must not point to localhost in a production-like environment.`);
    } else if (productionLike && value) {
      const validation = validateRuntimeConfigValueShape(key, value);
      if (!validation.ok) {
        fail(key, `${key} is invalid: ${validation.reason}.`);
      }
    }
  }

  // ── Debug / dev modes ────────────────────────────────────────
  const requiredEmailKeys = ["RESEND_API_KEY", "SUPPORT_EMAIL"] as const;
  for (const key of requiredEmailKeys) {
    const value = readConfig(key);
    if (!value) {
      fail(key, `${key} must be configured for production email delivery.`);
      continue;
    }
    const validation = validateRuntimeConfigValueShape(key, value);
    if (!validation.ok) fail(key, `${key} is invalid: ${validation.reason}.`);
  }
  const emailFrom = readConfig("EMAIL_FROM") || readConfig("RESEND_FROM") || readConfig("MAIL_FROM");
  if (!emailFrom) {
    fail("EMAIL_FROM", "EMAIL_FROM, RESEND_FROM, or MAIL_FROM must be configured for production email delivery.");
  } else {
    const validation = validateRuntimeConfigValueShape("EMAIL_FROM", emailFrom);
    if (!validation.ok) fail("EMAIL_FROM", `EMAIL_FROM is invalid: ${validation.reason}.`);
  }
  for (const key of ["EMAIL_REPLY_TO", "ALERT_EMAIL_FROM", "ALERT_EMAIL_TO", "ADMIN_ALERT_EMAIL"] as const) {
    const value = readConfig(key);
    if (!value) continue;
    const validation = validateRuntimeConfigValueShape(key, value);
    if (!validation.ok) fail(key, `${key} is invalid: ${validation.reason}.`);
  }

  for (const key of [
    "QA_RESETTABLE_ACCOUNT_EMAIL",
    "QA_PERSONA_ACCOUNTS",
    "STORE_REVIEW_ACCOUNT_EMAILS",
  ] as const) {
    const value = readConfig(key);
    if (!value) continue;
    const validation = validateRuntimeConfigValueShape(key, value, { productionLike });
    if (!validation.ok) fail(key, `${key} is invalid: ${validation.reason}.`);
  }

  const requiredStripeKeys = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
    "STRIPE_PRICE_INDIVIDUAL_YEARLY",
    "STRIPE_PRICE_FAMILY_MONTHLY",
    "STRIPE_PRICE_FAMILY_YEARLY",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_PRO_YEARLY",
  ] as const;
  for (const key of requiredStripeKeys) {
    const value = readConfig(key);
    if (!value) {
      fail(key, `${key} must be configured for production billing.`);
      continue;
    }
    const validation = validateRuntimeConfigValueShape(key, value);
    if (!validation.ok) fail(key, `${key} is invalid: ${validation.reason}.`);
  }
  const annualTrialDays = readConfig("STRIPE_ANNUAL_TRIAL_DAYS");
  if (annualTrialDays) {
    const validation = validateRuntimeConfigValueShape("STRIPE_ANNUAL_TRIAL_DAYS", annualTrialDays);
    if (!validation.ok) fail("STRIPE_ANNUAL_TRIAL_DAYS", `STRIPE_ANNUAL_TRIAL_DAYS is invalid: ${validation.reason}.`);
  }

  const placesEnabled = (readConfig("PLACES_AUTOCOMPLETE_ENABLED") || "true").toLowerCase() !== "false";
  if (placesEnabled && !readConfig("GOOGLE_MAPS_API_KEY")) {
    fail("GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_API_KEY must be configured with a server-side Places Web Service key when Places autocomplete is enabled.");
  }
  for (const key of [
    "PLACES_AUTOCOMPLETE_ENABLED",
    "PLACES_AUTOCOMPLETE_DAILY_LIMIT",
    "PLACES_AUTOCOMPLETE_DAILY_USER_LIMIT",
    "PLACES_AUTOCOMPLETE_DAILY_IP_LIMIT",
    "PLACES_DETAILS_DAILY_USER_LIMIT",
    "PLACES_DETAILS_DAILY_IP_LIMIT",
  ] as const) {
    const value = readConfig(key);
    if (!value) continue;
    const validation = validateRuntimeConfigValueShape(key, value);
    if (!validation.ok) fail(key, `${key} is invalid: ${validation.reason}.`);
  }

  const googleOAuthId = readConfig("GOOGLE_OAUTH_CLIENT_ID");
  const googleOAuthSecret = readConfig("GOOGLE_OAUTH_CLIENT_SECRET");
  if (googleOAuthId || googleOAuthSecret) {
    if (!googleOAuthId) fail("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID is required when Google OAuth is enabled.");
    if (!googleOAuthSecret) fail("GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET is required when Google OAuth is enabled.");
  }

  const configuredR2Keys = [
    "R2_BUCKET",
    "R2_ENDPOINT",
    "R2_REGION",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_PUBLIC_BASE_URL",
  ] as const;
  if (configuredR2Keys.some((key) => Boolean(readConfig(key)))) {
    for (const key of ["R2_BUCKET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const) {
      if (!readConfig(key)) fail(key, `${key} is required when R2 asset storage is configured.`);
    }
  }

  const configuredBackupKeys = [
    "BACKUP_STORAGE_PROVIDER",
    "BACKUP_STORAGE_BUCKET",
    "BACKUP_STORAGE_REGION",
    "BACKUP_STORAGE_ENDPOINT",
    "BACKUP_STORAGE_ACCESS_KEY_ID",
    "BACKUP_STORAGE_SECRET_ACCESS_KEY",
  ] as const;
  if (configuredBackupKeys.some((key) => Boolean(readConfig(key)))) {
    for (const key of ["BACKUP_STORAGE_PROVIDER", "BACKUP_STORAGE_BUCKET", "BACKUP_STORAGE_ACCESS_KEY_ID", "BACKUP_STORAGE_SECRET_ACCESS_KEY"] as const) {
      if (!readConfig(key)) fail(key, `${key} is required when backup storage is configured.`);
    }
  }

  // ── Mobile in-app purchase store identity ────────────────────
  // When mobile billing is live the store identity keys must be present, or
  // server-side purchase validation and store-webhook verification silently
  // break. Gate on "any key configured" (same shape as R2/backup) so a non-mobile
  // deploy is unaffected, but a partially-configured one fails fast.
  const googlePlayIapKeys = [
    "GOOGLE_PLAY_PACKAGE_NAME",
    "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_PLAY_OAUTH_CLIENT_ID",
    "GOOGLE_PLAY_OAUTH_REFRESH_TOKEN",
    "GOOGLE_PLAY_RTDN_AUDIENCE",
  ] as const;
  if (googlePlayIapKeys.some((key) => Boolean(readConfig(key)))) {
    for (const key of ["GOOGLE_PLAY_PACKAGE_NAME", "GOOGLE_PLAY_RTDN_AUDIENCE"] as const) {
      if (!readConfig(key)) {
        fail(key, `${key} is required when Google Play in-app purchases are configured (mobile billing is live).`);
      }
    }
    const hasServiceAccountAuth =
      Boolean(readConfig("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL")) &&
      Boolean(readConfig("GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY"));
    const hasOauthFallbackAuth =
      Boolean(readConfig("GOOGLE_PLAY_OAUTH_CLIENT_ID")) &&
      Boolean(readConfig("GOOGLE_PLAY_OAUTH_REFRESH_TOKEN"));
    if (!hasServiceAccountAuth && !hasOauthFallbackAuth) {
      fail(
        "GOOGLE_PLAY_AUTH",
        "Google Play purchase validation needs either service-account auth (GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL + GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY) or OAuth fallback auth (GOOGLE_PLAY_OAUTH_CLIENT_ID + GOOGLE_PLAY_OAUTH_REFRESH_TOKEN).",
      );
    }
  }
  // The App Store Server Notification handler fails closed in production without
  // APPLE_BUNDLE_ID; surface it at readiness when the iOS app is otherwise
  // configured (APPLE_TEAM_ID present) so a billing-live deploy that lost the
  // value is caught before the first webhook rather than after.
  if (productionLike && readConfig("APPLE_TEAM_ID") && !readConfig("APPLE_BUNDLE_ID")) {
    warn(
      "APPLE_BUNDLE_ID",
      "APPLE_BUNDLE_ID is unset while APPLE_TEAM_ID is configured; the App Store webhook rejects all notifications without it.",
    );
  }

  if (productionLike) {
    const trustedProxyHeaders = (readConfig("TRUSTED_PROXY_HEADERS") || "").trim().toLowerCase();
    if (!trustedProxyHeaders || trustedProxyHeaders === "auto" || trustedProxyHeaders === "compat") {
      fail(
        "TRUSTED_PROXY_HEADERS",
        "TRUSTED_PROXY_HEADERS must be set explicitly in production (cloudflare, vercel, standard, or none). Unset/compat trusts client-supplied cf-connecting-ip/x-real-ip/x-forwarded-for, letting clients spoof their source IP and defeat IP rules, per-IP login lockout, and audit accuracy.",
      );
    } else if (
      ![
        "none",
        "false",
        "0",
        "off",
        "vercel",
        "cloudflare",
        "cf",
        "standard",
        "true",
        "1",
        "on",
      ].includes(trustedProxyHeaders)
    ) {
      fail(
        "TRUSTED_PROXY_HEADERS",
        "TRUSTED_PROXY_HEADERS has an unknown value (would fall back to compat header precedence). Set one of: cloudflare, vercel, standard, none.",
      );
    }

    if ((env.NEXT_PUBLIC_DEBUG || "").toLowerCase() === "true") {
      warn("NEXT_PUBLIC_DEBUG", "NEXT_PUBLIC_DEBUG=true in production-like environment.");
    }
    if ((env.ALLOW_PRODUCTION_REPLACE_RESTORE || "").toLowerCase() === "true") {
      warn(
        "ALLOW_PRODUCTION_REPLACE_RESTORE",
        "ALLOW_PRODUCTION_REPLACE_RESTORE=true: production REPLACE backup restore is unlocked. Disable when not actively restoring.",
      );
    }
  }

  const fccEnabled = isEnabledFlag(readConfig("FCC_BDC_ENABLED"));
  const fccApiKey = readConfig("FCC_BDC_API_KEY");
  const fccUsername = readConfig("FCC_BDC_USERNAME");
  if (fccEnabled && !fccApiKey) {
    warn(
      "FCC_BDC_API_KEY",
      "FCC_BDC_ENABLED=true but FCC_BDC_API_KEY is missing; ISP recommendations fall back to catalog-only availability.",
    );
  }
  if (fccEnabled && fccApiKey && !fccUsername) {
    warn(
      "FCC_BDC_USERNAME",
      "FCC_BDC_API_KEY is configured without FCC_BDC_USERNAME; the documented FCC header auth may fail, so ISP confirmation may fall back to catalog data.",
    );
  }
  if (!fccEnabled && fccApiKey) {
    warn(
      "FCC_BDC_ENABLED",
      "FCC_BDC_API_KEY is present but FCC_BDC_ENABLED is not true; confirmed ISP serviceability will not run.",
    );
  }

  const electricEnabled = isEnabledFlag(readConfig("ELECTRIC_LOOKUP_ENABLED"));
  const openeiApiKey = readConfig("OPENEI_API_KEY");
  if (electricEnabled && !openeiApiKey) {
    warn(
      "OPENEI_API_KEY",
      "ELECTRIC_LOOKUP_ENABLED=true but OPENEI_API_KEY is missing; electric recommendations fall back to catalog-only availability.",
    );
  }
  if (!electricEnabled && openeiApiKey) {
    warn(
      "ELECTRIC_LOOKUP_ENABLED",
      "OPENEI_API_KEY is present but ELECTRIC_LOOKUP_ENABLED is not true; confirmed electric-utility serviceability will not run.",
    );
  }

  if (productionLike && !readConfig("AIRNOW_API_KEY")) {
    warn(
      "AIRNOW_API_KEY",
      "AIRNOW_API_KEY is unset; the dossier air-quality section will return not_configured while the rest of the dossier continues.",
    );
  }
  if (productionLike && !readConfig("CENSUS_API_KEY")) {
    warn(
      "CENSUS_API_KEY",
      "CENSUS_API_KEY is unset; Pro neighborhood economics will return not_configured while the rest of the dossier continues.",
    );
  }

  // ── Legal entity identity (FTC / consumer-protection hygiene) ─
  // Policy pages, billing receipts, and store-required legal disclosures
  // need a real legal entity name and mailing address. Shipping the
  // placeholders to production-like environments means users see unfinished
  // "[... to be finalized]" text where binding legal identity is expected.
  // These values come from the business; fail readiness rather than launch
  // with placeholders. (legal-info.ts resolves these from
  // NEXT_PUBLIC_LEGAL_ENTITY_NAME / NEXT_PUBLIC_COMPANY_ADDRESS.)
  // Read from the report's `env` argument (not the module-frozen LEGAL_INFO),
  // so readiness reflects the environment under inspection — mirrors how
  // legal-info.ts resolves these (trim + fall back to the placeholder).
  const legalEntityName = env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() || LEGAL_ENTITY_PLACEHOLDER;
  const companyAddress = env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() || COMPANY_ADDRESS_PLACEHOLDER;
  if (legalEntityName === LEGAL_ENTITY_PLACEHOLDER) {
    fail(
      "NEXT_PUBLIC_LEGAL_ENTITY_NAME",
      "NEXT_PUBLIC_LEGAL_ENTITY_NAME is unset, so the legal entity name still shows the placeholder on policy and billing pages. Set the finalized legal entity name before production launch.",
    );
  }
  if (companyAddress === COMPANY_ADDRESS_PLACEHOLDER) {
    fail(
      "NEXT_PUBLIC_COMPANY_ADDRESS",
      "NEXT_PUBLIC_COMPANY_ADDRESS is unset, so the company mailing address still shows the placeholder on policy and billing pages. Set the finalized mailing address before production launch.",
    );
  }

  const failCount = issues.filter((i) => i.severity === "fail").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;

  return {
    ready: failCount === 0,
    productionLike,
    failCount,
    warnCount,
    issues,
  };
}

/**
 * Return a small, safe summary of the readiness report — never includes
 * secret values, just key names and severity. Suitable for /api/ready.
 */
export function summarizeReadinessForResponse(report: ReadinessReport) {
  return {
    ready: report.ready,
    productionLike: report.productionLike,
    failures: report.issues.filter((i) => i.severity === "fail").map((i) => ({ key: i.key, message: i.message })),
    warnings: report.issues.filter((i) => i.severity === "warn").map((i) => ({ key: i.key, message: i.message })),
  };
}
