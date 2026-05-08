#!/usr/bin/env tsx
/**
 * Distributed-rate-limiter health check.
 *
 * Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from the
 * environment and reports a JSON summary suitable for staging and
 * production smoke checks. Never prints the URL, token, or any other
 * secret — error messages are scrubbed before they are emitted.
 *
 * Usage:
 *   pnpm rate-limit:check
 *   # or directly:
 *   pnpm exec tsx scripts/check-rate-limiter-health.ts
 *
 * Output (success):
 *   {
 *     "distributedLimiterConfigured": true,
 *     "distributedLimiterReachable": true,
 *     "limiterMode": "distributed",
 *     "provider": "upstash-redis",
 *     "environment": "staging",
 *     "latencyMs": 32,
 *     "rateLimitProbe": "ok"
 *   }
 *
 * Exit codes:
 *   0 — distributedLimiterConfigured && distributedLimiterReachable
 *   1 — env not configured
 *   2 — env configured but unreachable / probe failed
 */

interface CheckResult {
  distributedLimiterConfigured: boolean;
  distributedLimiterReachable: boolean | null;
  limiterMode: "distributed" | "memory" | "degraded";
  provider: "upstash-redis" | "memory";
  environment: string;
  latencyMs: number | null;
  rateLimitProbe: "ok" | "fail" | "skip";
  reasonCode: string | null;
}

function detectEnvironment(): string {
  const explicit = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  if (explicit) return explicit;
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
        : "Unknown error";
  return raw
    .replace(/https?:\/\/\S+/gi, "[URL_REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_\-]{32,}/g, "[TOKEN_REDACTED]")
    .slice(0, 160);
}

async function rest(url: string, token: string, path: string, timeoutMs = 5000) {
  const res = await fetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP_${res.status}`);
  }
  return (await res.json().catch(() => ({}))) as { result?: unknown };
}

async function main(): Promise<CheckResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  const environment = detectEnvironment();
  const configured = Boolean(
    url && token && !url.includes("REPLACE") && !token.includes("REPLACE"),
  );

  if (!configured) {
    return {
      distributedLimiterConfigured: false,
      distributedLimiterReachable: null,
      limiterMode: "memory",
      provider: "memory",
      environment,
      latencyMs: null,
      rateLimitProbe: "skip",
      reasonCode: "NOT_CONFIGURED",
    };
  }

  const t0 = Date.now();
  let latencyMs: number | null = null;
  try {
    const ping = await rest(url, token, "/ping");
    latencyMs = Date.now() - t0;
    if (ping.result !== "PONG") {
      return {
        distributedLimiterConfigured: true,
        distributedLimiterReachable: false,
        limiterMode: "degraded",
        provider: "upstash-redis",
        environment,
        latencyMs,
        rateLimitProbe: "fail",
        reasonCode: "UNEXPECTED_PING_RESPONSE",
      };
    }
  } catch (err) {
    return {
      distributedLimiterConfigured: true,
      distributedLimiterReachable: false,
      limiterMode: "degraded",
      provider: "upstash-redis",
      environment,
      latencyMs: latencyMs ?? Date.now() - t0,
      rateLimitProbe: "fail",
      reasonCode: safeReason(err),
    };
  }

  // Tiny rate-limit-key probe: SET with EX, GET, DEL. Cleans up after
  // itself and uses a unique key per run so concurrent checks don't
  // collide. We never log the key contents.
  const probeKey = `rl:healthcheck:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  try {
    await rest(url, token, `/set/${encodeURIComponent(probeKey)}/1/EX/30`);
    const got = await rest(url, token, `/get/${encodeURIComponent(probeKey)}`);
    if (got.result !== "1") {
      throw new Error("PROBE_VALUE_MISMATCH");
    }
  } catch (err) {
    return {
      distributedLimiterConfigured: true,
      distributedLimiterReachable: true,
      limiterMode: "degraded",
      provider: "upstash-redis",
      environment,
      latencyMs,
      rateLimitProbe: "fail",
      reasonCode: safeReason(err),
    };
  } finally {
    // Best-effort cleanup. Never throw from cleanup so the main outcome
    // is always reported. The 30s TTL above guarantees the key expires
    // even if DEL fails.
    await rest(url, token, `/del/${encodeURIComponent(probeKey)}`).catch(() => null);
  }

  return {
    distributedLimiterConfigured: true,
    distributedLimiterReachable: true,
    limiterMode: "distributed",
    provider: "upstash-redis",
    environment,
    latencyMs,
    rateLimitProbe: "ok",
    reasonCode: null,
  };
}

main()
  .then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (!result.distributedLimiterConfigured) {
      process.exit(1);
    }
    if (!result.distributedLimiterReachable || result.rateLimitProbe !== "ok") {
      process.exit(2);
    }
    process.exit(0);
  })
  .catch((err) => {
    process.stdout.write(
      JSON.stringify(
        {
          distributedLimiterConfigured: false,
          distributedLimiterReachable: null,
          limiterMode: "memory",
          provider: "memory",
          environment: detectEnvironment(),
          latencyMs: null,
          rateLimitProbe: "fail",
          reasonCode: safeReason(err),
        },
        null,
        2,
      ) + "\n",
    );
    process.exit(2);
  });
