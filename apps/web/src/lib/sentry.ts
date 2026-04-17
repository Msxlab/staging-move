/**
 * Sentry Error Tracking Scaffold
 *
 * Setup steps:
 * 1. pnpm add @sentry/nextjs
 * 2. Set NEXT_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN in .env
 * 3. Run: npx @sentry/wizard@latest -i nextjs
 *
 * This file provides a lightweight wrapper so the rest of the app
 * can call captureException / captureMessage without a hard dependency.
 */

let sentryInitialized = false;

export function initSentry(): void {
  if (sentryInitialized) return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.warn("Sentry DSN not configured — error tracking disabled");
    return;
  }

  try {
    // Dynamic import so the app works without @sentry/nextjs installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      debug: process.env.NODE_ENV === "development",
    });
    sentryInitialized = true;
  } catch {
    console.warn("@sentry/nextjs not installed — error tracking disabled");
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try {
    const Sentry = require("@sentry/nextjs");
    Sentry.captureException(error, { extra: context });
  } catch {
    // Sentry not available — fall back to console
    console.error("[Error]", error, context);
  }
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  try {
    const Sentry = require("@sentry/nextjs");
    Sentry.captureMessage(message, level);
  } catch {
    console.log(`[${level.toUpperCase()}]`, message);
  }
}
