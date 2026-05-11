import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/shared-encryption";
import {
  getRuntimeConfigDefinition,
  getRuntimeConfigEnvValue,
  isProductionLikeRuntimeConfigEnv,
  isRuntimeConfigDbBackedKeyAllowed,
  normalizeRuntimeConfigValue,
  RUNTIME_CONFIG_DEFINITIONS,
  resolveRuntimeConfigResolution,
  shouldPreferEnvRuntimeConfigValue,
  STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG,
  validateRuntimeConfigValueShape,
  type RuntimeConfigDefinition,
  type RuntimeConfigEditable,
  type RuntimeConfigSource,
  type RuntimeConfigStatus,
} from "@/lib/shared-runtime-config";

// Re-export so callers don't have to know whether the symbol lives in
// `@/lib/runtime-config` or `@/lib/shared-runtime-config`.
export type { RuntimeConfigEditable, RuntimeConfigSource, RuntimeConfigStatus };

export interface RuntimeConfigCatalogItem {
  key: string;
  label: string;
  description: string;
  scope: string;
  category: string;
  isSecret: boolean;
  requiredInProduction: boolean;
  configured: boolean;
  source: RuntimeConfigSource;
  status: RuntimeConfigStatus;
  editable: RuntimeConfigEditable;
  maskedValue: string | null;
  warning: string | null;
  dbOverrideIgnored: boolean;
  usedBy: readonly string[];
  validation: string;
  notes: string[];
  buildTimeOnly: boolean;
  conflict: boolean;
  updatedAt: string | null;
  lastValidatedAt: string | null;
  lastValidationStatus: string | null;
}

interface RuntimeConfigEntryRecord {
  key: string;
  isSecret: boolean;
  valueEncrypted: string | null;
  valuePlain: string | null;
  isActive: boolean;
  source: string;
  updatedAt: Date;
  lastValidatedAt: Date | null;
  lastValidationStatus: string | null;
}

function resolveEntryValue(entry: RuntimeConfigEntryRecord | null | undefined) {
  if (!entry || !entry.isActive) return null;
  if (entry.isSecret) {
    return entry.valueEncrypted ? decrypt(entry.valueEncrypted) : null;
  }
  return entry.valuePlain;
}

function resolveEnvValue(definition: RuntimeConfigDefinition) {
  return getRuntimeConfigEnvValue(definition.key, process.env);
}

export async function getAdminRuntimeConfigValue(key: string): Promise<string | null> {
  const definition = getRuntimeConfigDefinition(key);
  const envValue = definition
    ? normalizeRuntimeConfigValue(resolveEnvValue(definition))
    : normalizeRuntimeConfigValue(process.env[key] || null);
  if (envValue && (!definition || shouldPreferEnvRuntimeConfigValue(definition.key, process.env))) {
    return envValue;
  }

  const entry = await prisma.runtimeConfigEntry.findUnique({
    where: { key },
    select: {
      key: true,
      isSecret: true,
      valueEncrypted: true,
      valuePlain: true,
      isActive: true,
      source: true,
      updatedAt: true,
      lastValidatedAt: true,
      lastValidationStatus: true,
    },
  }).catch(() => null as RuntimeConfigEntryRecord | null);

  const storedValue = normalizeRuntimeConfigValue(resolveEntryValue(entry));
  if (storedValue && definition && isRuntimeConfigDbBackedKeyAllowed(definition)) {
    return storedValue;
  }
  return envValue;
}

export async function getAdminRuntimeConfigValues(keys: string[]) {
  const values = await Promise.all(keys.map(async (key) => [key, await getAdminRuntimeConfigValue(key)] as const));
  return Object.fromEntries(values);
}

