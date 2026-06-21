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
    key: "BACKUP_CRON_SECRET",
    classification: "optional",
    label: "Backup Cron Secret",
    description: "Optional narrower bearer secret for admin backup and backup-retention cron routes.",
    apps: ["admin"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Minimum 32 characters when set. If absent, backup cron routes fall back to CRON_SECRET for compatibility.",
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
  {
    key: "NEXT_PUBLIC_SUPPORT_EMAIL",
    classification: "optional",
    label: "Public Support Email",
    description: "Browser-visible support mailbox override. Legal pages fall back to support@locateflow.com.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "email",
  },
  {
    key: "NEXT_PUBLIC_PRIVACY_EMAIL",
    classification: "optional",
    label: "Public Privacy Email",
    description: "Browser-visible privacy mailbox override. Legal pages fall back to privacy@locateflow.com.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "email",
  },
  {
    key: "NEXT_PUBLIC_LEGAL_NOTICE_EMAIL",
    classification: "optional",
    label: "Public Legal Notice Email",
    description: "Browser-visible legal notice mailbox override. Legal pages fall back to legal@locateflow.com.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "email",
  },
  {
    key: "NEXT_PUBLIC_BILLING_EMAIL",
    classification: "optional",
    label: "Public Billing Email",
    description: "Browser-visible billing mailbox override. Legal pages fall back to billing@locateflow.com.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "email",
  },
  {
    key: "NEXT_PUBLIC_SECURITY_EMAIL",
    classification: "optional",
    label: "Public Security Email",
    description: "Browser-visible security mailbox override. Legal pages fall back to security@locateflow.com.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "email",
  },
  {
    key: "NEXT_PUBLIC_DPA_EMAIL",
    classification: "optional",
    label: "Public DPA Email",
    description: "Browser-visible DPA/privacy mailbox override. Legal pages fall back to privacy@locateflow.com.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "email",
  },

  // Maps / Places — required because address autocomplete is on by default
  {
    key: "GOOGLE_MAPS_API_KEY",
    classification: "required",
    label: "Google Places API Key",
    description: "Server-side Places key for address autocomplete + details. Onboarding needs it.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Only strictly required while PLACES_AUTOCOMPLETE_ENABLED is not 'false' (the default).",
  },
  {
    key: "GEOAPIFY_API_KEY",
    classification: "optional",
    label: "Geoapify API Key",
    description: "Server-side Geoapify Static Maps key for route maps.",
    apps: ["web", "mobile"],
    isSecret: true,
    maskStrategy: "secret",
    note: "Optional. If unset, route maps degrade gracefully to the existing stylized fallback.",
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
  {
    key: "TRUSTED_PROXY_HEADERS",
    classification: "optional",
    label: "Trusted Proxy Headers",
    description: "Selects which edge IP header family the web/admin apps trust for rate limits and audit logs.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Use 'cloudflare' behind Cloudflare. Unset preserves legacy compat precedence.",
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

  // Admin operator digest (admin-daily-digest cron) — operator-tunable controls.
  {
    key: "ADMIN_DIGEST_ENABLED",
    classification: "optional",
    label: "Admin Digest Enabled",
    description: "Operator morning briefing email. Enabled by default; set 'false' to disable.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Set to 'false' to turn the admin daily digest off.",
  },
  {
    key: "ADMIN_DIGEST_SKIP_IF_EMPTY",
    classification: "optional",
    label: "Admin Digest — Skip Empty",
    description: "When 'true', suppress the admin digest on quiet days (no activity in the window).",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Set to 'true' to skip all-zero digests.",
  },
  {
    key: "ADMIN_DIGEST_MIN_CHURN_ALERT",
    classification: "optional",
    label: "Admin Digest — Churn Alert %",
    description: "Monthly churn % above which an immediate anomaly alert (Slack + email) fires. Default 5.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "A number, e.g. '5'.",
  },
  {
    key: "ADMIN_DIGEST_EXCLUDE_EMAILS",
    classification: "optional",
    label: "Admin Digest — Excluded Recipients",
    description: "Comma-separated admin emails to omit from the per-admin digest fan-out (no-migration opt-out).",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "e.g. 'a@x.com,b@y.com'.",
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
    key: "FCC_BDC_USERNAME",
    classification: "optional",
    label: "FCC BDC Username",
    description: "FCC account email paired with FCC_BDC_API_KEY for the documented username/hash_value header auth.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Recommended when FCC_BDC_ENABLED=true.",
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
  {
    key: "ELECTRIC_LOOKUP_ENABLED",
    classification: "optional",
    label: "Electric Utility Confirmation Enabled",
    description: "Master flag for OpenEI URDB electric-utility serviceability lookups. Recommendations fall back gracefully when off.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Requires OPENEI_API_KEY to take effect.",
  },
  {
    key: "OPENEI_API_KEY",
    classification: "optional",
    label: "OpenEI API Key",
    description: "Free OpenEI/URDB key used to confirm which electric utilities serve address coordinates.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "AIRNOW_API_KEY",
    classification: "optional",
    label: "AirNow API Key",
    description: "Free AirNow key used by the New Home Dossier current air-quality section.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "CENSUS_API_KEY",
    classification: "optional",
    label: "Census API Key",
    description: "Free Census key used by the Pro neighborhood economics section for ACS tract medians.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "HUD_HOUSING_DATA_ENABLED",
    classification: "optional",
    label: "HUD Housing Data Enabled",
    description: "Enables HUD User ZIP Crosswalk, Fair Market Rent, and Income Limits enrichment in the New Home Dossier.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Set to 'true' and pair with HUD_USER_API_TOKEN.",
  },
  {
    key: "HUD_USER_API_TOKEN",
    classification: "optional",
    label: "HUD User API Token",
    description: "Free HUD User API token used by the dossier housing-data section.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "NLR_ALT_FUEL_STATIONS_ENABLED",
    classification: "optional",
    label: "NLR EV Charging Data Enabled",
    description: "Enables NLR Alternative Fuel Stations nearby public EV charging enrichment in the New Home Dossier.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Set to 'true' and pair with NLR_API_KEY.",
  },
  {
    key: "NLR_API_KEY",
    classification: "optional",
    label: "NLR API Key",
    description: "Free NLR Developer Network key used for Alternative Fuel Stations nearest-stations EV data.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "FMCSA_WEBKEY",
    classification: "optional",
    label: "FMCSA QCMobile Web Key",
    description: "Free FMCSA QCMobile key used by the admin mover-verification queue for USDOT cross-checks.",
    apps: ["admin"],
    isSecret: true,
    maskStrategy: "secret",
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

  // Controlled test and store-review accounts
  {
    key: "QA_RESETTABLE_ACCOUNT_EMAIL",
    classification: "optional",
    label: "QA Resettable Account Email",
    description: "Single QA email that auto-verifies on signup and hard-resets itself on logout.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "email",
    note: "Deployment env only. Must be one exact email, not a comma-separated allowlist.",
  },
  {
    key: "QA_PERSONA_ACCOUNTS",
    classification: "optional",
    label: "QA Persona Accounts",
    description: "Comma-separated exact QA emails with auto-granted plans in email:PLAN format.",
    apps: ["web", "mobile", "admin"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Deployment env only. Plans: FREE_TRIAL, INDIVIDUAL, FAMILY, PRO. These accounts auto-verify, self-heal entitlements, and hard-reset on logout/cron.",
  },
  {
    key: "STORE_REVIEW_ACCOUNT_EMAILS",
    classification: "optional",
    label: "Store Review Account Emails",
    description: "Comma-separated Google Play/App Store reviewer emails that auto-verify on signup.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "email",
    note: "Deployment env only. These reset only on fresh signup, not on logout.",
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
    key: "GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS",
    classification: "optional",
    label: "Google Play Test Purchase Emails",
    description: "Comma-separated Play tester/reviewer user emails allowed to claim Google test purchases and receive review-ready onboarding.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "email",
  },
  {
    key: "APPLE_SANDBOX_PURCHASE_USER_EMAILS",
    classification: "optional",
    label: "Apple Sandbox Purchase Emails",
    description: "Comma-separated App Store reviewer/sandbox user emails allowed to claim Apple sandbox purchases and receive review-ready onboarding.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "email",
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
  // Additional documented optional knobs read directly from process.env.
  // ─────────────────────────────────────────────────────────────
  {
    key: "EXPO_PUBLIC_APP_URL",
    classification: "optional",
    label: "Expo Public Web URL",
    description: "Mobile build-time public web origin for legal/marketing links. Falls back to the API origin when unset.",
    apps: ["mobile"],
    isSecret: false,
    maskStrategy: "url",
  },
  {
    key: "EXPO_PUBLIC_ENV",
    classification: "optional",
    label: "Expo Environment",
    description: "Mobile build-time environment label used by safety checks and local debug URL policy.",
    apps: ["mobile"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "EXPO_PUBLIC_GIT_SHA",
    classification: "optional",
    label: "Expo Git SHA",
    description: "Mobile build metadata. Normally injected by EAS/CI.",
    apps: ["mobile"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED",
    classification: "optional",
    label: "Mobile Store Purchases",
    description: "Global mobile build-time flag for enabling native store purchases.",
    apps: ["mobile"],
    isSecret: false,
    maskStrategy: "plain",
    aliases: ["EXPO_PUBLIC_MOBILE_IOS_STORE_PURCHASES_ENABLED", "EXPO_PUBLIC_MOBILE_ANDROID_STORE_PURCHASES_ENABLED"],
  },
  {
    key: "EXPO_PUBLIC_MOBILE_OAUTH_REDIRECT_URI",
    classification: "optional",
    label: "Mobile OAuth Redirect URI",
    description: "Mobile build-time redirect URI used for OAuth handoff callbacks.",
    apps: ["mobile"],
    isSecret: false,
    maskStrategy: "url",
  },
  {
    key: "EXPO_PUBLIC_UX_AI_BRIEFING_EXPERIENCE_V1",
    classification: "optional",
    label: "AI Briefing UX Flag",
    description: "Mobile build-time UX experiment flag for AI briefing treatment.",
    apps: ["mobile"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "EXPO_PUBLIC_UX_ONBOARDING_TEASER_V1",
    classification: "optional",
    label: "Onboarding Teaser UX Flag",
    description: "Mobile build-time UX experiment flag for onboarding teaser treatment.",
    apps: ["mobile"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "ADMIN_SEED_EMAIL",
    classification: "optional",
    label: "Admin Seed Email",
    description: "Initial admin account email used by the Prisma admin seed script.",
    apps: ["admin"],
    isSecret: false,
    maskStrategy: "email",
  },
  {
    key: "ADMIN_SEED_PASSWORD",
    classification: "optional",
    label: "Admin Seed Password",
    description: "Initial admin account password used by the Prisma admin seed script.",
    apps: ["admin"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "ACCOUNT_DELETION_GRACE_DAYS",
    classification: "optional",
    label: "Account Deletion Grace Days",
    description: "Override for the account deletion restore window. Defaults are applied when unset.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "ADMIN_SESSION_TTL_DAYS",
    classification: "optional",
    label: "Admin Session TTL Days",
    description: "Override for admin session lifetime. Defaults are applied when unset.",
    apps: ["admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "ADMIN_SESSION_COOKIE_DOMAIN",
    classification: "optional",
    label: "Admin Session Cookie Domain",
    description: "Cookie-domain override for admin sessions. Defaults to host/domain policy when unset.",
    apps: ["admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "SESSION_COOKIE_DOMAIN",
    classification: "optional",
    label: "Shared Session Cookie Domain",
    description: "Cookie-domain override shared by web/admin auth helpers.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "USER_SESSION_COOKIE_DOMAIN",
    classification: "optional",
    label: "User Session Cookie Domain",
    description: "Cookie-domain override for user sessions. Defaults to host/domain policy when unset.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "ALLOW_ADMIN_TABLE_RESTORE",
    classification: "optional",
    label: "Admin Table Restore Override",
    description: "Break-glass flag for restoring admin tables from backup imports.",
    apps: ["admin"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Leave unset except during a controlled restore drill.",
  },
  {
    key: "ALLOW_RESTORE_WITHOUT_SAFETY_BACKUP",
    classification: "optional",
    label: "Restore Safety Backup Override",
    description: "Break-glass flag that allows backup import without creating a safety backup first.",
    apps: ["admin"],
    isSecret: false,
    maskStrategy: "plain",
    note: "Leave unset except during a controlled restore drill.",
  },
  {
    key: "STRIPE_ALLOW_LIVE_WEBHOOKS_OUTSIDE_PRODUCTION",
    classification: "optional",
    label: "Stripe Live Webhook Staging Override",
    description: "Break-glass flag allowing live Stripe events outside production.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
    aliases: ["ALLOW_STRIPE_LIVE_EVENTS_IN_NON_PRODUCTION"],
    note: "Leave unset in normal staging/production operation.",
  },
  {
    key: "ANDROID_APP_FINGERPRINTS",
    classification: "optional",
    label: "Android App Fingerprints",
    description: "Comma-separated SHA fingerprints emitted in assetlinks.json for Android app links.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "APPLE_TEAM_ID",
    classification: "optional",
    label: "Apple Team ID",
    description: "Apple developer team ID emitted in the Apple app-site-association file.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "id",
    aliases: ["NEXT_PUBLIC_APPLE_TEAM_ID"],
  },
  {
    key: "EMAIL_UNSUBSCRIBE_SECRET",
    classification: "optional",
    label: "Email Unsubscribe Secret",
    description: "Signs one-click unsubscribe URLs in transactional email.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "MOBILE_OAUTH_REDIRECT_URIS",
    classification: "optional",
    label: "Mobile OAuth Redirect Allowlist",
    description: "Comma-separated redirect URI allowlist accepted by the mobile OAuth handoff.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "WEB_INTERNAL_URL",
    classification: "optional",
    label: "Web Internal URL",
    description: "Internal web app URL used by admin-to-web handoff calls. Falls back to public app URL.",
    apps: ["admin", "web"],
    isSecret: false,
    maskStrategy: "url",
  },
  {
    key: "GOOGLE_SITE_VERIFICATION",
    classification: "optional",
    label: "Google Site Verification",
    description: "Search Console verification token rendered by public metadata.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "id",
    aliases: ["NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"],
  },
  {
    key: "NEXT_PUBLIC_GTM_ID",
    classification: "optional",
    label: "Google Tag Manager ID",
    description: "Public GTM container id loaded after cookie consent when configured.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "id",
  },
  {
    key: "NEXT_PUBLIC_GA_MEASUREMENT_ID",
    classification: "optional",
    label: "GA4 Measurement ID",
    description: "Public GA4 measurement id used as a fallback when GTM is unset.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "id",
  },
  {
    key: "INDEXNOW_KEY",
    classification: "optional",
    label: "IndexNow Key",
    description: "Bing IndexNow key used to ping blog URL updates.",
    apps: ["web"],
    isSecret: true,
    maskStrategy: "secret",
  },
  {
    key: "NEXT_PUBLIC_ANDROID_PLAY_STORE_URL",
    classification: "optional",
    label: "Android Play Store URL",
    description: "Public Android app install URL used by web install prompts.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "url",
  },
  {
    key: "NEXT_PUBLIC_IOS_APP_STORE_URL",
    classification: "optional",
    label: "iOS App Store URL",
    description: "Public iOS app install URL used by web install prompts.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "url",
  },
  {
    key: "NEXT_PUBLIC_IOS_APP_STORE_ID",
    classification: "optional",
    label: "iOS App Store ID",
    description: "Apple app id used by the Smart App Banner meta tag.",
    apps: ["web", "mobile"],
    isSecret: false,
    maskStrategy: "id",
  },
  {
    key: "NEXT_PUBLIC_COMPANY_ADDRESS",
    classification: "optional",
    label: "Public Company Address",
    description: "Public legal mailing address rendered on legal/contact pages.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "NEXT_PUBLIC_LEGAL_ENTITY_NAME",
    classification: "optional",
    label: "Public Legal Entity Name",
    description: "Public company/legal entity name rendered on legal/contact pages.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "NEXT_PUBLIC_SITE_URL",
    classification: "optional",
    label: "Public Site URL",
    description: "Canonical marketing/site origin used by metadata, sitemap, robots, and llms.txt.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "url",
    aliases: ["SITE_URL"],
  },
  {
    key: "SITE_LAST_MODIFIED",
    classification: "optional",
    label: "Site Last Modified",
    description: "Static lastModified fallback for sitemap entries.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "NOTIFICATION_SMS_ENABLED",
    classification: "optional",
    label: "SMS Notifications Enabled",
    description: "Feature flag for future SMS notification delivery. Defaults off.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "RATE_LIMIT_SHADOW_USER_KEYED_ENABLED",
    classification: "optional",
    label: "Rate Limit Shadow User-Keyed Mode",
    description: "Shadow-mode flag for user-keyed rate-limit observation in middleware.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "STRIPE_CAMPAIGN_CURRENCY",
    classification: "optional",
    label: "Stripe Campaign Currency",
    description: "Default currency for new acquisition campaign prices. Defaults to usd.",
    apps: ["admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "STRIPE_CURRENCY",
    classification: "optional",
    label: "Stripe Currency",
    description: "Legacy/default currency override for ad-hoc Stripe operations. Defaults to usd.",
    apps: ["admin"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "TEST_AUTOMATION_ENABLED",
    classification: "optional",
    label: "Synthetic Monitor Enabled",
    description: "Controls the synthetic monitor cron route. Defaults on when unset.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "plain",
  },
  {
    key: "UPTIME_WEB_BASE_URL",
    classification: "optional",
    label: "Uptime Web Base URL",
    description: "Override base URL for uptime-check cron web probes.",
    apps: ["web"],
    isSecret: false,
    maskStrategy: "url",
  },
  {
    key: "UPTIME_ADMIN_BASE_URL",
    classification: "optional",
    label: "Uptime Admin Base URL",
    description: "Override base URL for uptime-check cron admin probes.",
    apps: ["web", "admin"],
    isSecret: false,
    maskStrategy: "url",
  },
  // Platform-injected values. Never flagged missing for operators.
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
