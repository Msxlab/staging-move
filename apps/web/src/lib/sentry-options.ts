/**
 * Shared Sentry initialization options. Used by each runtime's config file
 * (client, server, edge) so the PII scrubber stays in one place.
 *
 * Scrubbing strategy: we strip the entire request body and cookies - the
 * error itself is what matters, not the user-submitted payload. For known
 * PII fields on event extras/tags (email, phone, token, password), we
 * redact the value but keep the key so the shape of the event is still
 * useful during triage.
 */

import { scrubObject, scrubText } from "@locateflow/shared";

type Runtime = "client" | "server" | "edge";

export function buildSentryOptions(runtime: Runtime) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    // Capture breadcrumbs but never user PII in them.
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
      // The exception message/type and breadcrumb messages are free text that
      // can carry interpolated PII (Prisma errors echo field values, etc.) —
      // scrubObject is key-based and never reaches them.
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
    // Edge runtime has a tighter API surface; skip integrations it can't run.
    ...(runtime === "edge"
      ? { integrations: [] as unknown as undefined }
      : {}),
  };
}
