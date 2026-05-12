export const RUNTIME_CONFIG_SCOPE_VALUES = ["GLOBAL", "WEB", "ADMIN", "MOBILE"] as const;
export type RuntimeConfigScope = (typeof RUNTIME_CONFIG_SCOPE_VALUES)[number];

export const RUNTIME_CONFIG_CATEGORY_VALUES = [
  "BILLING",
  "MOBILE_BILLING",
  "EMAIL",
  "MAPS",
  "STORAGE",
  "SECURITY",
  "REDIS",
  "CRON",
  "AI",
  "APP",
  "OAUTH",
] as const;
export type RuntimeConfigCategory = (typeof RUNTIME_CONFIG_CATEGORY_VALUES)[number];

export type RuntimeConfigMaskStrategy = "secret" | "id" | "url" | "email" | "plain";
export type RuntimeConfigSource =
  | "ENV"
  | "Runtime Config"
  | "ENV + Runtime Config"
  | "Missing"
  | "Default";
export type RuntimeConfigStatus =
  | "Verified from ENV"
  | "Verified from Runtime Config"
  | "Missing"
  | "Invalid"
  | "Conflict"
  | "Needs review"
  | "Not required in this environment"
  | "Build-time only"
  | "Manual console action required";
export type RuntimeConfigEditable = "Yes" | "Restricted" | "No";

export const STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG = "STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED";

/**
 * Historical allowlist of keys for which deployment env was treated as
 * authoritative. Kept exported so existing tests/imports keep working,
 * but the precedence rule is now uniform: deployment env is
 * authoritative for *every* managed key, and DB overrides only apply
 * when the operator opts in via STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED.
 */
export const ENV_FIRST_RUNTIME_CONFIG_KEYS = [
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
  "STRIPE_PRICE_INDIVIDUAL_YEARLY",
  "STRIPE_ANNUAL_TRIAL_DAYS",
] as const;

const RUNTIME_CONFIG_DB_OVERRIDE_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
  "STRIPE_PRICE_INDIVIDUAL_YEARLY",
  "STRIPE_ANNUAL_TRIAL_DAYS",
] as const;

export function isEnvFirstRuntimeConfigKey(key: string): boolean {
  return (
    (ENV_FIRST_RUNTIME_CONFIG_KEYS as readonly string[]).includes(key) ||
    Boolean(getRuntimeConfigDefinition(key))
  );
}

export function isRuntimeConfigDbOverrideEnabled(
  env: Record<string, string | undefined> = {},
): boolean {
  return env[STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG]?.trim().toLowerCase() === "true";
}

/**
 * Effective-config precedence rule.
 *
 * DigitalOcean / deployment env is the source of truth for every
 * managed key. The Runtime Config DB is only used as a fallback when
 * the same key is unset in the deployment env, OR when an operator
 * explicitly enables the global override flag for break-glass key
 * rotation. This avoids the foot-gun where an admin re-pastes a
 * production secret into the UI and silently shadows the deployment-
 * level env for every other process.
 *
 * Returns `true` when the resolver should prefer process.env over
 * any DB-stored value.
 */
export function shouldPreferEnvRuntimeConfigValue(
  key: string,
  env: Record<string, string | undefined> = {},
): boolean {
  if (
    isRuntimeConfigDbOverrideEnabled(env) &&
    (RUNTIME_CONFIG_DB_OVERRIDE_KEYS as readonly string[]).includes(key)
  ) {
    return false;
  }
  return isEnvFirstRuntimeConfigKey(key);
}

export function getRuntimeConfigEnvValue(
  key: string,
  env: Record<string, string | undefined> = {},
): string | null {
  return env[key] || null;
}

export interface RuntimeConfigDefinition {
  key: string;
  label: string;
  description: string;
  scope: RuntimeConfigScope;
  category: RuntimeConfigCategory;
  isSecret: boolean;
  requiredInProduction: boolean;
  maskStrategy: RuntimeConfigMaskStrategy;
  runtimeEditable?: boolean;
  buildTimeOnly?: boolean;
  usedBy?: readonly string[];
  validation?: string;
  note?: string;
}

