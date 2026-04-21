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
] as const;
export type RuntimeConfigCategory = (typeof RUNTIME_CONFIG_CATEGORY_VALUES)[number];

export type RuntimeConfigMaskStrategy = "secret" | "id" | "url" | "email" | "plain";

export interface RuntimeConfigDefinition {
  key: string;
  label: string;
  description: string;
  scope: RuntimeConfigScope;
  category: RuntimeConfigCategory;
  isSecret: boolean;
  requiredInProduction: boolean;
  maskStrategy: RuntimeConfigMaskStrategy;
}

export const RUNTIME_CONFIG_DEFINITIONS: readonly RuntimeConfigDefinition[] = [
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
    key: "STRIPE_PRICE_INDIVIDUAL",
    label: "Stripe Price ID — Individual (monthly)",
    description: "Stripe recurring price identifier for the Individual monthly web plan.",
    scope: "WEB",
    category: "BILLING",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "id",
  },
  {
    key: "STRIPE_PRICE_INDIVIDUAL_YEARLY",
    label: "Stripe Price ID — Individual (yearly)",
    description: "Stripe recurring price identifier for the Individual yearly web plan.",
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
    description: "Maps and Places API key for address autocomplete and location workflows.",
    scope: "GLOBAL",
    category: "MAPS",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
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
  },
  {
    key: "CRON_SECRET",
    label: "Cron Secret",
    description: "Bearer secret protecting scheduled jobs.",
    scope: "GLOBAL",
    category: "CRON",
    isSecret: true,
    requiredInProduction: true,
    maskStrategy: "secret",
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
    key: "NEXT_PUBLIC_APP_URL",
    label: "Public App URL",
    description: "Canonical public URL used for redirects, emails, and links.",
    scope: "GLOBAL",
    category: "APP",
    isSecret: false,
    requiredInProduction: true,
    maskStrategy: "url",
  },
];

export function getRuntimeConfigDefinition(key: string): RuntimeConfigDefinition | null {
  return RUNTIME_CONFIG_DEFINITIONS.find((definition) => definition.key === key) || null;
}

export function isManagedRuntimeConfigKey(key: string): boolean {
  return RUNTIME_CONFIG_DEFINITIONS.some((definition) => definition.key === key);
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
