import * as Sentry from "@sentry/nextjs";
import { buildSentryOptions } from "./src/lib/sentry-options";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init(buildSentryOptions("server"));
}