export const RUNTIME_CONFIG_DEFINITIONS: readonly RuntimeConfigDefinition[] = [
  {
    key: "NODE_ENV",
    label: "Node Environment",
    description: "Runtime mode for the deployed process. Production deployments must run with NODE_ENV=production.",
    scope: "GLOBAL",
    category: "APP",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "plain",
    runtimeEditable: false,
    usedBy: ["web app", "admin app", "migration job", "cron/worker"],
    validation: "production environment value",
  },
  {
    key: "APP_ENV",
    label: "Application Environment",
    description: "Deployment environment label used to detect production, staging, and preview safety rules.",
    scope: "GLOBAL",
    category: "APP",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "plain",
    runtimeEditable: false,
    usedBy: ["web app", "admin app", "cron/worker"],
    validation: "production-like environment value",
  },
  {
    key: "DATABASE_URL",
    label: "Database URL",
    description: "Prisma database connection URL. This is deployment infrastructure config and is never DB-backed.",
    scope: "GLOBAL",
    category: "APP",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "url",
    runtimeEditable: false,
    usedBy: ["web app", "admin app", "migration job", "backup/storage"],
    validation: "database URL",
  },
  {
    key: "USER_JWT_SECRET",
    label: "User JWT Secret",
    description: "Secret used to sign user web and mobile sessions. Must be present in deployment env.",
    scope: "WEB",
    category: "SECURITY",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
    runtimeEditable: false,
    usedBy: ["web app", "mobile/EAS"],
    validation: "minimum 32 characters",
  },
  {
    key: "ADMIN_JWT_SECRET",
    label: "Admin JWT Secret",
    description: "Secret used to sign admin sessions. Must be present in deployment env.",
    scope: "ADMIN",
    category: "SECURITY",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
    runtimeEditable: false,
    usedBy: ["admin app", "web app"],
    validation: "minimum 32 characters",
  },
  {
    key: "STRIPE_SECRET_KEY",
    label: "Stripe Secret Key",
    description: "Server-side Stripe key for checkout, portal, and recurring billing operations.",
    scope: "WEB",
    category: "BILLING",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    label: "Stripe Webhook Secret",
    description: "Webhook signing secret used to verify Stripe subscription events.",
    scope: "WEB",
    category: "BILLING",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
  },
  {
    key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    label: "Stripe Publishable Key",
    description: "Browser-safe Stripe publishable key. Public by design; never use this for server-side Stripe operations.",
    scope: "WEB",
    category: "BILLING",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "id",
  },
  {
    key: "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
    label: "Stripe Price ID - Individual (monthly)",
    description: "Primary Stripe recurring price identifier for the Individual monthly web plan.",
    scope: "WEB",
    category: "BILLING",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "id",
  },
  {
    key: "STRIPE_PRICE_INDIVIDUAL_YEARLY",
    label: "Stripe Price ID - Individual (yearly)",
    description: "Primary Stripe recurring price identifier for the Individual yearly web plan.",
    scope: "WEB",
    category: "BILLING",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "id",
  },
  {
    key: "STRIPE_ANNUAL_TRIAL_DAYS",
    label: "Stripe Annual Trial Days",
    description: "Trial length applied by web Checkout for the Individual annual Stripe plan. Defaults to 90 when unset.",
    scope: "WEB",
    category: "BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
  },
  {
    key: "STRIPE_PRICE_INDIVIDUAL",
    label: "Stripe Price ID - Individual (legacy monthly)",
    description: "Legacy monthly Stripe Price ID. Used only as a fallback when STRIPE_PRICE_INDIVIDUAL_MONTHLY is missing.",
    scope: "WEB",
    category: "BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "RESEND_API_KEY",
    label: "Resend API Key",
    description: "Transactional email delivery key.",
    scope: "WEB",
    category: "EMAIL",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
  },
  {
    key: "RESEND_WEBHOOK_SECRET",
    label: "Resend Webhook Secret",
    description: "Signing secret for inbound Resend event webhooks.",
    scope: "WEB",
    category: "EMAIL",
    isSecret: true,
    requiredInProduction: false,
    maskStrategy: "secret",
  },
  {
    key: "EMAIL_FROM",
    label: "Email From",
    description: "Sender identity used for transactional emails.",
    scope: "WEB",
    category: "EMAIL",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "plain",
  },
  {
    key: "EMAIL_REPLY_TO",
    label: "Email Reply-To",
    description: "Reply-to address used for transactional and support emails.",
    scope: "GLOBAL",
    category: "EMAIL",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "email",
  },
  {
    key: "SUPPORT_EMAIL",
    label: "Support Email",
    description: "Public support mailbox used in email footers, legal pages, and support workflows.",
    scope: "GLOBAL",
    category: "EMAIL",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "email",
  },
  {
    key: "ADMIN_ALERT_EMAIL",
    label: "Admin Alert Email",
    description: "Recipient for scheduled admin operational digests when configured separately from ALERT_EMAIL_TO.",
    scope: "ADMIN",
    category: "EMAIL",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "email",
  },
  {
    key: "ALERT_EMAIL_FROM",
    label: "Alert Email From",
    description: "Sender identity used for security and operational alerts.",
    scope: "ADMIN",
    category: "SECURITY",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
  },
  {
    key: "ALERT_EMAIL_TO",
    label: "Alert Email Recipients",
    description: "Comma-separated recipients for security alerts.",
    scope: "ADMIN",
    category: "SECURITY",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "email",
  },
  {
    key: "GOOGLE_MAPS_API_KEY",
    label: "Google Maps API Key",
    description: "Server-side Maps and Places Web Service API key for address autocomplete and details lookups. Use IP-address/application API restrictions, not HTTP referrers.",
    scope: "GLOBAL",
    category: "MAPS",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
  },
  {
    key: "PLACES_AUTOCOMPLETE_ENABLED",
    label: "Places Autocomplete Enabled",
    description: "Set to false to disable Google Places address autocomplete and details lookups without redeploying.",
    scope: "GLOBAL",
    category: "MAPS",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
    validation: "boolean",
  },
  {
    key: "PLACES_AUTOCOMPLETE_DAILY_LIMIT",
    label: "Places Autocomplete Daily Limit",
    description: "Global daily cap for Places autocomplete calls when enabled.",
    scope: "GLOBAL",
    category: "MAPS",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
    validation: "positive integer",
  },
  {
    key: "PLACES_AUTOCOMPLETE_DAILY_USER_LIMIT",
    label: "Places Autocomplete Daily User Limit",
    description: "Per-user daily cap for Places autocomplete calls.",
    scope: "GLOBAL",
    category: "MAPS",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
    validation: "positive integer",
  },
  {
    key: "PLACES_AUTOCOMPLETE_DAILY_IP_LIMIT",
    label: "Places Autocomplete Daily IP Limit",
    description: "Per-IP daily cap for Places autocomplete calls.",
    scope: "GLOBAL",
    category: "MAPS",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
    validation: "positive integer",
  },
  {
    key: "PLACES_DETAILS_DAILY_USER_LIMIT",
    label: "Places Details Daily User Limit",
    description: "Per-user daily cap for Places details lookups.",
    scope: "GLOBAL",
    category: "MAPS",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
    validation: "positive integer",
  },
  {
    key: "PLACES_DETAILS_DAILY_IP_LIMIT",
    label: "Places Details Daily IP Limit",
    description: "Per-IP daily cap for Places details lookups.",
    scope: "GLOBAL",
    category: "MAPS",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
    validation: "positive integer",
  },
  {
    key: "R2_ENDPOINT",
    label: "R2 / S3 Endpoint",
    description: "S3-compatible endpoint for primary file storage. For Cloudflare R2 this is https://<account-id>.r2.cloudflarestorage.com.",
    scope: "WEB",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "url",
  },
  {
    key: "R2_REGION",
    label: "R2 / S3 Region",
    description: "Region string required by the S3 signing protocol (R2 uses 'auto').",
    scope: "WEB",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "plain",
  },
  {
    key: "R2_BUCKET",
    label: "R2 / S3 Bucket",
    description: "Bucket name used for user uploads, provider logos, and document OCR originals.",
    scope: "WEB",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "plain",
  },
  {
    key: "R2_ACCESS_KEY_ID",
    label: "R2 / S3 Access Key ID",
    description: "Access key ID for the storage bucket. Scope the token to a single bucket.",
    scope: "WEB",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "id",
  },
  {
    key: "R2_SECRET_ACCESS_KEY",
    label: "R2 / S3 Secret Access Key",
    description: "Secret access key paired with R2_ACCESS_KEY_ID. Never exposed to the browser.",
    scope: "WEB",
    category: "STORAGE",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
  },
  {
    key: "R2_PUBLIC_BASE_URL",
    label: "R2 Public Base URL",
    description: "Optional public R2.dev URL for objects served raw (without imgproxy). Leave blank to route everything through imgproxy.",
    scope: "WEB",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "url",
  },
  {
    key: "IMGPROXY_KEY",
    label: "imgproxy Signing Key",
    description: "HEX key used to HMAC-sign imgproxy URLs. Must match the value the imgproxy container is configured with.",
    scope: "WEB",
    category: "STORAGE",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
  },
  {
    key: "IMGPROXY_SALT",
    label: "imgproxy Signing Salt",
    description: "HEX salt used together with IMGPROXY_KEY to sign URLs.",
    scope: "WEB",
    category: "STORAGE",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
  },
  {
    key: "NEXT_PUBLIC_IMGPROXY_URL",
    label: "imgproxy Public URL",
    description: "Public hostname the browser loads transformed images from (e.g. https://img.app.example.com).",
    scope: "WEB",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "url",
  },
  {
    key: "BACKUP_STORAGE_PROVIDER",
    label: "Backup Storage Provider",
    description: "Logical provider name for offsite encrypted backup storage.",
    scope: "ADMIN",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
  },
  {
    key: "BACKUP_STORAGE_BUCKET",
    label: "Backup Storage Bucket",
    description: "Bucket or container name used for offsite encrypted backups.",
    scope: "ADMIN",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
  },
  {
    key: "BACKUP_STORAGE_REGION",
    label: "Backup Storage Region",
    description: "Region for the offsite backup bucket or container.",
    scope: "ADMIN",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
  },
  {
    key: "BACKUP_STORAGE_ENDPOINT",
    label: "Backup Storage Endpoint",
    description: "Optional custom endpoint for S3-compatible backup storage.",
    scope: "ADMIN",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "url",
  },
  {
    key: "BACKUP_STORAGE_ACCESS_KEY_ID",
    label: "Backup Storage Access Key ID",
    description: "Access key used to upload encrypted offsite backups to S3-compatible storage.",
    scope: "ADMIN",
    category: "STORAGE",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "BACKUP_STORAGE_SECRET_ACCESS_KEY",
    label: "Backup Storage Secret Access Key",
    description: "Secret key used to sign S3-compatible offsite backup upload requests.",
    scope: "ADMIN",
    category: "STORAGE",
    isSecret: true,
    requiredInProduction: false,
    maskStrategy: "secret",
  },
  {
    key: "UPSTASH_REDIS_REST_URL",
    label: "Upstash Redis URL",
    description: "Redis endpoint used for production rate limiting.",
    scope: "WEB",
    category: "REDIS",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "url",
    runtimeEditable: false,
    usedBy: ["web app", "admin app", "cron/worker", "Redis/Upstash"],
    validation: "HTTPS URL",
  },
  {
    key: "UPSTASH_REDIS_REST_TOKEN",
    label: "Upstash Redis Token",
    description: "Redis authentication token used for rate limiting.",
    scope: "WEB",
    category: "REDIS",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
    runtimeEditable: false,
    usedBy: ["web app", "admin app", "cron/worker", "Redis/Upstash"],
    validation: "minimum 16 characters",
  },
  {
    key: "CRON_SECRET",
    label: "Cron Secret",
    description: "Bearer secret protecting scheduled cron jobs (/api/cron/*).",
    scope: "GLOBAL",
    category: "CRON",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
    runtimeEditable: false,
    usedBy: ["web app", "admin app", "cron/worker"],
    validation: "minimum 32 characters",
  },
  {
    key: "INTERNAL_WEBHOOK_SECRET",
    label: "Internal Webhook Secret",
    description:
      "Bearer secret for server-to-server internal webhooks (IP rule cache refresh, rate-limit log fan-out, security events). Required independently from CRON_SECRET so scheduled jobs cannot call internal webhook endpoints.",
    scope: "GLOBAL",
    category: "CRON",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
    runtimeEditable: false,
    usedBy: ["web app", "admin app", "cron/worker"],
    validation: "minimum 32 characters",
  },
  {
    key: "IMPERSONATION_HANDOFF_SECRET",
    label: "Impersonation Handoff Secret",
    description:
      "Bearer secret guarding the admin→web impersonation handoff endpoint. Required independently from CRON_SECRET and INTERNAL_WEBHOOK_SECRET.",
    scope: "GLOBAL",
    category: "SECURITY",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
    runtimeEditable: false,
    usedBy: ["web app", "admin app"],
    validation: "minimum 32 characters",
  },
  {
    key: "FIELD_ENCRYPTION_KEY",
    label: "Field Encryption Key",
    description: "Primary AES key used to encrypt sensitive values stored by the application.",
    scope: "GLOBAL",
    category: "SECURITY",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
    runtimeEditable: false,
    usedBy: ["web app", "admin app", "backup/storage"],
    validation: "exactly 64 hex characters",
  },
  {
    key: "SLACK_WEBHOOK_URL",
    label: "Slack Webhook URL",
    description: "Incoming webhook used to deliver security alerts into Slack.",
    scope: "ADMIN",
    category: "SECURITY",
    isSecret: true,
    requiredInProduction: false,
    maskStrategy: "secret",
  },
  {
    key: "NEXT_PUBLIC_SENTRY_DSN",
    label: "Sentry DSN",
    description: "Error monitoring DSN used for application error and incident visibility.",
    scope: "GLOBAL",
    category: "SECURITY",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "url",
  },
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    description: "Server-side AI provider key.",
    scope: "WEB",
    category: "AI",
    isSecret: true,
    requiredInProduction: false,
    maskStrategy: "secret",
  },
  {
    key: "APP_URL",
    label: "Canonical App URL",
    description: "Server-side canonical public URL used for billing redirects and backend-generated links.",
    scope: "GLOBAL",
    category: "APP",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "url",
    runtimeEditable: false,
    usedBy: ["web app", "admin app", "billing/Stripe", "email"],
    validation: "HTTPS production URL",
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    label: "Public App URL",
    description: "Canonical public URL used for redirects, emails, and links.",
    scope: "GLOBAL",
    category: "APP",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "url",
    runtimeEditable: false,
    buildTimeOnly: true,
    usedBy: ["web app", "admin app", "mobile/EAS", "email"],
    validation: "HTTPS production URL",
    note: "Public build-time value; rebuild and redeploy after changing it.",
  },
  {
    key: "NEXT_PUBLIC_ADMIN_URL",
    label: "Public Admin URL",
    description: "Canonical public URL for the admin app.",
    scope: "ADMIN",
    category: "APP",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "url",
    runtimeEditable: false,
    buildTimeOnly: true,
    usedBy: ["admin app", "web app"],
    validation: "HTTPS production URL",
    note: "Public build-time value; rebuild and redeploy after changing it.",
  },
  {
    key: "EXPO_PUBLIC_API_URL",
    label: "Expo Public API URL",
    description: "Mobile build-time API URL used by the Expo app.",
    scope: "MOBILE",
    category: "APP",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "url",
    runtimeEditable: false,
    buildTimeOnly: true,
    usedBy: ["mobile/EAS"],
    validation: "HTTPS production URL",
    note: "Mobile build-time value; rebuild the EAS artifact after changing it.",
  },
  {
    key: "EXPO_PUBLIC_APP_URL",
    label: "Expo Public App URL",
    description: "Mobile build-time web app URL used for deep links and web fallbacks.",
    scope: "MOBILE",
    category: "APP",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "url",
    runtimeEditable: false,
    buildTimeOnly: true,
    usedBy: ["mobile/EAS"],
    validation: "HTTPS production URL",
    note: "Mobile build-time value; rebuild the EAS artifact after changing it.",
  },
  {
    key: "EXPO_PUBLIC_SENTRY_DSN",
    label: "Expo Public Sentry DSN",
    description: "Mobile build-time Sentry DSN.",
    scope: "MOBILE",
    category: "SECURITY",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "url",
    runtimeEditable: false,
    buildTimeOnly: true,
    usedBy: ["mobile/EAS"],
    validation: "Sentry DSN URL",
    note: "Mobile build-time value; rebuild the EAS artifact after changing it.",
  },
  {
    key: "NOTIFICATION_PUSH_ENABLED",
    label: "Push Notifications Enabled",
    description: "Feature flag controlling push notification dispatch.",
    scope: "MOBILE",
    category: "APP",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
    validation: "boolean",
  },

  // ── OAuth (Google + Apple Sign-in) ─────────────────────────
  {
    key: "GOOGLE_OAUTH_CLIENT_ID",
    label: "Google OAuth Client ID",
    description: "OAuth 2.0 client ID from Google Cloud Console used for \"Sign in with Google\".",
    scope: "WEB",
    category: "OAUTH",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "GOOGLE_OAUTH_CLIENT_SECRET",
    label: "Google OAuth Client Secret",
    description: "OAuth 2.0 client secret paired with GOOGLE_OAUTH_CLIENT_ID.",
    scope: "WEB",
    category: "OAUTH",
    isSecret: true,
    requiredInProduction: false,
    maskStrategy: "secret",
  },
  {
    key: "APPLE_OAUTH_CLIENT_ID",
    label: "Apple OAuth Services ID",
    description: "Apple \"Services ID\" (e.g. com.locateflow.auth) used as client_id for Sign in with Apple.",
    scope: "WEB",
    category: "OAUTH",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "APPLE_OAUTH_TEAM_ID",
    label: "Apple Team ID",
    description: "Apple Developer Team ID (10-char) used to sign the Apple OAuth client_secret JWT.",
    scope: "WEB",
    category: "OAUTH",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "APPLE_OAUTH_KEY_ID",
    label: "Apple OAuth Key ID",
    description: "Key ID of the Apple Sign in with Apple .p8 private key.",
    scope: "WEB",
    category: "OAUTH",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "APPLE_OAUTH_PRIVATE_KEY",
    label: "Apple OAuth Private Key (.p8)",
    description: "PEM contents of the Apple Sign in with Apple .p8 private key. Include BEGIN/END lines.",
    scope: "WEB",
    category: "OAUTH",
    isSecret: true,
    requiredInProduction: false,
    maskStrategy: "secret",
  },

  // ── Mobile IAP (Apple App Store + Google Play) ─────────────
  {
    key: "APPLE_BUNDLE_ID",
    label: "Apple Bundle ID",
    description: "iOS app bundle identifier (e.g. com.locateflow.mobile) — used to scope App Store Server API calls and validate JWS payloads.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "APPLE_APP_STORE_ISSUER_ID",
    label: "App Store Connect Issuer ID",
    description: "UUID-shaped issuer ID from App Store Connect → Users and Access → Integrations → App Store Server API.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "APPLE_APP_STORE_KEY_ID",
    label: "App Store Connect Key ID",
    description: "10-char Key ID paired with the App Store Server API .p8 private key.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "APPLE_APP_STORE_PRIVATE_KEY",
    label: "App Store Connect Private Key (.p8)",
    description: "PEM contents of the App Store Server API .p8 private key used to mint ES256 bearer tokens.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: true,
    requiredInProduction: false,
    maskStrategy: "secret",
  },
  {
    key: "APPLE_APP_STORE_ENVIRONMENT",
    label: "Apple Environment",
    description: "Default App Store environment to query first: `Sandbox` for development, `Production` for live apps. JWS payloads override this per-transaction.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "plain",
  },
  {
    key: "MOBILE_IOS_PRODUCT_INDIVIDUAL",
    label: "iOS Product ID — Individual (monthly)",
    description: "App Store product identifier for the Individual monthly mobile subscription.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY",
    label: "iOS Product ID — Individual (annual)",
    description: "App Store product identifier for the Individual annual mobile subscription. The 3-month free trial is configured as an introductory offer in App Store Connect, not in this app.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "GOOGLE_PLAY_PACKAGE_NAME",
    label: "Google Play Package Name",
    description: "Android app package name (e.g. com.locateflow.mobile) used to scope Google Play Developer API calls.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
    label: "Google Play Service Account Email",
    description: "Service account email (from Google Cloud) granted \"Financial data\" access in Play Console.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "email",
  },
  {
    key: "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
    label: "Google Play Service Account Private Key",
    description: "PEM contents of the service account's private key used to mint RS256 OAuth2 tokens. Include BEGIN/END PRIVATE KEY lines.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: true,
    requiredInProduction: false,
    maskStrategy: "secret",
  },
  {
    key: "GOOGLE_PLAY_RTDN_AUDIENCE",
    label: "Google Play RTDN OIDC Audience",
    description: "Expected `aud` claim in the OIDC token Pub/Sub sends with push notifications (typically the webhook URL itself, e.g. https://app.example.com/api/webhooks/playstore). Production Play Store webhooks reject when this is missing.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "url",
  },
  {
    key: "EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL",
    label: "Expected Play Store Webhook Service Account",
    description: "Expected service account email in Google Play Pub/Sub webhook OIDC tokens.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "email",
  },
  {
    key: "EXPECTED_PLAYSTORE_WEBHOOK_SUBJECT",
    label: "Expected Play Store Webhook Subject",
    description: "Expected subject claim in Google Play Pub/Sub webhook OIDC tokens.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "MOBILE_ANDROID_PRODUCT_INDIVIDUAL",
    label: "Android Product ID — Individual (monthly)",
    description: "Google Play product/subscription identifier for the Individual monthly mobile plan.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
  {
    key: "MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY",
    label: "Android Product ID — Individual (annual)",
    description: "Google Play product/subscription identifier for the Individual annual mobile plan. The 3-month free trial is a Play Console base-plan offer, not a flag set by this app.",
    scope: "MOBILE",
    category: "MOBILE_BILLING",
    isSecret: false,
    requiredInProduction: false,
    maskStrategy: "id",
  },
];

