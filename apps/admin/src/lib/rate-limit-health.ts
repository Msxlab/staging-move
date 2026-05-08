/**
 * Admin-side limiter health diagnostic.
 *
 * Mirrors the safe-view shape produced by the web app's `getLimiterHealth()`
 * but reads only env vars (the admin app's login route limits via the
 * Upstash REST API directly — see apps/admin/src/app/api/auth/login/route.ts
 * — and does not maintain a long-lived limiter singleton). This helper
 * reports config presence and whether a quick Upstash ping works without
 * ever returning the URL or token.
 */

export type LimiterMode = "distributed" | "memory" | "degraded";
export type LimiterEnvironment = "production" | "staging" | "preview" | "development";

export interface AdminLimiterHealth {
  distributedLimiterConfigured: boolean;
  distributedLimiterReachable: boolean | null;
  limiterMode: LimiterMode;
  environment: LimiterEnvironment;
  productionEnvOk: boolean;
  lastErrorReasonCode: string | null;
}

function detectEnvironment(): LimiterEnvironment {
  const explicit = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  if (explicit === "production") return "production";
  if (explicit === "staging") return "staging";
  if (explicit === "preview") return "preview";
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.DIGITALOCEAN_APP_ID) return "production";
  return "development";
}

function safeReason(input: unknown): string {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof Error
        ? input.message
        : "Unknown limiter error";
  return raw
    .replace(/https?:\/\/\S+/gi, "[URL_REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_\-]{32,}/g, "[TOKEN_REDACTED]")
    .slice(0, 160);
}

interface PingInput {
  url: string | null | undefined;
  token: string | null | undefined;
  timeoutMs?: number;
}

/**
 * Synchronously read the configured/mode flags.
 *
 * The reachability probe is async — call `probeLimiterReachable()` if the
 * caller is willing to spend a network round-trip. This split lets the
 * snapshot be cheap when the caller just needs the static configured flag.
 */
export function buildLimiterHealth(
  values: { url: string | null | undefined; token: string | null | undefined },
  reachable?: boolean,
  reasonCode?: string | null,
): AdminLimiterHealth {
  const url = values.url || "";
  const token = values.token || "";
  const configured = Boolean(url && token && !url.includes("REPLACE") && !token.includes("REPLACE"));
  const environment = detectEnvironment();

  let mode: LimiterMode;
  if (!configured) {
    mode = "memory";
  } else if (reachable === false) {
    mode = "degraded";
  } else {
    mode = "distributed";
  }

  return {
    distributedLimiterConfigured: configured,
    distributedLimiterReachable: typeof reachable === "boolean" ? reachable : null,
    limiterMode: mode,
    environment,
    productionEnvOk: environment === "development" || configured,
    lastErrorReasonCode: reasonCode ?? null,
  };
}

export async function probeLimiterReachable(
  input: PingInput,
): Promise<{ ok: boolean; latencyMs: number | null; reason: string | null }> {
  const url = input.url || "";
  const token = input.token || "";
  if (!url || !token || url.includes("REPLACE") || token.includes("REPLACE")) {
    return { ok: false, latencyMs: null, reason: "NOT_CONFIGURED" };
  }
  const t0 = Date.now();
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(input.timeoutMs ?? 5000),
    });
    const latency = Date.now() - t0;
    if (!res.ok) {
      return { ok: false, latencyMs: latency, reason: `HTTP_${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { result?: string };
    if (data.result !== "PONG") {
      return { ok: false, latencyMs: latency, reason: "UNEXPECTED_RESPONSE" };
    }
    return { ok: true, latencyMs: latency, reason: null };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, reason: safeReason(err) };
  }
}
