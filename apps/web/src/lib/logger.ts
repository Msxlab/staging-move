/**
 * Structured logging utility.
 * Outputs JSON-formatted log entries with consistent fields for
 * observability and log aggregation (e.g. Datadog, CloudWatch, Sentry).
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  duration?: number;
  [key: string]: unknown;
}

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_RE =
  /(authorization|cookie|token|session|password|passwd|pwd|secret|mfa|backupCode|reset|verification|providerId|pushToken|privateKey|apiKey|accessKey)/i;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const COOKIE_SECRET_RE =
  /\b(user_session|admin_session|oauth_state_[a-z]+|oauth_pkce_[a-z]+|oauth_redirect)=([^;\s]+)/gi;

export function redactLogValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[MaxDepth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value
      .replace(BEARER_RE, "Bearer [REDACTED]")
      .replace(COOKIE_SECRET_RE, "$1=[REDACTED]");
  }
  if (typeof value !== "object") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactLogValue(value.message, depth + 1),
      stack: redactLogValue(value.stack, depth + 1),
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY_RE.test(key)
      ? REDACTED
      : redactLogValue(nested, depth + 1);
  }
  return out;
}

function formatLog(level: LogLevel, message: string, context?: LogContext) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(redactLogValue(context) as LogContext | undefined),
  });
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(formatLog("info", message, context));
  },

  warn(message: string, context?: LogContext) {
    console.warn(formatLog("warn", message, context));
  },

  error(message: string, context?: LogContext) {
    console.error(formatLog("error", message, context));
  },

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === "development") {
      console.debug(formatLog("debug", message, context));
    }
  },
};
