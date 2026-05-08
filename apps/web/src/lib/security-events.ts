/**
 * Structured security-event taxonomy for the rate-limit / auth-limit layer.
 *
 * Designed to be:
 *   - non-blocking — never throws; never delays the caller's response
 *   - redacted — caller-supplied context is whitelist-filtered against a
 *     deny-list of sensitive fields before logging or persistence
 *   - cheap to call — both `console.warn` and a best-effort prisma write
 *     happen in the background; awaiting is optional but discouraged
 *
 * What we deliberately do NOT log: passwords, MFA codes, backup codes,
 * raw session tokens / JWTs, raw cron / internal secrets, full email
 * addresses (we accept normalised lowercase email only when the auth
 * surface is already enumeration-safe), DB connection strings.
 *
 * Companion docs:
 *   - docs/audits/security/rate_limit_policy_matrix.md — taxonomy + thresholds
 *   - docs/audits/security/rate_limit_auth_limit_final_report.md — what's wired
 */

import { redactAuditPayload } from "@locateflow/shared";
import type { RateLimitRouteGroup } from "./rate-limit-policy";

export type SecurityEventType =
  | "RATE_LIMIT_HIT"
  | "RATE_LIMIT_SHADOW_HIT"
  | "LOCKOUT_STARTED"
  | "MFA_FAILURE_BURST"
  | "PWRESET_ABUSE_SIGNAL"
  | "EXPORT_ATTEMPT"
  | "ACCOUNT_DELETE_ATTEMPT"
  | "ADMIN_SENSITIVE_ATTEMPT"
  | "ADMIN_LOGIN_FAILURE"
  | "WEBHOOK_SIG_FAILURE"
  | "CRON_SECRET_MISUSE"
  | "INTERNAL_SECRET_MISUSE"
  | "LIMITER_DEGRADED";

export type SecurityEventSeverity = "info" | "warn" | "error";

export interface SecurityEventInput {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  /** Route group from the policy matrix, when applicable. */
  group?: RateLimitRouteGroup | string;
  /**
   * Hashed limiter key (already produced by `stableRateLimitHash`) or a
   * compound rate-limit key — never the raw email/userId. Useful as a
   * cardinality dimension in dashboards.
   */
  key?: string | null;
  /** Seconds the caller is asked to wait — debug field, fine to log. */
  retryAfterSeconds?: number | null;
  /**
   * Additional structured context. Will be passed through `redactContext`
   * before any console / DB write. Keep this small and meaningful — this
   * is the "WHY" you're emitting the event.
   */
  context?: Record<string, unknown>;
}

const SEVERITY_TO_LEVEL: Record<SecurityEventSeverity, "log" | "warn" | "error"> = {
  info: "log",
  warn: "warn",
  error: "error",
};

/**
 * Field names that must NEVER be persisted to logs or audit tables.
 * Match is exact + case-insensitive on the key name. When a redacted
 * field is present we replace the value with the literal string
 * `"[REDACTED]"` so the existence of the field is still observable
 * (helpful for catching a buggy caller) without leaking the value.
 */
/**
 * Recursively redact a context object. Returns a new object — never
 * mutates the input. Functions, dates, and primitives pass through;
 * known-bad keys collapse to `"[REDACTED]"`; arrays and plain objects
 * are walked.
 */
export function redactContext(
  input: unknown,
  depth = 0,
): unknown {
  void depth;
  return redactAuditPayload(input);
}

/**
 * Emit a security event. Best-effort — never throws.
 *
 * The default sink is the structured console logger (`console.warn` for
 * `warn`, `console.error` for `error`, `console.log` for `info`). A
 * downstream sink (Sentry, DataDog, prisma audit table) can be installed
 * via `setSecurityEventSink`.
 */
export function emitSecurityEvent(input: SecurityEventInput): void {
  try {
    const safeContext = input.context ? redactContext(input.context) : undefined;
    const payload = {
      type: input.type,
      severity: input.severity,
      group: input.group ?? null,
      key: input.key ?? null,
      retryAfterSeconds: input.retryAfterSeconds ?? null,
      context: safeContext,
      occurredAt: new Date().toISOString(),
    };
    const level = SEVERITY_TO_LEVEL[input.severity];
    // eslint-disable-next-line no-console
    console[level]("security_event", payload);
    if (downstreamSink) {
      try {
        const result = downstreamSink(payload);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          (result as Promise<unknown>).catch((err) => {
            // eslint-disable-next-line no-console
            console.warn("security_event_sink_failed", {
              type: input.type,
              error: String(err),
            });
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("security_event_sink_failed", {
          type: input.type,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch {
    // Never throw from the event path.
  }
}

export interface SecurityEventPayload {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  group: RateLimitRouteGroup | string | null;
  key: string | null;
  retryAfterSeconds: number | null;
  context: unknown;
  occurredAt: string;
}

type SecurityEventSink = (payload: SecurityEventPayload) => void | Promise<void>;

let downstreamSink: SecurityEventSink | null = null;

/**
 * Install a downstream sink. Pass `null` to detach. The sink is invoked
 * after console logging — failures are swallowed and re-logged.
 */
export function setSecurityEventSink(sink: SecurityEventSink | null): void {
  downstreamSink = sink;
}

/** Test-only: read the currently installed sink (or null). */
export function getSecurityEventSink(): SecurityEventSink | null {
  return downstreamSink;
}
