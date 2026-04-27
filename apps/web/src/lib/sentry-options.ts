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

import { scrubObject } from "@locateflow/shared";

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
      return event;
    },
    // Edge runtime has a tighter API surface; skip integrations it can't run.
    ...(runtime === "edge"
      ? { integrations: [] as unknown as undefined }
      : {}),
  };
}
