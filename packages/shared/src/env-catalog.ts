/**
 * Canonical EXPECTED-ENV catalog (env-readiness, audit F-006).
 *
 * The owner sets EVERY environment variable in DigitalOcean (the App Spec),
 * NOT via a local `.env` file. That makes a silent misconfiguration easy: a
 * DO deploy can come up missing a required secret or a feature-activation
 * flag and nobody notices until a user hits a broken flow. The system audit
 * (F-006) found 35 keys read in code but undocumented and 28 runtime-config
 * keys not surfaced anywhere an operator can glance at.
 *
 * This module is the single typed source of truth for "what env does
 * LocateFlow expect, and what does each key do". It is deliberately broader
 * than `runtime-config.ts`: that catalog models DB-backed / rotatable managed
 * config with a rich resolution model, whereas THIS catalog answers the much
 * simpler operational question — for every key the app reads, is it
 * REQUIRED (app is broken without it), OPTIONAL (a feature degrades
 * gracefully when unset), or PLATFORM (injected by the host; never flagged)?
 *
 * HARD RULE: nothing in this module ever returns, logs, or masks a way back
 * to a secret VALUE. The readiness evaluator reports presence/absence only,
 * plus an optional non-reversible masked hint (e.g. `re_***1a2b`) so an
 * operator can sanity-check WHICH value is set without the value leaking.
 */

import { maskRuntimeConfigValue, type RuntimeConfigMaskStrategy } from "./runtime-config";

/**
 * Classification of an expected env key.
 *
 * - `required`: the app (or a core, always-on subsystem) is broken in
 *   production without it. Missing-in-production is a hard readiness failure
 *   and is loud in the startup warn-log.
 * - `optional`: a feature/integration that degrades gracefully when unset.
 *   These are the "activation flags" an operator flips on (ANTHROPIC_API_KEY,
 *   DAILY_DIGEST_ENABLED, FCC_BDC_*, push, security alerts, store IAP, OAuth,
 *   the Stripe price IDs, etc.). Never a readiness failure when absent.
 * - `platform`: injected by the deployment platform / runtime (NODE_ENV,
 *   VERCEL_ENV, NEXT_RUNTIME, DIGITALOCEAN_APP_ID). Surfaced for context but
 *   NEVER flagged as missing — the operator does not set these by hand.
 */
export type EnvKeyClassification = "required" | "optional" | "platform";

/** Which app(s) read this key. Used only for grouping/labels in the admin view. */
export type EnvKeyApp = "web" | "admin" | "mobile" | "shared";

export interface ExpectedEnvKey {
  key: string;
  classification: EnvKeyClassification;
  /** Short human label for the admin glance view. */
  label: string;
  /** One-line description of what breaks / what activates. */
  description: string;
  /** Apps that read this key (display grouping only). */
  apps: readonly EnvKeyApp[];
  /**
   * True when the value is a credential/secret. The readiness evaluator
   * still only reports present/absent + a masked hint — but secret keys are
   * masked more aggressively and never echo length/charset beyond the hint.
   */
  isSecret: boolean;
  /** Mask strategy reused from runtime-config for the present-hint. */
  maskStrategy: RuntimeConfigMaskStrategy;
  /**
   * Optional sibling keys that satisfy the same requirement. When ANY of
   * `key` or `aliases` is present the requirement is met (e.g. EMAIL_FROM
   * is satisfied by RESEND_FROM or MAIL_FROM). Lets the catalog mirror the
   * real fallback chains in code without false "missing required" alarms.
   */
  aliases?: readonly string[];
  /** Free-form operator note (activation prerequisite, gotcha, etc.). */
  note?: string;
}

/**
 * The catalog. Grounded in:
 *  - reports/system-audit-2026-06-08/env-inventory.md (the drift list)
 *  - packages/shared/src/runtime-config.ts (the managed-config catalog)
 *  - direct `process.env.*` read sites in apps/web + apps/admin
 *
 * Ordering: required first (by subsystem), then optional/feature-flag, then
 * platform. The admin view re-groups by classification, so order here is for
 * human readability of the source only.
 */
