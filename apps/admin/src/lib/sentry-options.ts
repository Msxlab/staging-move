/**
 * Shared Sentry initialization options for the admin app.
 *
 * Scrubbing strategy mirrors the web app: strip request bodies/cookies and
 * redact known sensitive fields in extras/tags while keeping event shape.
 */

type Runtime = "client" | "server" | "edge";

const PII_FIELD_RE =
  /(email|phone|password|hash|token|authorization|cookie|ssn|session|secret|mfa|backupCode|reset|verification|providerId|pushToken|privateKey|apiKey|accessKey|backup|archive|storageKey|objectKey|filePath|downloadUrl)/i;

function scrubObject(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(scrubObject);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_FIELD_RE.test(k)) {
      out[k] = "[Filtered]";
      continue;
    }
    out[k] = typeof v === "object" ? scrubObject(v) : v;
  }
  return out;
}

/** Value-level scrubber for free-text strings (exception/breadcrumb messages)
 *  that scrubObject's key-based pass can't reach — emails, Bearer tokens, long
 *  token-like runs. Mirrors packages/shared scrubText. */
function scrubText(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[token]");
}

export function buildSentryOptions(runtime: Runtime) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend(event: any) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.Authorization;
          delete event.request.headers.cookie;
        }
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      if (event.extra) event.extra = scrubObject(event.extra) as any;
      if (event.tags) event.tags = scrubObject(event.tags) as any;
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex && typeof ex.value === "string") ex.value = scrubText(ex.value);
        }
      }
      const crumbs = Array.isArray(event.breadcrumbs)
        ? event.breadcrumbs
        : event.breadcrumbs?.values;
      if (Array.isArray(crumbs)) {
        for (const b of crumbs) {
          if (b && typeof b.message === "string") b.message = scrubText(b.message);
          if (b?.data) b.data = scrubObject(b.data);
        }
      }
      return event;
    },
    ...(runtime === "edge"
      ? { integrations: [] as unknown as undefined }
      : {}),
  };
}