export function getRuntimeConfigDefinition(key: string): RuntimeConfigDefinition | null {
  return RUNTIME_CONFIG_DEFINITIONS.find((definition) => definition.key === key) || null;
}

export function isManagedRuntimeConfigKey(key: string): boolean {
  return RUNTIME_CONFIG_DEFINITIONS.some((definition) => definition.key === key);
}

export function normalizeRuntimeConfigValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }
  return trimmed;
}

export function isRuntimeConfigDbBackedKeyAllowed(
  keyOrDefinition: string | RuntimeConfigDefinition,
): boolean {
  const definition =
    typeof keyOrDefinition === "string"
      ? getRuntimeConfigDefinition(keyOrDefinition)
      : keyOrDefinition;
  if (!definition) return false;
  return definition.runtimeEditable !== false && !definition.buildTimeOnly;
}

export function isProductionLikeRuntimeConfigEnv(
  env: Record<string, string | undefined> = {},
): boolean {
  const appEnv = (env.APP_ENV || env.VERCEL_ENV || "").toLowerCase();
  return (
    env.NODE_ENV === "production" ||
    appEnv === "production" ||
    appEnv === "staging" ||
    appEnv === "preview" ||
    Boolean(env.DIGITALOCEAN_APP_ID)
  );
}

export function isRuntimeConfigRequired(
  definition: RuntimeConfigDefinition,
  env: Record<string, string | undefined> = {},
  productionLike = isProductionLikeRuntimeConfigEnv(env),
): boolean {
  return productionLike && definition.requiredInProduction;
}

