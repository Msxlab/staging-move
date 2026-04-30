/**
 * Rate limiter with Upstash Redis support.
 * Falls back to in-memory when UPSTASH_REDIS_REST_URL is not configured.
 */

import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  failClosed?: boolean;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

function enterRedisDegradedMode(reason: string, err?: unknown) {
  redisDegradedUntil = Date.now() + REDIS_DEGRADE_WINDOW_MS;
  const shouldWarnAgain =
    Date.now() - lastRedisFailureWarningAt >= REDIS_REWARN_WINDOW_MS;
  if (isProduction && (!redisFailureWarned || shouldWarnAgain)) {
    redisFailureWarned = true;
    lastRedisFailureWarningAt = Date.now();
    console.error("[RATE-LIMIT] Redis unavailable, switching to in-memory degraded mode:", reason, err);
  } else if (!isProduction) {
    console.warn("[RATE-LIMIT] Redis unavailable, switching to in-memory degraded mode:", reason, err);
  }
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

  if (!hasRedis && isProduction && normalizedConfig.failClosed) {
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
      redisFailureWarned = false;
      return {
        success: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
      };
    } catch (err) {
      enterRedisDegradedMode((err as Error)?.message || "Unknown Redis error", err);
      if (isProduction && normalizedConfig.failClosed) {
        return {
          success: false,
          remaining: 0,
          resetAt: Date.now() + REDIS_DEGRADE_WINDOW_MS,
        };
      }
    }
  }

  if (hasRedis && isProduction && normalizedConfig.failClosed && Date.now() < redisDegradedUntil) {
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
 * Priority: x-vercel-forwarded-for on Vercel only > x-real-ip > x-forwarded-for > cf-connecting-ip > fallback.
 * Each platform sets its trusted header — we check the most reliable first.
 */
export function resolveClientIP(request: Request): string {
  if (process.env.VERCEL_ENV) {
    const vercelIp = request.headers.get("x-vercel-forwarded-for");
    if (vercelIp) return vercelIp.split(",")[0].trim();
  }

  // Cloudflare's trusted header
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Nginx / reverse proxy trusted header
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Standard forwarded header — take leftmost (original client)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "anonymous";
}

/**
 * Extracts a rate-limit key from the request.
 * Uses the most reliable IP source available on the platform.
 */
export function getRateLimitKey(request: Request, prefix: string = "api"): string {
  const ip = resolveClientIP(request);
  return `${prefix}:${ip}`;
}
