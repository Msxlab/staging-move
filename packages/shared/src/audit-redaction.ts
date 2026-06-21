export const AUDIT_REDACTED_VALUE = "[REDACTED]";
export const AUDIT_TRUNCATED_VALUE = "[TRUNCATED]";
export const AUDIT_CIRCULAR_VALUE = "[CIRCULAR]";

export interface AuditRedactionOptions {
  maxDepth?: number;
  maxObjectKeys?: number;
  maxArrayItems?: number;
  maxStringLength?: number;
  /**
   * Dotted-path keys (relative to the redacted root) that should be kept
   * verbatim even when they would normally match a sensitive-key pattern.
   * Used to preserve forensically critical fields — e.g. `actor.email`
   * and `actor.role` on admin audit entries — without weakening the
   * blanket redaction for unrelated occurrences of the same key name.
   */
  preservePaths?: ReadonlyArray<string>;
}

const DEFAULT_OPTIONS: Required<Omit<AuditRedactionOptions, "preservePaths">> & { preservePaths: ReadonlyArray<string> } = {
  maxDepth: 6,
  maxObjectKeys: 50,
  maxArrayItems: 100,
  maxStringLength: 512,
  preservePaths: [],
};

const EXACT_SENSITIVE_KEYS = new Set(
  [
    "password",
    "token",
    "secret",
    "key",
    "mfa",
    "backupCode",
    "accountNumber",
    "routingNumber",
    "ssn",
    "taxId",
    "authorization",
    "cookie",
    "databaseUrl",
    "dbUrl",
    "DATABASE_URL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CRON_SECRET",
    "BACKUP_CRON_SECRET",
    "INTERNAL_WEBHOOK_SECRET",
    "IMPERSONATION_HANDOFF_SECRET",
    "phone",
    "email",
    "username",
    "notes",
    "note",
    "street",
    "street1",
    "street2",
    "city",
    "address",
    "formattedAddress",
    "placeId",
    "latitude",
    "longitude",
    "zip",
    "zipCode",
    "postalCode",
    "purchaseToken",
    "purchaseTokenEncrypted",
    "signedPayload",
    "signature",
    "rawBody",
  ].map(normalizeKey),
);

const PARTIAL_SENSITIVE_KEY_PATTERNS = [
  "password",
  "passwd",
  "pwd",
  "token",
  "secret",
  "apikey",
  "privatekey",
  "accesskey",
  "session",
  "cookie",
  "authorization",
  "mfa",
  "backupcode",
  "accountnumber",
  "routingnumber",
  "databaseurl",
  "dburl",
  "ssn",
  "taxid",
  "webhooksecret",
];

export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function shouldRedactAuditKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (EXACT_SENSITIVE_KEYS.has(normalized)) return true;
  if (normalized.endsWith("key")) return true;
  return PARTIAL_SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...[TRUNCATED:${value.length}]`;
}

type ResolvedRedactionOptions = Required<Omit<AuditRedactionOptions, "preservePaths">> & {
  preservedPathSet: ReadonlySet<string>;
};

function buildPreservedPathSet(paths: ReadonlyArray<string>): ReadonlySet<string> {
  const out = new Set<string>();
  for (const path of paths) {
    if (typeof path === "string" && path.length > 0) out.add(path);
  }
  return out;
}

function redactValue(
  input: unknown,
  options: ResolvedRedactionOptions,
  depth: number,
  seen: WeakSet<object>,
  path: string,
): unknown {
  if (depth > options.maxDepth) return AUDIT_TRUNCATED_VALUE;
  if (input == null) return input;

  if (typeof input === "string") return truncateString(input, options.maxStringLength);
  const inputType = typeof input;
  if (inputType === "number" || inputType === "boolean" || inputType === "bigint") return input;
  if (input instanceof Date) return input.toISOString();
  if (inputType !== "object") return undefined;

  if (seen.has(input as object)) return AUDIT_CIRCULAR_VALUE;
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input
      .slice(0, options.maxArrayItems)
      .map((item, index) => redactValue(item, options, depth + 1, seen, `${path}[${index}]`));
  }

  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (count >= options.maxObjectKeys) {
      out.__truncated__ = true;
      break;
    }
    count++;
    const childPath = path ? `${path}.${key}` : key;
    const preserve = options.preservedPathSet.has(childPath);
    if (!preserve && shouldRedactAuditKey(key)) {
      out[key] = AUDIT_REDACTED_VALUE;
    } else {
      out[key] = redactValue(value, options, depth + 1, seen, childPath);
    }
  }
  return out;
}

export function redactAuditPayload(
  input: unknown,
  rawOptions: AuditRedactionOptions = {},
): unknown {
  const merged = { ...DEFAULT_OPTIONS, ...rawOptions };
  const options: ResolvedRedactionOptions = {
    maxDepth: merged.maxDepth,
    maxObjectKeys: merged.maxObjectKeys,
    maxArrayItems: merged.maxArrayItems,
    maxStringLength: merged.maxStringLength,
    preservedPathSet: buildPreservedPathSet(merged.preservePaths),
  };
  return redactValue(input, options, 0, new WeakSet<object>(), "");
}
