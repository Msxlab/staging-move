/**
 * Next.js instrumentation hook — runs once at server startup.
 *
 * 1. Emits a loud env-readiness warn-log (env audit F-006) when REQUIRED
 *    environment variables are missing in a production-like deploy. The owner
 *    sets all env in DigitalOcean (no local .env), so a dropped secret would
 *    otherwise run silently — this makes a misconfigured deploy visible in the
 *    DO runtime logs. It NEVER throws and NEVER prints any secret value.
 * 2. Installs the security-event alert sink (rec B-1) when SECURITY_ALERTS_ENABLED
 *    is on. Guarded to the Node runtime (the sink uses fetch/Sentry, not Edge) and
 *    wrapped so a sink-install failure can NEVER block the server from booting.
 *    Fully inert when the flag is off — the default.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { buildEnvReadinessWarnings } = await import("@/lib/env-catalog");
    for (const line of buildEnvReadinessWarnings()) {
      // console.warn ONLY — a misconfigured deploy must be loud in the logs,
      // never fatal. Crashing here would make a degraded-but-recoverable
      // process impossible to inspect.
      console.warn(line);
    }
  } catch {
    // Readiness logging must never block startup.
  }

  try {
    const { installSecurityAlertSink } = await import("@/lib/security-alert-sink");
    installSecurityAlertSink();
  } catch {
    // Startup must not fail on observability wiring.
  }
}
