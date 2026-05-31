/**
 * Cross-runtime PII redaction for Sentry/GlitchTip event payloads.
 *
 * Lives in `packages/shared` so the web Next.js runtime AND the mobile
 * React Native runtime apply the exact same scrubber. The web side wraps
 * this in `apps/web/src/lib/sentry-options.ts`; the mobile side wraps
 * this in `apps/mobile/src/lib/sentry.ts`.
 *
 * Strategy:
 *   - For known PII keys (matching PII_FIELD_RE) on event extras/tags,
 *     keep the key but replace the value with "[Filtered]" so triage
 *     keeps event shape but never sees the secret.
 *   - The runtime-specific wrapper is responsible for stripping
 *     full request bodies/cookies — those are too volatile to scrub
 *     by key alone.
 *
 * This module has no runtime dependency on `@sentry/*` packages so it
 * is safe to import from React Native, Edge runtime, Node, and the
 * Next.js client bundle alike.
 */

export const PII_FIELD_RE =
  /(email|phone|password|hash|token|authorization|cookie|ssn|session|secret|mfa|backupCode|reset|verification|providerId|pushToken|privateKey|apiKey|accessKey|backup|archive|storageKey|objectKey|filePath|downloadUrl)/i;

export function scrubObject(obj: unknown): unknown {
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

/**
 * Value-level scrubber for FREE-TEXT strings — exception messages, breadcrumb
 * messages, log lines — where a secret/PII can be interpolated into the text
 * itself (e.g. a Prisma unique-constraint error that echoes the field value, a
 * JSON parse error that echoes the payload, a URL carrying a token). scrubObject
 * is key-based and can't reach these. Redacts emails, Bearer tokens, and long
 * token-like runs. Conservative: over-redaction in an error string is harmless.
 */
export function scrubText(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[token]");
}