export const EXPECTED_ENV_KEYS: readonly ExpectedEnvKey[] = [
  // ─────────────────────────────────────────────────────────────
  // REQUIRED — app broken without it
  // ─────────────────────────────────────────────────────────────

  // Core auth / session / crypto secrets
  {
    key: "USER_JWT_SECRET",
    classification: "required",
    label: "User JWT Secret",
    description: "Signs user web + mobile sessions. Every login fails (opaque 500s) without it.",
    apps: ["web", "mobile"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Minimum 32 characters.",
  },
  {
    key: "ADMIN_JWT_SECRET",
    classification: "required",
    label: "Admin JWT Secret",
    description: "Signs admin sessions. Admin panel login fails without it.",
    apps: ["admin", "web"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Minimum 32 characters. Also the default fallback for ADMIN_ACTION_OTP_SECRET / ADMIN_SESSION_HANDLE_SECRET.",
  },
  {
    key: "FIELD_ENCRYPTION_KEY",
    classification: "required",
    label: "Field Encryption Key",
    description: "AES key for encrypted PII columns. Missing silently writes un-encrypted PII.",
    apps: ["web", "admin"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Exactly 64 hex characters (256-bit).",
  },
  {
    key: "CRON_SECRET",
    classification: "required",
    label: "Cron Secret",
    description: "Bearer secret protecting scheduled cron jobs (/api/cron/*). Crons reject without it.",
    apps: ["web", "admin"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Minimum 32 characters.",
  },
  {
    key: "INTERNAL_WEBHOOK_SECRET",
    classification: "required",
    label: "Internal Webhook Secret",
    description: "Guards server-to-server internal webhooks (IP-rule refresh, security-event fan-out).",
    apps: ["web", "admin"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Minimum 32 characters. Required independently from CRON_SECRET.",
  },
  {
    key: "IMPERSONATION_HANDOFF_SECRET",
    classification: "required",
    label: "Impersonation Handoff Secret",
    description: "Guards the admin→web impersonation handoff endpoint.",
    apps: ["web", "admin"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Minimum 32 characters. Required independently from CRON / internal-webhook secrets.",
  },

  // Database
  {
    key: "DATABASE_URL",
    classification: "required",
    label: "Database URL",
    description: "Prisma connection URL. Nothing works without it.",
    apps: ["web", "admin"],
    isSecret: true,
    maskStrategy: "url",
  },

  // Redis (rate limiting + shared step-up state)
  {
    key: "UPSTASH_REDIS_REST_URL",
    classification: "required",
    label: "Upstash Redis URL",
    description: "Redis endpoint for production rate limiting and shared step-up state.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "url",
  },
  {
    key: "UPSTASH_REDIS_REST_TOKEN",
    classification: "required",
    label: "Upstash Redis Token",
    description: "Auth token for Upstash Redis.",
    apps: ["web", "admin"],
    isSecret: true,
    maskStrategy: "secret",
  },

  // Canonical URLs
  {
    key: "APP_URL",
    classification: "required",
    label: "Canonical App URL",
    description: "Server-side canonical URL for billing redirects and backend-generated links.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "url",
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    classification: "required",
    label: "Public App URL",
    description: "Public URL for redirects, emails, and links. Build-time public value.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "url",
  },
  {
    key: "NEXT_PUBLIC_ADMIN_URL",
    classification: "required",
    label: "Public Admin URL",
    description: "Canonical public URL for the admin app. Build-time public value.",
    apps: ["admin", "web"],
    isSecret: false,
    maskStrategy: "url",
  },

  // Billing (Stripe) — required to take payments in production
  {
    key: "STRIPE_SECRET_KEY",
    classification: "required",
    label: "Stripe Secret Key",
    description: "Server-side Stripe key for checkout, portal, and recurring billing.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    classification: "required",
    label: "Stripe Webhook Secret",
    description: "Verifies Stripe subscription event webhooks.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    classification: "required",
    label: "Stripe Publishable Key",
    description: "Browser-safe Stripe publishable key for Checkout.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "id",
  },

  // Email (Resend) — required for transactional delivery
  {
    key: "RESEND_API_KEY",
    classification: "required",
    label: "Resend API Key",
    description: "Transactional email delivery key. No emails send without it.",
    apps: ["web", "admin"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "EMAIL_FROM",
    classification: "required",
    label: "Email From",
    description: "Sender identity for transactional emails.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "plain",
    aliases: ["RESEND_FROM", "MAIL_FROM"],
    note: "Satisfied by any of EMAIL_FROM / RESEND_FROM / MAIL_FROM (real code fallback chain).",
  },
  {
    key: "SUPPORT_EMAIL",
    classification: "required",
    label: "Support Email",
    description: "Public support mailbox used in email footers, legal pages, and support flows.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "email",
  },

  // Maps / Places — required because address autocomplete is on by default
  {
    key: "GOOGLE_MAPS_API_KEY",
    classification: "required",
    label: "Google Maps API Key",
    description: "Server-side Places/Maps key for address autocomplete + details. Onboarding needs it.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Only strictly required while PLACES_AUTOCOMPLETE_ENABLED is not 'false' (the default).",
  },

  // Asset storage (R2/S3) — required for uploads, logos, OCR originals
  {
    key: "R2_ENDPOINT",
    classification: "required",
    label: "R2 / S3 Endpoint",
    description: "S3-compatible endpoint for primary file storage.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "url",
  },
  {
    key: "R2_BUCKET",
    classification: "required",
    label: "R2 / S3 Bucket",
    description: "Bucket for user uploads, provider logos, and document OCR originals.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "R2_ACCESS_KEY_ID",
    classification: "required",
    label: "R2 / S3 Access Key ID",
    description: "Access key ID for the storage bucket.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "id",
  },
  {
    key: "R2_SECRET_ACCESS_KEY",
    classification: "required",
    label: "R2 / S3 Secret Access Key",
    description: "Secret access key paired with R2_ACCESS_KEY_ID.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "IMGPROXY_KEY",
    classification: "required",
    label: "imgproxy Signing Key",
    description: "HEX key to HMAC-sign imgproxy URLs. Images break without it.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "IMGPROXY_SALT",
    classification: "required",
    label: "imgproxy Signing Salt",
    description: "HEX salt paired with IMGPROXY_KEY.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "NEXT_PUBLIC_IMGPROXY_URL",
    classification: "required",
    label: "imgproxy Public URL",
    description: "Public host the browser loads transformed images from.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "url",
  },

  // ─────────────────────────────────────────────────────────────
  // OPTIONAL / FEATURE-FLAG — degrades gracefully when unset.
  // These are the activation switches an operator flips on in DO.
  // ─────────────────────────────────────────────────────────────

  // AI move briefing (gated)
  {
    key: "ANTHROPIC_API_KEY",
    classification: "optional",
    label: "Anthropic API Key",
    description: "Activates the LLM-generated move briefing. Falls back to a rule-based summary when unset.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Optional. Only coarse, non-PII move signals are ever sent to the API.",
  },
  {
    key: "OPENAI_API_KEY",
    classification: "optional",
    label: "OpenAI API Key",
    description: "Alternate server-side AI provider key. Optional.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },

  // Daily digest rollup
  {
    key: "DAILY_DIGEST_ENABLED",
    classification: "optional",
    label: "Daily Digest Enabled",
    description: "Turns on the daily reminder rollup digest. Inert (off) when unset.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Set to 'true' to enable.",
  },

  // FCC ISP serviceability
  {
    key: "FCC_BDC_ENABLED",
    classification: "optional",
    label: "FCC ISP Serviceability Enabled",
    description: "Master flag for FCC broadband availability lookups. Recommendations fall back gracefully when off.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Requires FCC_BDC_API_KEY to take effect.",
  },
  {
    key: "FCC_BDC_API_KEY",
    classification: "optional",
    label: "FCC BDC API Key",
    description: "FCC National Broadband Map token. Without it, FCC serviceability stays disabled.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "FCC_BDC_API_BASE",
    classification: "optional",
    label: "FCC BDC API Base URL",
    description: "Override for the FCC BDC endpoint. Defaults to the documented public host.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "url",
  },

  // Push notifications
  {
    key: "NOTIFICATION_PUSH_ENABLED",
    classification: "optional",
    label: "Push Notifications Enabled",
    description: "Enables push dispatch. In-app + email still work when off.",
    apps: ["web", "admin", "mobile"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Set to 'true' to enable.",
  },

  // Security alert sink
  {
    key: "SECURITY_ALERTS_ENABLED",
    classification: "optional",
    label: "Security Alerts Enabled",
    description: "Installs the security-event alert sink at startup. Fully inert when off.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Set to 'true' to enable. Pairs with SECURITY_ALERT_WEBHOOK_URL / SLACK_WEBHOOK_URL.",
  },
  {
    key: "SECURITY_ALERT_WEBHOOK_URL",
    classification: "optional",
    label: "Security Alert Webhook URL",
    description: "Destination webhook for security alerts.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "url",
  },
  {
    key: "SLACK_WEBHOOK_URL",
    classification: "optional",
    label: "Slack Webhook URL",
    description: "Delivers security/operational alerts into Slack.",
    apps: ["admin"],
    isSecret: true,
    maskStrategy: "url",
  },

  // Connector launch + guided partners
  {
    key: "FEATURE_API_CONNECTORS",
    classification: "optional",
    label: "API Connectors Enabled",
    description: "Master launch switch for partner address-update connectors. Keep off until legal sign-off.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Legally gated — keep disabled until partner/legal approval.",
  },
  {
    key: "GUIDED_PARTNERS",
    classification: "optional",
    label: "Guided Partner Catalog",
    description: "Optional JSON array of guided-update partners shown in Connections.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "WORKSPACE_MODEL_ENABLED",
    classification: "optional",
    label: "Workspace / Household Model Enabled",
    description: "Opens the Family/Pro multi-member workspace surface. Single-user path when off.",
    apps: ["web", "admin", "mobile"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Run the workspace backfill before enabling.",
  },
  {
    key: "RECOMMENDATION_SCORING_WEIGHTS",
    classification: "optional",
    label: "Recommendation Scoring Weights",
    description: "Optional JSON overriding provider-recommendation scoring weights. Defaults used when unset.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },

  // COPPA age gate
  {
    key: "COPPA_AGE_GATE_ENABLED",
    classification: "optional",
    label: "COPPA Age Gate Enabled",
    description: "Turns on the minimum-age gate at registration. Inert when unset.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },

  // Places tuning (optional caps; autocomplete on by default)
  {
    key: "PLACES_AUTOCOMPLETE_ENABLED",
    classification: "optional",
    label: "Places Autocomplete Enabled",
    description: "Set 'false' to disable Places autocomplete without redeploying. Defaults on.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "PLACES_AUTOCOMPLETE_DAILY_LIMIT",
    classification: "optional",
    label: "Places Autocomplete Daily Limit",
    description: "Global daily cap for Places autocomplete calls.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },

  // Email reply-to / alert routing (optional refinements)
  {
    key: "EMAIL_REPLY_TO",
    classification: "optional",
    label: "Email Reply-To",
    description: "Reply-to address for transactional/support emails.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "email",
  },
  {
    key: "ADMIN_ALERT_EMAIL",
    classification: "optional",
    label: "Admin Alert Email",
    description: "Recipient for scheduled admin operational digests.",
    apps: ["admin"],
    isSecret: false,
    maskStrategy: "email",
  },
  {
    key: "ALERT_EMAIL_TO",
    classification: "optional",
    label: "Alert Email Recipients",
    description: "Comma-separated recipients for security alerts.",
    apps: ["admin"],
    isSecret: false,
    maskStrategy: "email",
  },

  // Error monitoring
  {
    key: "NEXT_PUBLIC_SENTRY_DSN",
    classification: "optional",
    label: "Sentry DSN",
    description: "Error-monitoring DSN. Errors still surface in logs when unset.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "url",
  },

  // Drift-list operational secrets (have safe fallbacks → optional)
  {
    key: "ACCOUNT_RESTORE_SECRET",
    classification: "optional",
    label: "Account Restore Secret",
    description: "Dedicated secret for signed account-restore links. Falls back to a derived secret when unset.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Optional but recommended in production; set a dedicated value rather than relying on the fallback.",
  },
  {
    key: "ADMIN_ACTION_OTP_SECRET",
    classification: "optional",
    label: "Admin Action OTP Secret",
    description: "Signs admin hard-delete / sensitive-action OTPs. Falls back to ADMIN_JWT_SECRET when unset.",
    apps: ["admin"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Optional; defaults to ADMIN_JWT_SECRET. Set a dedicated value for key separation.",
  },
  {
    key: "ADMIN_SESSION_HANDLE_SECRET",
    classification: "optional",
    label: "Admin Session Handle Secret",
    description: "Signs admin session handles. Falls back to JWT_SECRET / AUTH_SECRET when unset.",
    apps: ["admin"],
    isSecret: true,
    maskStrategy: "secret",
    aliases: ["JWT_SECRET", "AUTH_SECRET"],
    note: "Optional; set a dedicated value for key separation.",
  },
  {
    key: "AFFILIATE_POSTBACK_SECRET",
    classification: "optional",
    label: "Affiliate Postback Secret",
    description: "Default secret verifying affiliate postback callbacks. Per-network secrets can override.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Only needed when affiliate postbacks are in use.",
  },
  {
    key: "ADMIN_APP_URL",
    classification: "optional",
    label: "Admin App URL (server)",
    description: "Server-side admin URL used for team-invite links. Falls back to NEXT_PUBLIC_ADMIN_URL.",
    apps: ["admin"],
    isSecret: false,
    maskStrategy: "url",
    aliases: ["NEXT_PUBLIC_ADMIN_URL"],
  },

  // Mobile store IAP / OAuth (optional — only when store purchases are live)
  {
    key: "GOOGLE_PLAY_OAUTH_CLIENT_ID",
    classification: "optional",
    label: "Google Play OAuth Client ID",
    description: "Used with the refresh token when service-account key creation is blocked by policy.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "id",
  },
  {
    key: "GOOGLE_PLAY_OAUTH_CLIENT_SECRET",
    classification: "optional",
    label: "Google Play OAuth Client Secret",
    description: "OAuth client secret for refreshing Android Publisher API tokens.",
    apps: ["web", "mobile"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "GOOGLE_PLAY_OAUTH_REFRESH_TOKEN",
    classification: "optional",
    label: "Google Play OAuth Refresh Token",
    description: "Offline refresh token for Android Publisher API when key auth is unavailable.",
    apps: ["web", "mobile"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "GOOGLE_OAUTH_CLIENT_ID",
    classification: "optional",
    label: "Google OAuth Client ID",
    description: "Activates 'Sign in with Google'. Sign-in option hidden when unset.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "id",
  },
  {
    key: "GOOGLE_OAUTH_CLIENT_SECRET",
    classification: "optional",
    label: "Google OAuth Client Secret",
    description: "Paired secret for 'Sign in with Google'.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },

  // Mobile build-time public values (optional at server level)
  {
    key: "EXPO_PUBLIC_API_URL",
    classification: "optional",
    label: "Expo Public API URL",
    description: "Mobile build-time API URL. Set in the EAS profile, not the server env.",
    apps: ["mobile"],
    isSecret: false,
    maskStrategy: "url",
  },

  // ─────────────────────────────────────────────────────────────
  // PLATFORM — injected by the host/runtime. Never flagged missing.
  // ─────────────────────────────────────────────────────────────
  {
    key: "NODE_ENV",
    classification: "platform",
    label: "Node Environment",
    description: "Runtime mode. Production deploys run with NODE_ENV=production.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "APP_ENV",
    classification: "platform",
    label: "Application Environment",
    description: "Deployment environment label (production/staging/preview) for safety rules.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "VERCEL_ENV",
    classification: "platform",
    label: "Vercel Environment",
    description: "Platform-provided environment label. Read as a fallback for APP_ENV.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "NEXT_RUNTIME",
    classification: "platform",
    label: "Next.js Runtime",
    description: "Set by Next.js to 'nodejs' or 'edge' per execution context.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "DIGITALOCEAN_APP_ID",
    classification: "platform",
    label: "DigitalOcean App ID",
    description: "Injected by the DO App Platform. Used to detect a production-like deploy.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
];

/** Lookup a single expected-env definition. */
export function getExpectedEnvKey(key: string): ExpectedEnvKey | null {
  return EXPECTED_ENV_KEYS.find((entry) => entry.key === key) || null;
}

/** Count of keys by classification — handy for the admin summary cards. */
export function countExpectedEnvByClassification(): Record<EnvKeyClassification, number> {
  return EXPECTED_ENV_KEYS.reduce(
    (acc, entry) => {
      acc[entry.classification] += 1;
      return acc;
    },
    { required: 0, optional: 0, platform: 0 } as Record<EnvKeyClassification, number>,
  );
}

export type EnvKeyPresence = "present" | "missing";

export interface EnvReadinessEntry {
  key: string;
  classification: EnvKeyClassification;
  label: string;
  description: string;
  apps: readonly EnvKeyApp[];
  isSecret: boolean;
  presence: EnvKeyPresence;
  /**
   * Non-reversible masked hint of the resolved value (e.g. `re_***1a2b`),
   * or null when missing. NEVER the raw value. For secret keys this is a
   * heavy mask; for plain flags it may echo the value (true/false) because
   * a feature flag is not a secret.
   */
  maskedHint: string | null;
  /**
   * Which key actually satisfied the requirement (the key itself or one of
   * its aliases). Lets the admin view show "satisfied by RESEND_FROM".
   */
  satisfiedBy: string | null;
  /** True only for a REQUIRED key that resolved to missing. */
  missingRequired: boolean;
  note?: string;
}

export interface EnvReadinessReport {
  /** True when no REQUIRED key is missing. */
  ready: boolean;
  productionLike: boolean;
  counts: {
    requiredTotal: number;
    requiredPresent: number;
    requiredMissing: number;
    optionalTotal: number;
    optionalPresent: number;
    platformTotal: number;
    platformPresent: number;
  };
  /** Just the REQUIRED keys that are missing — what the warn-log prints. */
  missingRequiredKeys: string[];
  entries: EnvReadinessEntry[];
}

function readEnvValue(
  env: Record<string, string | undefined>,
  key: string,
): string | null {
  const raw = env[key];
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Mask a present value for the hint. We deliberately do NOT reuse the raw
 * value anywhere else. `plain` strategy is allowed to echo non-secret flags
 * (true/false, env labels) because those are operational signals, never
 * credentials — but only when the key is not marked `isSecret`.
 */
function buildMaskedHint(entry: ExpectedEnvKey, value: string): string | null {
  if (entry.isSecret) {
    // Force a heavy mask regardless of declared strategy, so a secret never
    // leaks even if its strategy were mis-set to "plain".
    return maskRuntimeConfigValue(value, entry.maskStrategy === "plain" ? "secret" : entry.maskStrategy);
  }
  return maskRuntimeConfigValue(value, entry.maskStrategy);
}

const PRODUCTION_LIKE_ENVS = new Set(["production", "staging", "preview"]);

function detectProductionLike(env: Record<string, string | undefined>): boolean {
  const label = (env.APP_ENV || env.VERCEL_ENV || "").toLowerCase();
  if (PRODUCTION_LIKE_ENVS.has(label)) return true;
  if ((env.NODE_ENV || "").toLowerCase() === "production") return true;
  if (env.DIGITALOCEAN_APP_ID) return true;
  return false;
}

/**
 * Evaluate the catalog against an env snapshot. PURE: reads only the provided
 * env map, never touches the DB, never throws. Returns presence + masked
 * hints only — no raw secret value is ever included in the result.
 *
 * `missingRequired` (and therefore `ready`) is computed against
 * `productionLike`: in a non-production context (e.g. local dev) required
 * keys may legitimately be unset, so we report them as missing but do NOT
 * fail readiness. In a production-like deploy a missing required key is a
 * hard failure.
 */
export function evaluateEnvReadiness(
  env: Record<string, string | undefined> = process.env,
  options: { productionLike?: boolean } = {},
): EnvReadinessReport {
  const productionLike = options.productionLike ?? detectProductionLike(env);

  const entries: EnvReadinessEntry[] = EXPECTED_ENV_KEYS.map((entry) => {
    const candidates = [entry.key, ...(entry.aliases ?? [])];
    let satisfiedBy: string | null = null;
    let value: string | null = null;
    for (const candidate of candidates) {
      const candidateValue = readEnvValue(env, candidate);
      if (candidateValue !== null) {
        satisfiedBy = candidate;
        value = candidateValue;
        break;
      }
    }

    const presence: EnvKeyPresence = value !== null ? "present" : "missing";
    const missingRequired =
      entry.classification === "required" && presence === "missing" && productionLike;

    return {
      key: entry.key,
      classification: entry.classification,
      label: entry.label,
      description: entry.description,
      apps: entry.apps,
      isSecret: entry.isSecret,
      presence,
      maskedHint: value !== null ? buildMaskedHint(entry, value) : null,
      satisfiedBy,
      missingRequired,
      note: entry.note,
    };
  });

  const required = entries.filter((e) => e.classification === "required");
  const optional = entries.filter((e) => e.classification === "optional");
  const platform = entries.filter((e) => e.classification === "platform");
  const requiredPresent = required.filter((e) => e.presence === "present").length;
  const missingRequiredKeys = required
    .filter((e) => e.presence === "missing")
    .map((e) => e.key);

  return {
    ready: !entries.some((e) => e.missingRequired),
    productionLike,
    counts: {
      requiredTotal: required.length,
      requiredPresent,
      requiredMissing: required.length - requiredPresent,
      optionalTotal: optional.length,
      optionalPresent: optional.filter((e) => e.presence === "present").length,
      platformTotal: platform.length,
      platformPresent: platform.filter((e) => e.presence === "present").length,
    },
    missingRequiredKeys,
    entries,
  };
}

/**
 * Startup warn-log helper. Builds the lines a server should `console.warn`
 * when REQUIRED keys are missing in a production-like deploy. Returns an
 * empty array when nothing is wrong (so callers stay quiet on a healthy
 * boot). NEVER throws and NEVER includes any value.
 */
export function buildEnvReadinessWarnings(
  env: Record<string, string | undefined> = process.env,
  options: { productionLike?: boolean } = {},
): string[] {
  const report = evaluateEnvReadiness(env, options);
  const missing = report.entries.filter((e) => e.missingRequired).map((e) => e.key);
  if (missing.length === 0) return [];
  return [
    `[env-readiness] ${missing.length} REQUIRED environment variable(s) missing in a production-like deploy: ${missing.join(", ")}.`,
    "[env-readiness] The app will keep running but dependent features are broken. Set these in the DigitalOcean App Spec and redeploy.",
  ];
}
