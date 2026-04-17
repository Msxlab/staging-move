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

function formatLog(level: LogLevel, message: string, context?: LogContext) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
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
