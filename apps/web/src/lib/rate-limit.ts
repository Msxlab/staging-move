/**
 * Rate limiter with Upstash Redis support.
 * Falls back to in-memory when UPSTASH_REDIS_REST_URL is not configured.
 */

import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { resolveClientIpFromHeaders } from "@/lib/client-ip";

// ── Redis-backed rate limiters (production) ──────────────────

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = Boolean(
  redisUrl &&
    redisToken &&
    !redisUrl.includes("REPLACE") &&
    !redisToken.includes("REPLACE"),
);
const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
const isProduction =
  process.env.NODE_ENV === "production" ||
  appEnv === "production" ||
  appEnv === "staging" ||
  Boolean(process.env.DIGITALOCEAN_APP_ID);
const REDIS_DEGRADE_WINDOW_MS = 60 * 1000;
const REDIS_REWARN_WINDOW_MS = 5 * 60 * 1000;

let redis: Redis | null = null;
const redisLimiters = new Map<string, Ratelimit>();
let redisDegradedUntil = 0;
let missingRedisWarned = false;
let redisFailureWarned = false;
let lastRedisFailureWarningAt = 0;
// Health diagnostics — see `getLimiterHealth()`. Keep timestamps as numbers
// internally and serialise to ISO at the read boundary; reason codes are
// scrubbed of URLs/tokens before we ever store them.
let lastDegradedAtMs: number | null = null;
let lastDegradedReason: string | null = null;
let lastRecoveredAtMs: number | null = null;

if (hasRedis) {
  redis = new Redis({
    url: redisUrl!,
    token: redisToken!,
  });
}

// ── In-memory fallback (development) ─────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (entry.resetAt < now) memStore.delete(key);
  }
}, 5 * 60 * 1000);

function memoryRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowSeconds * 1000;
    memStore.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  entry.count++;
  if (entry.count > limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ── Public API ───────────────────────────────────────────────

/**
 * Fail-mode when the distributed limiter can't answer:
 *   - `true`  — fail CLOSED: deny (429) whenever Redis is unavailable
 *               (unconfigured OR erroring). Strictest; use for auth/abuse.
 *   - `false` — fail OPEN: silently fall back to the in-memory limiter.
 *   - `"if-redis-configured"` — fail closed ONLY when Redis is configured
 *               but erroring/degraded; fail OPEN (in-memory) when Redis is
 *               not configured at all. Mirrors the cron-guard contract: a
 *               *missing* limiter must not permanently 429 a whole tier
 *               (e.g. all billing endpoints), while a transient outage of a
 *               *configured* limiter still fails closed for the short window.
 */
type RateLimitFailMode = boolean | "if-redis-configured";

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  failClosed?: RateLimitFailMode;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

function safeReason(input: string, err?: unknown): string {
  // Scrub URLs and bearer tokens before they reach logs / events / the
  // health endpoint. Upstash error messages don't normally carry the URL,
  // but defence-in-depth: never trust an upstream error message.
  const raw = input || (err as Error)?.message || "Unknown limiter error";
  return String(raw)
    .replace(/https?:\/\/\S+/gi, "[URL_REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_\-]{32,}/g, "[TOKEN_REDACTED]")
    .slice(0, 160);
}

function enterRedisDegradedMode(reason: string, err?: unknown) {
  const wasInDegradedMode = Date.now() < redisDegradedUntil;
  redisDegradedUntil = Date.now() + REDIS_DEGRADE_WINDOW_MS;
  lastDegradedAtMs = Date.now();
  lastDegradedReason = safeReason(reason, err);
  const shouldWarnAgain =
    Date.now() - lastRedisFailureWarningAt >= REDIS_REWARN_WINDOW_MS;
  if (isProduction && (!redisFailureWarned || shouldWarnAgain)) {
    redisFailureWarned = true;
    lastRedisFailureWarningAt = Date.now();
    console.error("[RATE-LIMIT] Redis unavailable, switching to in-memory degraded mode:", lastDegradedReason);
  } else if (!isProduction) {
    console.warn("[RATE-LIMIT] Redis unavailable, switching to in-memory degraded mode:", lastDegradedReason);
  }
  // Emit LIMITER_DEGRADED only on transition into degraded mode or at
  // the rewarn cadence; avoids flooding the security-event pipeline
  // when every request inside the window observes the same failure.
  // Imported lazily to avoid a circular dependency with security-events,
  // rate-limit-policy, and rate-limit.
  if (!wasInDegradedMode || shouldWarnAgain) {
    emitLimiterDegradedEvent(lastDegradedReason);
  }
}

function noteRedisRecovery() {
  if (Date.now() < redisDegradedUntil || lastDegradedAtMs !== null) {
    redisDegradedUntil = 0;
    redisFailureWarned = false;
    lastRecoveredAtMs = Date.now();
  }
}

function emitLimiterDegradedEvent(reason: string) {
  // Lazy import to keep this module decoupled from security-events when
  // the limiter is used from edge runtimes that don't pull the events
  // module. The catch-all swallows any tree-shaking edge case.
  const env =
    (process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "development").toLowerCase();
  Promise.resolve()
    .then(() => import("./security-events"))
    .then(({ emitSecurityEvent }) => {
      emitSecurityEvent({
        type: "LIMITER_DEGRADED",
        severity: "warn",
        context: {
          reason,
          provider: "upstash-redis",
          environment: env,
          fallback: "memory",
          windowMs: REDIS_DEGRADE_WINDOW_MS,
        },
      });
    })
    .catch(() => {
      /* never throw from the limiter */
    });
}

function shouldUseRedis() {
  return hasRedis && Date.now() >= redisDegradedUntil;
}

function normalizeLimitConfig(config: RateLimitConfig): Required<Pick<RateLimitConfig, "limit" | "windowSeconds">> & Pick<RateLimitConfig, "failClosed"> {
  return {
    ...config,
    limit: Math.max(1, Math.floor(config.limit)),
    windowSeconds: Math.max(1, Math.floor(config.windowSeconds)),
  };
}

// Fail closed when Redis is entirely UNCONFIGURED? Only for the strict
// `failClosed: true` mode. `"if-redis-configured"` deliberately fails OPEN
// here so a never-configured limiter can't permanently 429 a whole tier.
function failClosedWhenUnconfigured(mode: RateLimitFailMode | undefined): boolean {
  return mode === true;
}

// Fail closed when Redis IS configured but erroring / in its degraded window?
// Both `true` and `"if-redis-configured"` fail closed here — a configured
// limiter that's mid-outage still denies for the short degrade window.
function failClosedWhenConfiguredErroring(mode: RateLimitFailMode | undefined): boolean {
  return mode === true || mode === "if-redis-configured";
}

function redisDuration(windowSeconds: number): Duration {
  return `${windowSeconds} s` as Duration;
}

function getRedisLimiter(config: Required<Pick<RateLimitConfig, "limit" | "windowSeconds">>) {
  if (!redis) {
    throw new Error("Redis client is not configured");
  }

  const limiterKey = `${config.limit}:${config.windowSeconds}`;
  const cached = redisLimiters.get(limiterKey);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, redisDuration(config.windowSeconds)),
    analytics: true,
    prefix: `rl:${config.limit}:${config.windowSeconds}`,
  });
  redisLimiters.set(limiterKey, limiter);
  return limiter;
}

