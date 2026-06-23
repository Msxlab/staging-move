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

import { redactLogValue } from "@/lib/logger";

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try {
    const Sentry = require("@sentry/nextjs");
    Sentry.captureException(error, { extra: context });
  } catch {
    // Sentry not available — fall back to console
    console.error("[Error]", redactLogValue(error), redactLogValue(context));
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