export interface RuntimeConfigValidationResult {
  ok: boolean;
  reason: string | null;
  confidence?: "strong" | "weak";
  warning?: string | null;
}

function validEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extractEmailAddress(value: string): string {
  const angle = value.match(/<([^<>]+)>/);
  return (angle?.[1] || value).trim();
}

function isLoopbackOrPrivateHost(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();
  return (
    lowerHost === "localhost" ||
    lowerHost === "127.0.0.1" ||
    lowerHost === "0.0.0.0" ||
    lowerHost === "::1" ||
    lowerHost.endsWith(".local") ||
    lowerHost.endsWith(".internal") ||
    lowerHost === "metadata.google.internal" ||
    /^10\./.test(lowerHost) ||
    /^192\.168\./.test(lowerHost) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(lowerHost) ||
    /^169\.254\./.test(lowerHost)
  );
}

function validateUrl(value: string, options: { requireHttps?: boolean; allowDatabaseScheme?: boolean } = {}) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "not_a_url";
  }
  if (options.allowDatabaseScheme) return null;
  if (!["http:", "https:"].includes(parsed.protocol)) return "non_http_scheme";
  if (options.requireHttps && parsed.protocol !== "https:") return "requires_https";
  if (isLoopbackOrPrivateHost(parsed.hostname)) return "internal_or_loopback_host";
  return null;
}