function buildCatalogItem(
  definition: RuntimeConfigDefinition,
  entry: RuntimeConfigEntryRecord | null | undefined
): RuntimeConfigCatalogItem {
  const entryValue = normalizeRuntimeConfigValue(resolveEntryValue(entry));
  const resolution = resolveRuntimeConfigResolution({
    definition,
    env: process.env,
    dbValue: entryValue,
  });

  let warning: string | null = null;
  if (resolution.dbOverrideIgnored) {
    warning = `A Runtime Config DB value exists for this key, but deployment env (DigitalOcean) is authoritative and is being used. Remove the DB value to silence this warning, or set ${STRIPE_RUNTIME_CONFIG_OVERRIDE_FLAG}=true only for a deliberate Stripe break-glass override.`;
  } else if (definition.runtimeEditable === false && entryValue) {
    // Defense in depth — runtimeEditable=false means the key is meant
    // to live only in deployment env. If a DB row somehow exists,
    // surface that explicitly so an operator notices.
    warning = "This key is deployment-only — DB rows are ignored. Remove the DB row via Reset to ENV.";
  } else if (definition.buildTimeOnly && resolution.configured) {
    warning = "Build-time only; changes require a rebuild and redeploy.";
  }

  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    scope: definition.scope,
    category: definition.category,
    isSecret: definition.isSecret,
    requiredInProduction: definition.requiredInProduction,
    configured: resolution.configured,
    source: resolution.source,
    status: resolution.status,
    editable: resolution.editable,
    maskedValue: resolution.maskedValue,
    warning,
    dbOverrideIgnored: resolution.dbOverrideIgnored,
    usedBy: definition.usedBy ?? [definition.scope.toLowerCase()],
    validation: resolution.validation,
    notes: resolution.notes,
    buildTimeOnly: definition.buildTimeOnly === true,
    conflict: resolution.conflict,
    updatedAt: entry?.updatedAt?.toISOString() || null,
    lastValidatedAt: entry?.lastValidatedAt?.toISOString() || null,
    lastValidationStatus: entry?.lastValidationStatus || null,
  };
}

