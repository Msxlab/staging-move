/**
 * Single-writer distributed lock for long-running admin operations
 * (key rotation, future bulk migrations, etc.).
 *
 * Backed by Upstash Redis when configured, with an in-process Map
 * fallback so dev / test / single-instance deploys still get
 * mutual exclusion. The fallback is NOT safe across processes — when
 * Redis isn't wired the module logs once at production-grade volume so
 * the gap is visible in error reporting.
 *
 * Usage:
 *   const lock = await acquireLock("key-rotation", { ttlSec: 600 });
 *   if (!lock.acquired) return 409;
 *   try { ...long work... } finally { await lock.release(); }
 *
 * The `ttlSec` is a safety net — if the holder crashes without
 * releasing, the lock auto-expires after that window so the system
 * isn't permanently wedged. Pick a TTL longer than the expected
 * worst-case completion time of the protected operation.
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

const KEY_PREFIX = "admin-lock:";

interface MemLock {
  token: string;
  expiresAt: number;
}

const memLocks = new Map<string, MemLock>();
let warnedNoRedis = false;
let warnedRedisFailing = false;

function warnNoRedisOnce() {
  if (warnedNoRedis) return;
  warnedNoRedis = true;
  if (IS_PRODUCTION) {
    console.error(
      "[ADMIN-LOCK] UPSTASH_REDIS_REST_URL/_TOKEN are not configured — falling back to in-memory locks. Multi-instance mutual exclusion will not hold.",
    );
  } else {
    console.warn(
      "[ADMIN-LOCK] Redis not configured — using in-memory lock store (dev mode).",
    );
  }
}

function warnRedisOnce(err: unknown) {
  if (warnedRedisFailing) return;
  warnedRedisFailing = true;
  console.error(
    "[ADMIN-LOCK] Redis call failed, falling back to in-memory lock store:",
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
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(`Redis error: ${json.error}`);
  return json.result;
}

function generateLockToken(): string {
  // 16 random bytes encoded as hex — collision-resistant enough that
  // we never confuse one holder's release with another's lease.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export interface AcquiredLock {
  acquired: true;
  token: string;
  release: () => Promise<void>;
}

export interface DeniedLock {
  acquired: false;
  retryAfterSec: number;
  release: () => Promise<void>; // no-op, kept so callers don't need to special-case
}

export type LockResult = AcquiredLock | DeniedLock;

/**
 * Try to acquire a single-writer lock named `name` for `ttlSec` seconds.
 * Returns `{ acquired: true, release }` on success, or
 * `{ acquired: false, retryAfterSec }` if another holder owns it.
 */
export async function acquireLock(
  name: string,
  options: { ttlSec: number },
): Promise<LockResult> {
  const ttlSec = Math.max(1, Math.floor(options.ttlSec));
  const key = `${KEY_PREFIX}${name}`;
  const token = generateLockToken();

  if (HAS_REDIS) {
    try {
      // SET key value NX EX ttl — atomic acquire with TTL.
      const result = (await redisCall("SET", key, token, "NX", "EX", ttlSec)) as
        | string
        | null;
      if (result === "OK") {
        return {
          acquired: true,
          token,
          release: () => releaseRedisLock(key, token),
        };
      }
      // Already held; ask Redis how long until it expires.
      const ttl = (await redisCall("TTL", key).catch(() => -1)) as number;
      const retryAfterSec = ttl > 0 ? ttl : ttlSec;
      return {
        acquired: false,
        retryAfterSec,
        release: async () => undefined,
      };
    } catch (err) {
      warnRedisOnce(err);
      // Fall through to memory backend.
    }
  } else {
    warnNoRedisOnce();
  }

  const now = Date.now();
  const existing = memLocks.get(key);
  if (existing && existing.expiresAt > now) {
    return {
      acquired: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
      release: async () => undefined,
    };
  }
  memLocks.set(key, { token, expiresAt: now + ttlSec * 1000 });
  return {
    acquired: true,
    token,
    release: async () => releaseMemLock(key, token),
  };
}

async function releaseRedisLock(key: string, token: string): Promise<void> {
  // Compare-and-delete via EVAL — never delete a lock we don't own.
  const lua = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
  try {
    await redisCall("EVAL", lua, 1, key, token);
  } catch (err) {
    warnRedisOnce(err);
    // Mirror to memory in case the next acquire path hits the fallback.
    releaseMemLock(key, token).catch(() => undefined);
  }
}

async function releaseMemLock(key: string, token: string): Promise<void> {
  const existing = memLocks.get(key);
  if (existing && existing.token === token) {
    memLocks.delete(key);
  }
}

/** Test helper. */
export function clearDistributedLockStateForTests(): void {
  memLocks.clear();
  warnedNoRedis = false;
  warnedRedisFailing = false;
}

/** True iff Redis env is wired (best-effort). Used for telemetry only. */
export function isLockBackendDistributed(): boolean {
  return HAS_REDIS;
}