export interface RuntimeConfigValidationOptions {
  productionLike?: boolean;
}

function valid(value: Partial<RuntimeConfigValidationResult> = {}): RuntimeConfigValidationResult {
  return { ok: true, reason: null, confidence: "strong", ...value };
}

function invalid(reason: string): RuntimeConfigValidationResult {
  return { ok: false, reason, confidence: "strong" };
}

function needsReview(reason: string): RuntimeConfigValidationResult {
  return {
    ok: true,
    reason: null,
    confidence: "weak",
    warning: reason,
  };
}

function looksLikeMaskedRuntimeConfigValue(value: string): boolean {
  const trimmed = value.trim();
  if (/^\[REDACTED\]$/i.test(trimmed)) return true;
  if (/^\*{4,}[A-Za-z0-9_-]{1,12}$/.test(trimmed)) return true;
  if (/^[A-Za-z0-9_-]{1,8}\*{3,}[A-Za-z0-9_-]{1,12}$/.test(trimmed)) return true;
  if (/^[A-Za-z0-9_-]{1,8}\.\.\.[A-Za-z0-9_-]{1,12}$/.test(trimmed)) return true;
  return false;
}

function containsPlaceholderSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (
    [
      "test",
      "secret",
      "changeme",
      "change_me",
      "change-me",
      "password",
      "123456",
      "dummy",
      "example",
      "placeholder",
      "replace_me",
      "replace-me",
      "your_secret",
      "your-secret",
    ].includes(normalized)
  ) {
    return true;
  }
  return /(^|[_\-.])(test|secret|changeme|change_me|change-me|replace_me|replace-me|placeholder|dummy|example|password|123456)([_\-.]|$)/i.test(value) ||
    /(changeme|change_me|replace_me|placeholder|dummy_secret|your_secret|password123)/i.test(value);
}