export async function listRuntimeConfigCatalog(): Promise<RuntimeConfigCatalogItem[]> {
  const entries = await prisma.runtimeConfigEntry.findMany({
    select: {
      key: true,
      isSecret: true,
      valueEncrypted: true,
      valuePlain: true,
      isActive: true,
      source: true,
      updatedAt: true,
      lastValidatedAt: true,
      lastValidationStatus: true,
    },
  }).catch(() => [] as RuntimeConfigEntryRecord[]);
  const entryMap = new Map<string, RuntimeConfigEntryRecord>(
    entries.map((entry: RuntimeConfigEntryRecord) => [entry.key, entry]),
  );

  return RUNTIME_CONFIG_DEFINITIONS
    .map((definition) => buildCatalogItem(definition, entryMap.get(definition.key)))
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

/**
 * Validate a runtime-config value against the format expected for the
 * given key. Most keys accept any non-empty string (label, description,
 * email, etc.) but high-impact keys (URLs that the app fetches,
 * encryption keys, billing secrets) must match a stricter shape so an
 * operator can't paste a typo or an attacker-friendly URL into a
 * security-critical setting.
 *
 * Throws `INVALID_RUNTIME_CONFIG_VALUE:<reason>` on rejection.
 */
function assertRuntimeConfigValueShape(key: string, value: string): void {
  const sharedValidation = validateRuntimeConfigValueShape(key, value, {
    productionLike: isProductionLikeRuntimeConfigEnv(process.env),
  });
  if (!sharedValidation.ok && sharedValidation.reason && sharedValidation.reason !== "missing") {
    throw new Error(`INVALID_RUNTIME_CONFIG_VALUE:${sharedValidation.reason}`);
  }

  // URLs that the app calls outbound — must be HTTPS and not loopback /
  // private IPs / metadata services. We don't run a full DNS lookup
  // here (that's an async step in the SSRF guard); a string-level
  // check is enough to reject the obvious bad cases.
  const URL_KEYS = new Set([
    "UPSTASH_REDIS_REST_URL",
    "REDIS_URL",
    "DATABASE_URL",
    "RESEND_BASE_URL",
    "GLITCHTIP_DSN",
    "NEXT_PUBLIC_SENTRY_DSN",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_IMGPROXY_URL",
    "R2_ENDPOINT",
    "R2_PUBLIC_BASE_URL",
    "STRIPE_PORTAL_RETURN_URL",
  ]);
  if (URL_KEYS.has(key)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("INVALID_RUNTIME_CONFIG_VALUE:not_a_url");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("INVALID_RUNTIME_CONFIG_VALUE:non_http_scheme");
    }
    // DATABASE_URL / REDIS_URL may legitimately be non-http schemes —
    // exclude them from the http-only check above.
    if (key === "DATABASE_URL" || key === "REDIS_URL") {
      // No further URL shape constraint here — Prisma/redis libraries
      // will validate on connect.
    } else {
      const lowerHost = url.hostname.toLowerCase();
      const literalLoopback =
        lowerHost === "localhost" ||
        lowerHost === "127.0.0.1" ||
        lowerHost === "0.0.0.0" ||
        lowerHost === "::1" ||
        lowerHost.endsWith(".local") ||
        lowerHost.endsWith(".internal") ||
        lowerHost === "metadata.google.internal";
      if (literalLoopback) {
        throw new Error("INVALID_RUNTIME_CONFIG_VALUE:internal_or_loopback_host");
      }
      // RFC1918 + link-local literal IPs.
      if (/^10\./.test(lowerHost)) throw new Error("INVALID_RUNTIME_CONFIG_VALUE:private_ip");
      if (/^192\.168\./.test(lowerHost)) throw new Error("INVALID_RUNTIME_CONFIG_VALUE:private_ip");
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(lowerHost)) throw new Error("INVALID_RUNTIME_CONFIG_VALUE:private_ip");
      if (/^169\.254\./.test(lowerHost)) throw new Error("INVALID_RUNTIME_CONFIG_VALUE:link_local_ip");
    }
    // For Upstash / R2, require HTTPS — these are exposed to the
    // public internet and accept tokens.
    if (
      (key === "UPSTASH_REDIS_REST_URL" ||
        key === "R2_ENDPOINT" ||
        key === "R2_PUBLIC_BASE_URL" ||
        key === "NEXT_PUBLIC_IMGPROXY_URL" ||
        key === "STRIPE_PORTAL_RETURN_URL" ||
        key.startsWith("NEXT_PUBLIC_")) &&
      url.protocol !== "https:"
    ) {
      throw new Error("INVALID_RUNTIME_CONFIG_VALUE:requires_https");
    }
  }

  // Hex-encoded keys (encryption / image proxy) must be exactly 64 hex
  // chars (256 bits). A pasted base64 string or short value must fail
  // here, not at runtime when the first request decrypts.
  const HEX_KEYS = new Set([
    "FIELD_ENCRYPTION_KEY",
    "IMGPROXY_KEY",
    "IMGPROXY_SALT",
  ]);
  if (HEX_KEYS.has(key)) {
    if (!/^[0-9a-fA-F]{64}$/.test(value)) {
      throw new Error("INVALID_RUNTIME_CONFIG_VALUE:hex_64_required");
    }
  }

  // Stripe keys must use the documented prefixes. An admin who pastes
  // a Stripe Connect or restricted key into the secret-key slot will
  // see this 400 before billing fails downstream.
  if (key === "STRIPE_SECRET_KEY") {
    if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(value)) {
      throw new Error("INVALID_RUNTIME_CONFIG_VALUE:stripe_secret_prefix");
    }
  }
  if (key === "STRIPE_WEBHOOK_SECRET") {
    if (!/^whsec_[A-Za-z0-9_-]+$/.test(value)) {
      throw new Error("INVALID_RUNTIME_CONFIG_VALUE:stripe_webhook_prefix");
    }
  }
  if (key === "RESEND_API_KEY") {
    if (!/^re_[A-Za-z0-9_-]+$/.test(value)) {
      throw new Error("INVALID_RUNTIME_CONFIG_VALUE:resend_prefix");
    }
  }

  // High-entropy secrets must meet a minimum length so an admin cannot
  // weaken security by pasting an obviously-short value.
  const MIN_SECRET_LEN: Record<string, number> = {
    USER_JWT_SECRET: 32,
    ADMIN_JWT_SECRET: 32,
    CRON_SECRET: 32,
    INTERNAL_WEBHOOK_SECRET: 32,
    BACKUP_HMAC_SECRET: 32,
    UPSTASH_REDIS_REST_TOKEN: 16,
  };
  if (MIN_SECRET_LEN[key] && value.length < MIN_SECRET_LEN[key]) {
    throw new Error("INVALID_RUNTIME_CONFIG_VALUE:secret_too_short");
  }

  // Booleans must be exactly "true" or "false" — typos like "TRUE",
  // "1", "yes" become booleans elsewhere and silently change behavior.
  const BOOLEAN_KEYS = new Set([
    "STRIPE_RUNTIME_CONFIG_OVERRIDE",
    "FEATURE_FLAGS_ENABLED",
    "ALLOW_PRODUCTION_REPLACE_RESTORE",
  ]);
  if (BOOLEAN_KEYS.has(key)) {
    if (value !== "true" && value !== "false") {
      throw new Error("INVALID_RUNTIME_CONFIG_VALUE:boolean_required");
    }
  }
}

