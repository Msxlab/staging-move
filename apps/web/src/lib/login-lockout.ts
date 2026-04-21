/**
 * Per-IP login failure tracker with a hard lockout after N failures.
 *
 * The general rate limiter in `lib/rate-limit.ts` protects every API
 * endpoint uniformly, but the login endpoint needs a more aggressive
 * pattern: a small number of *failed* password attempts within a
 * rolling window triggers a long cooldown. This mirrors the admin
 * login lockout behavior (apps/admin/src/app/api/auth/login/route.ts)
 * and shares the same Upstash → in-memory fallback structure.
 *
 * Defaults: 5 failures / 15 min window, then 30 min lockout. Success
 * clears the counter so legitimate users never get locked out by a
 * noisy neighbor on the same NAT.
 */

const MAX_FAILURES = 5;
const WINDOW_SECONDS = 15 * 60;
const LOCKOUT_SECONDS = 30 * 60;

const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";

interface Attempt {
  count: number;
  resetAt: number;
  lockedUntil: number;
}

const memStore = new Map<string, Attempt>();

function hasUsableRedis(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token && !url.includes("REPLACE"));
}

async function redisCall(
  path: string,
  init?: RequestInit,
): Promise<{ result: unknown } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  try {
    const res = await fetch(`${url}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as { result: unknown };
  } catch {
    return null;
  }
}

export interface LockoutCheck {
  locked: boolean;
  retryAfterSec: number;
  unavailable?: boolean;
}

/**
 * Returns the lockout state for an IP WITHOUT consuming an attempt.
 * Call this before running the expensive bcrypt comparison.
 */
export async function isLoginLocked(ip: string): Promise<LockoutCheck> {
  if (hasUsableRedis()) {
    const lockKey = `user:login:lock:${ip}`;
    const data = await redisCall(`/get/${encodeURIComponent(lockKey)}`);
    if (data && data.result) {
      const ttl = await redisCall(`/ttl/${encodeURIComponent(lockKey)}`);
      const ttlSec =
        typeof ttl?.result === "number" && ttl.result > 0
          ? ttl.result
          : LOCKOUT_SECONDS;
      return { locked: true, retryAfterSec: Math.max(ttlSec, 1) };
    }
    if (data === null && isProduction) {
      // Redis call failed in production — fail closed briefly so an
      // outage doesn't become a brute-force window.
      return { locked: true, retryAfterSec: 60, unavailable: true };
    }
    return { locked: false, retryAfterSec: 0 };
  }

  const entry = memStore.get(ip);
  if (entry && entry.lockedUntil > Date.now()) {
    return {
      locked: true,
      retryAfterSec: Math.ceil((entry.lockedUntil - Date.now()) / 1000),
    };
  }
  return { locked: false, retryAfterSec: 0 };
}

/**
 * Record a failed login attempt. Returns the updated lockout state —
 * callers can surface `locked: true` to the client in the same response.
 */
export async function recordLoginFailure(ip: string): Promise<LockoutCheck> {
  if (hasUsableRedis()) {
    const countKey = `user:login:fail:${ip}`;
    const lockKey = `user:login:lock:${ip}`;
    const incr = await redisCall(`/incr/${encodeURIComponent(countKey)}`);
    const count =
      typeof incr?.result === "number" && incr.result > 0 ? incr.result : 1;

    if (count === 1) {
      await redisCall(
        `/expire/${encodeURIComponent(countKey)}/${WINDOW_SECONDS}`,
      );
    }

    if (count >= MAX_FAILURES) {
      await redisCall(
        `/set/${encodeURIComponent(lockKey)}/locked/EX/${LOCKOUT_SECONDS}`,
      );
      await redisCall(`/del/${encodeURIComponent(countKey)}`);
      return { locked: true, retryAfterSec: LOCKOUT_SECONDS };
    }
    return { locked: false, retryAfterSec: 0 };
  }

  const now = Date.now();
  const entry = memStore.get(ip);
  if (!entry || entry.resetAt < now) {
    memStore.set(ip, {
      count: 1,
      resetAt: now + WINDOW_SECONDS * 1000,
      lockedUntil: 0,
    });
    return { locked: false, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) {
    entry.lockedUntil = now + LOCKOUT_SECONDS * 1000;
    entry.count = 0;
    return { locked: true, retryAfterSec: LOCKOUT_SECONDS };
  }
  return { locked: false, retryAfterSec: 0 };
}

/** Called on a successful login — resets the counter so NAT neighbors aren't punished. */
export async function clearLoginFailures(ip: string): Promise<void> {
  if (hasUsableRedis()) {
    const countKey = `user:login:fail:${ip}`;
    await redisCall(`/del/${encodeURIComponent(countKey)}`);
    return;
  }
  memStore.delete(ip);
}