export async function rateLimit(
  key: string,
  config: RateLimitConfig = { limit: 60, windowSeconds: 60 }
): Promise<RateLimitResult> {
  const normalizedConfig = normalizeLimitConfig(config);

  if (!hasRedis && isProduction && !missingRedisWarned) {
    missingRedisWarned = true;
    console.error("[RATE-LIMIT] Redis is not configured in production, using in-memory degraded mode");
  }

  if (!hasRedis && isProduction && failClosedWhenUnconfigured(normalizedConfig.failClosed)) {
    return {
      success: false,
      remaining: 0,
      resetAt: Date.now() + Math.max(normalizedConfig.windowSeconds, 60) * 1000,
    };
  }

  // Use Redis if available and not in degraded mode
  if (shouldUseRedis()) {
    try {
      const limiter = getRedisLimiter(normalizedConfig);
      const result = await limiter.limit(key);
      noteRedisRecovery();
      return {
        success: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
      };
    } catch (err) {
      enterRedisDegradedMode((err as Error)?.message || "Unknown Redis error", err);
      if (isProduction && failClosedWhenConfiguredErroring(normalizedConfig.failClosed)) {
        return {
          success: false,
          remaining: 0,
          resetAt: Date.now() + REDIS_DEGRADE_WINDOW_MS,
        };
      }
    }
  }

  if (
    hasRedis &&
    isProduction &&
    failClosedWhenConfiguredErroring(normalizedConfig.failClosed) &&
    Date.now() < redisDegradedUntil
  ) {
    return {
      success: false,
      remaining: 0,
      resetAt: redisDegradedUntil,
    };
  }

  // Controlled degrade fallback to in-memory
  return memoryRateLimit(key, normalizedConfig.limit, normalizedConfig.windowSeconds);
}

/**
 * Extracts the most reliable client IP from the request.
 * TRUSTED_PROXY_HEADERS selects which proxy header family is trusted.
 */
export function resolveClientIP(request: Request): string {
  // Delegates to the shared resolver so the rate-limit key and the session
  // fingerprint agree on the client IP (see lib/client-ip.ts).
  return resolveClientIpFromHeaders(request.headers);
}

