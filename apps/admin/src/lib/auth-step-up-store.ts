/**
 * Shared store for admin step-up state.
 *
 * Step-up confirmation grace windows and bad-attempt counters used to live
 * in process-local Maps. That works for a single instance, but the admin
 * panel runs on horizontally-scaled infrastructure: a successful step-up
 * on instance A wouldn't satisfy a follow-up call landing on instance B,
 * and bad-attempt counters wouldn't aggregate across replicas — making the
 * lockout trivially defeatable by hammering a load-balanced endpoint.
 *
 * This module fronts an Upstash Redis HTTP backend when
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are configured (the
 * same env wiring rate-limit.ts already uses), and falls back to an
 * in-memory store for local dev and tests so nothing else has to change.
 *
 * Degradation contract (SEC-RL; mirrors apps/web/src/lib/cron-guard.ts):
 *   - Redis NOT configured  -> in-memory store + loud warn. Failing closed
 *     here would block every sensitive admin action on deployments that
 *     simply have no Redis (documented availability fallback).
 *   - Redis configured but ERRORING -> the LIMITER reads/writes FAIL CLOSED:
 *     `getFailureLockout`/`registerFailure` report a temporary lockout
 *     (`unavailable: true`, short retry) and `hasRecentConfirm` denies the
 *     grace window. Falling back to per-instance Maps would let an attacker
 *     who can induce (or wait for) Redis errors dodge the distributed
 *     bad-attempt counters.
 *
 * The interface is intentionally tiny:
 *   - rememberConfirm(key, ttlSec)
 *   - hasRecentConfirm(key, maxAgeMs)
 *   - registerFailure(key, windowSec, maxFailures, lockoutSec)
 *   - getFailureLockout(key)
 *   - clearFailures(key)
 *
 * The store never logs or returns the keys themselves so a leaked log
 * cannot reveal the (admin, session, operation) tuple.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HAS_REDIS = Boolean(
  REDIS_URL &&
    REDIS_TOKEN &&
    !REDIS_URL.includes("REPLACE") &&
    !REDIS_TOKEN.includes("REPLACE"),
);

const APP_ENV = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  APP_ENV === "production" ||
  APP_ENV === "staging" ||
  Boolean(process.env.DIGITALOCEAN_APP_ID);

const KEY_PREFIX = "admin-stepup:";
const FAILURE_PREFIX = "admin-stepup-fail:";
const LOCK_PREFIX = "admin-stepup-lock:";

// Retry hint surfaced when Redis is configured but erroring and the limiter
// fails closed. Short on purpose: a transient Redis blip should not lock
// operators out for the full lockout window.
const DEGRADED_RETRY_AFTER_SEC = 60;

// Local fallback. Used when Redis is not configured (dev/test) or as a
// short-window fallback when Redis is briefly unavailable. We never relax
// the security model — we just degrade to per-instance state with a clear
// log line so operators know production is misconfigured.
const memConfirms = new Map<string, number>();
const memFailures = new Map<string, { count: number; resetAt: number }>();
const memLocks = new Map<string, number>();

let warnedNoRedis = false;
let warnedRedisFailing = false;

function warnNoRedisOnce() {
  if (warnedNoRedis) return;
  warnedNoRedis = true;
  if (IS_PRODUCTION) {
    console.error(
      "[ADMIN-STEP-UP] UPSTASH_REDIS_REST_URL/_TOKEN are not configured — falling back to in-memory state. Multi-instance step-up will not be coherent.",
    );
  } else {
    console.warn(
      "[ADMIN-STEP-UP] Redis not configured — using in-memory state (dev mode).",
    );
  }
}

function warnRedisOnce(err: unknown) {
  if (warnedRedisFailing) return;
  warnedRedisFailing = true;
  console.error(
    "[ADMIN-STEP-UP] Redis call failed, falling back to in-memory state:",
    err instanceof Error ? err.message : String(err),
  );
}

async function redisCall(...args: Array<string | number>): Promise<unknown> {
  if (!HAS_REDIS) throw new Error("REDIS_NOT_CONFIGURED");
  const path = args.map((a) => encodeURIComponent(String(a))).join("/");
  const res = await fetch(`${REDIS_URL!.replace(/\/+$/, "")}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN!}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Redis HTTP ${res.status}`);
  }
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(`Redis error: ${json.error}`);
  return json.result;
}

function memCleanup() {
  const now = Date.now();
  for (const [k, ts] of memConfirms) {
    // Generous cleanup: any entry older than 1h is stale enough to drop.
    if (now - ts > 60 * 60 * 1000) memConfirms.delete(k);
  }
  for (const [k, v] of memFailures) {
    if (v.resetAt < now) memFailures.delete(k);
  }
  for (const [k, until] of memLocks) {
    if (until < now) memLocks.delete(k);
  }
}

if (typeof setInterval === "function") {
  setInterval(memCleanup, 5 * 60 * 1000).unref?.();
}

/**
 * Mark `key` as having passed step-up at "now". TTL is in seconds.
 */
export async function rememberConfirm(key: string, ttlSec: number): Promise<void> {
  const now = Date.now();
  if (HAS_REDIS) {
    try {
      await redisCall("SET", `${KEY_PREFIX}${key}`, String(now), "EX", ttlSec);
      return;
    } catch (err) {
      warnRedisOnce(err);
    }
  } else {
    warnNoRedisOnce();
  }
  memConfirms.set(key, now);
}

