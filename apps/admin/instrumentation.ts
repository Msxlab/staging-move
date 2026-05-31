import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation hook. Loads the server/edge Sentry config at startup
 * (each guards on NEXT_PUBLIC_SENTRY_DSN, so it's inert without a DSN) and wires
 * App Router request-error capture via onRequestError. Without this, route
 * handler + RSC errors are never reported to Sentry — they only console.error.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