function validateSecretStrength(value: string, minLength = 24): RuntimeConfigValidationResult | null {
  if (looksLikeMaskedRuntimeConfigValue(value)) return invalid("masked_value");
  if (containsPlaceholderSecret(value)) return invalid("placeholder_secret");
  if (value.length < minLength) return invalid("secret_too_short");
  return null;
}

function validatePrefixedSecretPayload(
  value: string,
  prefix: RegExp,
  minPayloadLength = 8,
): RuntimeConfigValidationResult | null {
  if (looksLikeMaskedRuntimeConfigValue(value)) return invalid("masked_value");
  const payload = value.replace(prefix, "");
  if (containsPlaceholderSecret(payload)) return invalid("placeholder_secret");
  if (payload.length < minPayloadLength) return invalid("secret_too_short");
  return null;
}

function validateSafeToken(
  value: string,
  options: { minLength?: number; pattern?: RegExp; reason?: string } = {},
): RuntimeConfigValidationResult | null {
  if (looksLikeMaskedRuntimeConfigValue(value)) return invalid("masked_value");
  if (value.length < (options.minLength ?? 3)) return invalid("value_too_short");
  if (options.pattern && !options.pattern.test(value)) return invalid(options.reason || "invalid_identifier");
  return null;
}

function looksLikePemPrivateKey(value: string): boolean {
  const normalized = value.replace(/\\n/g, "\n").trim();
  return /^-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----\n[\s\S]+\n-----END [A-Z0-9 ]*PRIVATE KEY-----$/.test(normalized);
}

function validateProductId(value: string): RuntimeConfigValidationResult | null {
  return validateSafeToken(value, {
    minLength: 3,
    pattern: /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/,
    reason: "product_id_pattern",
  });
}

function validateBucketName(value: string): RuntimeConfigValidationResult | null {
  return validateSafeToken(value, {
    minLength: 3,
    pattern: /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
    reason: "bucket_name_pattern",
  });
}

function validateRegion(value: string): RuntimeConfigValidationResult | null {
  return validateSafeToken(value, {
    minLength: 2,
    pattern: /^[a-z]{2}(?:-[a-z]+)+-\d$|^auto$|^global$/,
    reason: "region_pattern",
  });
}

function validateServiceAccountEmail(value: string): RuntimeConfigValidationResult | null {
  const email = extractEmailAddress(value);
  if (!validEmailAddress(email)) return invalid("email_required");
  if (!/@[A-Za-z0-9.-]+\.iam\.gserviceaccount\.com$/i.test(email)) {
    return invalid("service_account_email_required");
  }
  return null;
}