/**
 * Returns true when the key was confirmed within `maxAgeMs`.
 *
 * Fail-closed: when Redis is configured but erroring we deny the grace
 * window instead of consulting the per-instance memory map — the caller
 * then demands a fresh confirmation (which the failed-closed limiter gates).
 */
export async function hasRecentConfirm(key: string, maxAgeMs: number): Promise<boolean> {
  if (HAS_REDIS) {
    try {
      const value = (await redisCall("GET", `${KEY_PREFIX}${key}`)) as string | null;
      if (value === null || value === undefined) return false;
      const ts = Number(value);
      if (!Number.isFinite(ts)) return false;
      return Date.now() - ts < maxAgeMs;
    } catch (err) {
      warnRedisOnce(err);
      return false;
    }
  }
  const ts = memConfirms.get(key);
  if (!ts) return false;
  return Date.now() - ts < maxAgeMs;
}

/**
 * Increment the failure counter and update the lockout if `maxFailures` is
 * reached. Returns the resulting lock state. The window resets on the
 * first non-locked failure when the previous window expired.
 */
export async function registerFailure(input: {
  key: string;
  windowSec: number;
  maxFailures: number;
  lockoutSec: number;
}): Promise<{ locked: boolean; retryAfterSec: number; unavailable?: boolean }> {
  const failureKey = `${FAILURE_PREFIX}${input.key}`;
  const lockKey = `${LOCK_PREFIX}${input.key}`;

  if (HAS_REDIS) {
    try {
      const count = (await redisCall("INCR", failureKey)) as number | null;
      if (count === 1) {
        await redisCall("EXPIRE", failureKey, input.windowSec);
      }
      if (typeof count === "number" && count >= input.maxFailures) {
        await redisCall("SET", lockKey, String(Date.now() + input.lockoutSec * 1000), "EX", input.lockoutSec);
        await redisCall("DEL", failureKey);
        return { locked: true, retryAfterSec: input.lockoutSec };
      }
      return { locked: false, retryAfterSec: 0 };
    } catch (err) {
      // Fail closed: don't fall back to per-instance counters while the
      // configured distributed store is erroring (see module doc).
      warnRedisOnce(err);
      return { locked: true, retryAfterSec: DEGRADED_RETRY_AFTER_SEC, unavailable: true };
    }
  }

  const now = Date.now();
  const existing = memFailures.get(input.key);
  if (!existing || existing.resetAt < now) {
    memFailures.set(input.key, { count: 1, resetAt: now + input.windowSec * 1000 });
    return { locked: false, retryAfterSec: 0 };
  }
  existing.count += 1;
  if (existing.count >= input.maxFailures) {
    memLocks.set(input.key, now + input.lockoutSec * 1000);
    memFailures.delete(input.key);
    return { locked: true, retryAfterSec: input.lockoutSec };
  }
  return { locked: false, retryAfterSec: 0 };
}

/**
 * Returns retryAfterSec > 0 if the key is currently locked out.
 *
 * Fail-closed: when Redis is configured but erroring this reports a
 * temporary lockout (`unavailable: true`) instead of consulting the
 * per-instance memory map, so a Redis outage can't be used to bypass
 * distributed bad-attempt counters.
 */
export async function getFailureLockout(key: string): Promise<{ locked: boolean; retryAfterSec: number; unavailable?: boolean }> {
  const lockKey = `${LOCK_PREFIX}${key}`;
  if (HAS_REDIS) {
    try {
      const value = (await redisCall("GET", lockKey)) as string | null;
      if (value === null || value === undefined) return { locked: false, retryAfterSec: 0 };
      const until = Number(value);
      if (!Number.isFinite(until)) return { locked: false, retryAfterSec: 0 };
      const remaining = until - Date.now();
      if (remaining <= 0) return { locked: false, retryAfterSec: 0 };
      return { locked: true, retryAfterSec: Math.ceil(remaining / 1000) };
    } catch (err) {
      warnRedisOnce(err);
      return { locked: true, retryAfterSec: DEGRADED_RETRY_AFTER_SEC, unavailable: true };
    }
  }
  const until = memLocks.get(key);
  if (!until) return { locked: false, retryAfterSec: 0 };
  const remaining = until - Date.now();
  if (remaining <= 0) {
    memLocks.delete(key);
    return { locked: false, retryAfterSec: 0 };
  }
  return { locked: true, retryAfterSec: Math.ceil(remaining / 1000) };
}

/**
 * Clear failure counter and lockout — call after a successful confirm so
 * the next bad attempt starts a fresh window.
 */
export async function clearFailures(key: string): Promise<void> {
  if (HAS_REDIS) {
    try {
      await redisCall("DEL", `${FAILURE_PREFIX}${key}`);
      await redisCall("DEL", `${LOCK_PREFIX}${key}`);
      return;
    } catch (err) {
      warnRedisOnce(err);
    }
  }
  memFailures.delete(key);
  memLocks.delete(key);
}

/**
 * Test helper. Clears the in-memory side. Redis state is left alone — tests
 * that care about Redis should use the failure/clear helpers directly.
 */
export function clearStepUpStateForTests(): void {
  memConfirms.clear();
  memFailures.clear();
  memLocks.clear();
  warnedNoRedis = false;
  warnedRedisFailing = false;
}

/** True iff Redis env is wired (best-effort). Used for telemetry only. */
export function isStepUpStoreDistributed(): boolean {
  return HAS_REDIS;
}
