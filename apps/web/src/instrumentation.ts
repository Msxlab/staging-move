/**
 * Next.js instrumentation hook — runs once at server startup.
 *
 * Installs the security-event alert sink (rec B-1) when SECURITY_ALERTS_ENABLED
 * is on. Guarded to the Node runtime (the sink uses fetch/Sentry, not Edge) and
 * wrapped so a sink-install failure can NEVER block the server from booting.
 * Fully inert when the flag is off — the default.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { installSecurityAlertSink } = await import("@/lib/security-alert-sink");
    installSecurityAlertSink();
  } catch {
    // Startup must not fail on observability wiring.
  }
}