export async function upsertRuntimeConfigEntry(input: {
  key: string;
  value: string;
  adminId: string;
  note?: string | null;
}) {
  const definition = getRuntimeConfigDefinition(input.key);
  if (!definition) {
    throw new Error("UNKNOWN_RUNTIME_CONFIG_KEY");
  }

  const trimmed = input.value.trim();
  if (!trimmed) {
    throw new Error("EMPTY_RUNTIME_CONFIG_VALUE");
  }

  // Per-key shape validation — see assertRuntimeConfigValueShape above.
  // Throws a discriminated INVALID_RUNTIME_CONFIG_VALUE:<reason> error
  // that the route handler maps to a 400. Run shape validation first
  // so the admin gets the most useful error message (e.g. "must be 64
  // hex chars") even on a key that ultimately turns out to be
  // deployment-only.
  assertRuntimeConfigValueShape(definition.key, trimmed);

  // Deployment-only keys (USER_JWT_SECRET, ADMIN_JWT_SECRET,
  // FIELD_ENCRYPTION_KEY, CRON_SECRET, INTERNAL_WEBHOOK_SECRET,
  // IMPERSONATION_HANDOFF_SECRET, UPSTASH_REDIS_*, NODE_ENV, APP_ENV,
  // DATABASE_URL) must never be DB-backed. They live only in
  // DigitalOcean / process.env so a single Runtime Config DB write
  // cannot silently shadow infrastructure config.
  if (!isRuntimeConfigDbBackedKeyAllowed(definition)) {
    throw new Error("RUNTIME_CONFIG_NOT_EDITABLE");
  }

  const data = {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    scope: definition.scope,
    category: definition.category,
    isSecret: definition.isSecret,
    valueEncrypted: definition.isSecret ? encrypt(trimmed) : null,
    valuePlain: definition.isSecret ? null : trimmed,
    isActive: true,
    source: "DB",
    updatedByAdminId: input.adminId,
    rotationNotes: input.note || null,
    lastValidatedAt: new Date(),
    lastValidationStatus: "CONFIGURED",
  };

  return prisma.runtimeConfigEntry.upsert({
    where: { key: definition.key },
    update: data,
    create: data,
  });
}

export async function resetRuntimeConfigEntry(key: string, adminId: string) {
  const definition = getRuntimeConfigDefinition(key);
  if (!definition) {
    throw new Error("UNKNOWN_RUNTIME_CONFIG_KEY");
  }

  const existing = await prisma.runtimeConfigEntry.findUnique({ where: { key } });
  if (!existing) return null;

  return prisma.runtimeConfigEntry.update({
    where: { key },
    data: {
      isActive: false,
      source: "ENV",
      updatedByAdminId: adminId,
      lastValidatedAt: new Date(),
      lastValidationStatus: resolveEnvValue(definition) ? "ENV_FALLBACK" : "MISSING",
    },
  });
}