export function validateRuntimeConfigValueShape(
  key: string,
  rawValue: string | null | undefined,
  options: RuntimeConfigValidationOptions = {},
): RuntimeConfigValidationResult {
  const value = normalizeRuntimeConfigValue(rawValue);
  if (!value) return invalid("missing");
  const productionLike = options.productionLike ?? isProductionLikeRuntimeConfigEnv();
  const definition = getRuntimeConfigDefinition(key);

  if (looksLikeMaskedRuntimeConfigValue(value)) {
    return invalid("masked_value");
  }

  if (key === "NODE_ENV" && value !== "production") {
    return invalid("production_required");
  }
  if (key === "APP_ENV" && !["production", "staging", "preview"].includes(value.toLowerCase())) {
    return invalid("production_like_required");
  }
  if (key === "DATABASE_URL") {
    const reason = validateUrl(value, { allowDatabaseScheme: true });
    return reason ? invalid(reason) : valid();
  }

  const HTTPS_URL_KEYS = new Set([
    "APP_URL",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_ADMIN_URL",
    "NEXT_PUBLIC_API_URL",
    "EXPO_PUBLIC_API_URL",
    "EXPO_PUBLIC_APP_URL",
    "UPSTASH_REDIS_REST_URL",
    "R2_ENDPOINT",
    "R2_PUBLIC_BASE_URL",
    "BACKUP_STORAGE_ENDPOINT",
    "NEXT_PUBLIC_IMGPROXY_URL",
    "STRIPE_PORTAL_RETURN_URL",
    "GOOGLE_PLAY_RTDN_AUDIENCE",
    "SLACK_WEBHOOK_URL",
  ]);
  const URL_KEYS = new Set([
    ...HTTPS_URL_KEYS,
    "NEXT_PUBLIC_SENTRY_DSN",
    "EXPO_PUBLIC_SENTRY_DSN",
    "SLACK_WEBHOOK_URL",
  ]);
  if (URL_KEYS.has(key)) {
    const reason = validateUrl(value, { requireHttps: HTTPS_URL_KEYS.has(key) });
    return reason ? invalid(reason) : valid();
  }

  if (key === "FIELD_ENCRYPTION_KEY" || key === "IMGPROXY_KEY" || key === "IMGPROXY_SALT") {
    return /^[0-9a-fA-F]{64}$/.test(value)
      ? valid()
      : invalid("hex_64_required");
  }

  const MIN_SECRET_LEN: Record<string, number> = {
    USER_JWT_SECRET: 32,
    ADMIN_JWT_SECRET: 32,
    CRON_SECRET: 32,
    INTERNAL_WEBHOOK_SECRET: 32,
    IMPERSONATION_HANDOFF_SECRET: 32,
    BACKUP_HMAC_SECRET: 32,
    UPSTASH_REDIS_REST_TOKEN: 16,
  };
  if (MIN_SECRET_LEN[key]) {
    if (value.includes("REPLACE") || /^(test|dev|dummy|changeme)/i.test(value)) {
      return invalid("placeholder_secret");
    }
    return value.length >= MIN_SECRET_LEN[key]
      ? valid()
      : invalid("secret_too_short");
  }

  if (key === "STRIPE_SECRET_KEY") {
    if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(value)) return invalid("stripe_secret_prefix");
    const weak = validatePrefixedSecretPayload(value, /^sk_(test|live)_/);
    if (weak) return weak;
    if (productionLike && !value.startsWith("sk_live_")) return invalid("stripe_live_secret_required");
    return valid();
  }
  if (key === "STRIPE_WEBHOOK_SECRET") {
    if (!/^whsec_[A-Za-z0-9_-]{16,}$/.test(value)) return invalid("stripe_webhook_prefix");
    const weak = validatePrefixedSecretPayload(value, /^whsec_/, 12);
    return weak || valid();
  }
  if (key === "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") {
    if (!/^pk_(test|live)_[A-Za-z0-9]+$/.test(value)) return invalid("stripe_publishable_prefix");
    const weak = validatePrefixedSecretPayload(value, /^pk_(test|live)_/);
    if (weak) return weak;
    if (productionLike && !value.startsWith("pk_live_")) return invalid("stripe_live_publishable_required");
    return valid();
  }
  if (key.startsWith("STRIPE_PRICE_")) {
    return /^price_[A-Za-z0-9]+$/.test(value)
      ? valid()
      : invalid("stripe_price_prefix");
  }
  if (key === "RESEND_API_KEY") {
    if (!/^re_[A-Za-z0-9_-]+$/.test(value)) return invalid("resend_prefix");
    const weak = validatePrefixedSecretPayload(value, /^re_/, 6);
    return weak || valid();
  }

  const BOOLEAN_KEYS = new Set([
    "STRIPE_RUNTIME_CONFIG_OVERRIDE",
    "STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED",
    "FEATURE_FLAGS_ENABLED",
    "ALLOW_PRODUCTION_REPLACE_RESTORE",
    "PLACES_AUTOCOMPLETE_ENABLED",
    "NOTIFICATION_PUSH_ENABLED",
  ]);
  if (BOOLEAN_KEYS.has(key)) {
    return value === "true" || value === "false"
      ? valid()
      : invalid("boolean_required");
  }

  const INTEGER_KEYS = new Set([
    "PLACES_AUTOCOMPLETE_DAILY_LIMIT",
    "PLACES_AUTOCOMPLETE_DAILY_USER_LIMIT",
    "PLACES_AUTOCOMPLETE_DAILY_IP_LIMIT",
    "PLACES_DETAILS_DAILY_USER_LIMIT",
    "PLACES_DETAILS_DAILY_IP_LIMIT",
  ]);
  if (INTEGER_KEYS.has(key)) {
    return /^[1-9]\d*$/.test(value)
      ? valid()
      : invalid("positive_integer_required");
  }
  if (key === "STRIPE_ANNUAL_TRIAL_DAYS") {
    return /^(0|[1-9]\d*)$/.test(value)
      ? valid()
      : invalid("non_negative_integer_required");
  }

  const EMAIL_KEYS = new Set([
    "EMAIL_FROM",
    "EMAIL_REPLY_TO",
    "ALERT_EMAIL_FROM",
    "ALERT_EMAIL_TO",
    "ADMIN_ALERT_EMAIL",
    "SUPPORT_EMAIL",
  ]);
  if (EMAIL_KEYS.has(key)) {
    const emails = key === "ALERT_EMAIL_TO"
      ? value.split(",").map((email) => email.trim()).filter(Boolean)
      : [extractEmailAddress(value)];
    return emails.length > 0 && emails.every(validEmailAddress)
      ? valid()
      : invalid("email_required");
  }

  if (key === "BACKUP_STORAGE_PROVIDER") {
    return ["s3", "s3-compatible", "aws-s3", "r2", "cloudflare-r2"].includes(value.toLowerCase())
      ? valid()
      : invalid("storage_provider");
  }
  if (key === "BACKUP_STORAGE_BUCKET" || key === "R2_BUCKET") {
    return validateBucketName(value) || valid();
  }
  if (key === "BACKUP_STORAGE_REGION" || key === "R2_REGION") {
    return validateRegion(value) || valid();
  }
  if (key === "BACKUP_STORAGE_ACCESS_KEY_ID" || key === "R2_ACCESS_KEY_ID") {
    return validateSafeToken(value, {
      minLength: 8,
      pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/,
      reason: "access_key_pattern",
    }) || valid();
  }
  if (key === "BACKUP_STORAGE_SECRET_ACCESS_KEY" || key === "R2_SECRET_ACCESS_KEY") {
    return validateSecretStrength(value, 24) || valid();
  }

  if (
    key === "APPLE_OAUTH_PRIVATE_KEY" ||
    key === "APPLE_APP_STORE_PRIVATE_KEY" ||
    key === "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY" ||
    key === "APPLE_IAP_PRIVATE_KEY"
  ) {
    const secretProblem = validateSecretStrength(value, 48);
    if (secretProblem && secretProblem.reason !== "secret_too_short") return secretProblem;
    if (!looksLikePemPrivateKey(value)) return invalid("private_key_pem_required");
    return secretProblem || valid();
  }
  if (key === "APPLE_OAUTH_TEAM_ID") {
    return /^[A-Z0-9]{10}$/.test(value) ? valid() : invalid("apple_team_id_pattern");
  }
  if (key === "APPLE_OAUTH_KEY_ID" || key === "APPLE_APP_STORE_KEY_ID") {
    return /^[A-Z0-9]{10}$/.test(value) ? valid() : invalid("apple_key_id_pattern");
  }
  if (key === "APPLE_APP_STORE_ENVIRONMENT") {
    return ["sandbox", "production"].includes(value.toLowerCase())
      ? valid()
      : invalid("apple_environment");
  }
  if (
    key === "APPLE_BUNDLE_ID" ||
    key === "APPLE_OAUTH_CLIENT_ID" ||
    key === "MOBILE_IOS_PRODUCT_INDIVIDUAL" ||
    key === "MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY" ||
    key === "MOBILE_ANDROID_PRODUCT_INDIVIDUAL" ||
    key === "MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY"
  ) {
    return validateProductId(value) || valid();
  }
  if (key === "GOOGLE_PLAY_PACKAGE_NAME") {
    return /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,}$/.test(value)
      ? valid()
      : invalid("android_package_pattern");
  }
  if (key === "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL" || key === "EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL") {
    return validateServiceAccountEmail(value) || valid();
  }

  if (definition?.isSecret) {
    return validateSecretStrength(value, 24) || needsReview("present_but_not_fully_verified");
  }
  if (definition && definition.maskStrategy === "id") {
    return validateSafeToken(value, { minLength: 3 }) || needsReview("present_but_not_fully_verified");
  }

  return valid();
}