/**
 * Identity hints for `getRateLimitKey`. When `userId` is present the key is
 * scoped to the user instead of the IP, so an authenticated caller cannot
 * reset a per-user write limit by rotating their source IP.
 */
export interface RateLimitKeyIdentity {
  userId?: string | null;
}

/**
 * Extracts a rate-limit key from the request.
 *
 * Key derivation:
 *   - Authenticated callers (a non-empty `identity.userId` is supplied) are
 *     keyed on `${prefix}:user:${userId}`. This is the fix for the IP-only
 *     evasion: because the counter is bound to the user, rotating IPs (or
 *     spoofing forwarded-for headers) no longer resets a per-user write limit.
 *   - Anonymous callers (no userId) fall back to the IP-keyed
 *     `${prefix}:${ip}` form, preserving anonymous-endpoint protection.
 *
 * The `identity` argument is optional and defaults to anonymous, so existing
 * IP-only call sites and the limiter API remain unchanged.
 *
 * NOTE: This helper backs the *legacy* limiter used by per-user write routes.
 * Auth / login-lockout limits live in `rate-limit-policy.ts` and are keyed by
 * `email_ip` / IP deliberately — do NOT route those through here.
 */
export function getRateLimitKey(
  request: Request,
  prefix: string = "api",
  identity: RateLimitKeyIdentity = {},
): string {
  const userId = identity.userId?.trim();
  if (userId) {
    return `${prefix}:user:${userId}`;
  }
  const ip = resolveClientIP(request);
  return `${prefix}:${ip}`;
}

// ── Health diagnostics (safe to surface in /api/health) ───────

export type LimiterMode = "distributed" | "memory" | "degraded";
export type LimiterProvider = "upstash-redis" | "memory";
export type LimiterEnvironment = "production" | "staging" | "preview" | "development";

export interface LimiterHealth {
  /** True iff both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are
   *  set to non-placeholder values at process boot. Never includes the
   *  values themselves. */
  distributedLimiterConfigured: boolean;
  /** Effective mode the next request would observe right now:
   *   - `distributed` — env wired, no recent failure
   *   - `memory`      — env not wired (in-memory fallback intentional)
   *   - `degraded`    — env wired, but recent Redis failure pushed us
   *                     onto the in-memory fallback for a short window */
  limiterMode: LimiterMode;
  provider: LimiterProvider;
  environment: LimiterEnvironment;
  /** Production-like environments require the distributed limiter. False
   *  here is the signal the deploy is misconfigured. Dev/test/preview
   *  may stay on memory without flagging. */
  productionEnvOk: boolean;
  /** ISO-8601 timestamp of the most recent transition into degraded mode,
   *  or null if there hasn't been one in this process. */
  lastDegradedAt: string | null;
  /** ISO-8601 timestamp of the most recent successful Redis call after a
   *  degradation in this process, or null if we never recovered (or never
   *  degraded). */
  lastRecoveredAt: string | null;
  /** Most recent degradation reason after URL/token/long-id scrubbing.
   *  Capped at 160 chars. Safe to log and surface in admin health. */
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

/**
 * Read the limiter's current health for surfacing in health endpoints.
 * Never returns URLs, tokens, or any raw env value. Safe to call from
 * public health endpoints — though detailed fields (last reason,
 * timestamps) are best gated behind admin auth so they don't aid
 * targeted attacks.
 */
export function getLimiterHealth(): LimiterHealth {
  const now = Date.now();
  let mode: LimiterMode;
  let provider: LimiterProvider;
  if (!hasRedis) {
    mode = "memory";
    provider = "memory";
  } else if (now < redisDegradedUntil) {
    mode = "degraded";
    provider = "upstash-redis";
  } else {
    mode = "distributed";
    provider = "upstash-redis";
  }

  const environment = detectEnvironment();
  const productionEnvOk =
    environment === "development" || hasRedis;

  return {
    distributedLimiterConfigured: hasRedis,
    limiterMode: mode,
    provider,
    environment,
    productionEnvOk,
    lastDegradedAt:
      lastDegradedAtMs !== null ? new Date(lastDegradedAtMs).toISOString() : null,
    lastRecoveredAt:
      lastRecoveredAtMs !== null ? new Date(lastRecoveredAtMs).toISOString() : null,
    lastErrorReasonCode: lastDegradedReason,
  };
}

/**
 * Test-only: reset the in-process degradation state so tests can simulate
 * a fresh boot. Not exposed via barrel exports.
 */
export function __resetLimiterHealthForTests(): void {
  redisDegradedUntil = 0;
  redisFailureWarned = false;
  lastRedisFailureWarningAt = 0;
  lastDegradedAtMs = null;
  lastDegradedReason = null;
  lastRecoveredAtMs = null;
}
