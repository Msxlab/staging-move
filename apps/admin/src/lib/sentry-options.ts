/**
 * Shared Sentry initialization options for the admin app. Mirrors
 * apps/web/src/lib/sentry-options.ts so both apps scrub PII identically.
 */

type Runtime = "client" | "server" | "edge";

const PII_FIELD_RE = /^(email|phone|password|token|authorization|cookie|ssn|session)$/i;

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
      return event;
    },
    ...(runtime === "edge"
      ? { integrations: [] as unknown as undefined }
      : {}),
  };
}