export interface RuntimeConfigResolution {
  configured: boolean;
  source: RuntimeConfigSource;
  status: RuntimeConfigStatus;
  effectiveValue: string | null;
  maskedValue: string | null;
  editable: RuntimeConfigEditable;
  validation: string;
  dbOverrideIgnored: boolean;
  conflict: boolean;
  notes: string[];
}

export function resolveRuntimeConfigResolution(input: {
  definition: RuntimeConfigDefinition;
  env?: Record<string, string | undefined>;
  dbValue?: string | null;
  productionLike?: boolean;
}): RuntimeConfigResolution {
  const env = input.env || {};
  const productionLike = input.productionLike ?? isProductionLikeRuntimeConfigEnv(env);
  const definition = input.definition;
  const envValue = normalizeRuntimeConfigValue(getRuntimeConfigEnvValue(definition.key, env));
  const dbValue = normalizeRuntimeConfigValue(input.dbValue);
  const dbAllowed = isRuntimeConfigDbBackedKeyAllowed(definition);
  const overrideEnabled =
    isRuntimeConfigDbOverrideEnabled(env) &&
    (RUNTIME_CONFIG_DB_OVERRIDE_KEYS as readonly string[]).includes(definition.key);
  const hasEnv = Boolean(envValue);
  const hasDb = Boolean(dbValue);
  const source: RuntimeConfigSource = hasEnv && hasDb
    ? "ENV + Runtime Config"
    : hasEnv
      ? "ENV"
      : hasDb
        ? "Runtime Config"
        : "Missing";
  const required = isRuntimeConfigRequired(definition, env, productionLike);
  const notes = [
    definition.note,
    definition.buildTimeOnly ? "Rebuild required after changing this deployment env value." : null,
    !dbAllowed ? "Managed by deployment environment; do not store this key in Runtime Config DB." : null,
  ].filter(Boolean) as string[];

  const effectiveValue = hasEnv && (!overrideEnabled || !dbAllowed)
    ? envValue
    : hasDb && dbAllowed
      ? dbValue
      : null;
  const validation = effectiveValue
    ? validateRuntimeConfigValueShape(definition.key, effectiveValue, { productionLike })
    : { ok: false, reason: "missing" };
  const dbOverrideIgnored = Boolean(hasEnv && hasDb && (!overrideEnabled || !dbAllowed));
  const conflict = Boolean(hasEnv && hasDb && !overrideEnabled);
  const editable: RuntimeConfigEditable = !dbAllowed || definition.buildTimeOnly
    ? "No"
    : hasEnv || definition.isSecret
      ? "Restricted"
      : "Yes";

  let status: RuntimeConfigStatus;
  if (!effectiveValue) {
    status = hasDb && !dbAllowed
      ? "Manual console action required"
      : required
        ? "Missing"
        : "Not required in this environment";
  } else if (!validation.ok) {
    status = "Invalid";
  } else if (validation.confidence === "weak") {
    status = "Needs review";
  } else if (conflict) {
    status = "Conflict";
  } else if (definition.buildTimeOnly) {
    status = "Build-time only";
  } else {
    status = source === "Runtime Config" ? "Verified from Runtime Config" : "Verified from ENV";
  }

  return {
    configured: Boolean(effectiveValue && validation.ok),
    source,
    status,
    effectiveValue,
    maskedValue: effectiveValue
      ? maskRuntimeConfigValue(effectiveValue, definition.maskStrategy)
      : hasDb
        ? maskRuntimeConfigValue(dbValue, definition.maskStrategy)
        : null,
    editable,
    validation: validation.ok ? validation.warning || "Valid" : validation.reason || "Invalid",
    dbOverrideIgnored,
    conflict,
    notes,
  };
}

const PUBLIC_SECRET_NAME_PATTERN = /(SECRET|TOKEN|PASSWORD|PRIVATE|ACCESS_KEY|WEBHOOK_SECRET)/i;

export function publicRuntimeConfigKeyLooksSecret(key: string): boolean {
  if (!key.startsWith("NEXT_PUBLIC_") && !key.startsWith("EXPO_PUBLIC_")) return false;
  return PUBLIC_SECRET_NAME_PATTERN.test(key);
}

export function maskRuntimeConfigValue(
  value: string | null | undefined,
  strategy: RuntimeConfigMaskStrategy = "secret"
): string | null {
  if (!value) return null;

  if (strategy === "plain") {
    return value;
  }

  if (strategy === "email") {
    const [localPart, domain = ""] = value.split("@");
    if (!localPart) return "***";
    const safeLocal = localPart.length <= 2
      ? `${localPart[0] || "*"}***`
      : `${localPart.slice(0, 2)}***`;
    return domain ? `${safeLocal}@${domain}` : safeLocal;
  }

  if (strategy === "url") {
    try {
      const parsed = new URL(value);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-4)}` : value;
    }
  }

  if (strategy === "id") {
    if (value.length <= 10) return `${value.slice(0, 2)}***${value.slice(-2)}`;
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  if (value.length <= 8) {
    return `${value[0] || "*"}***${value.slice(-1)}`;
  }

  return `${value.slice(0, 2)}***${value.slice(-4)}`;
}
