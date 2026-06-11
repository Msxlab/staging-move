import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearFailures,
  clearStepUpStateForTests,
  getFailureLockout,
  hasRecentConfirm,
  registerFailure,
  rememberConfirm,
} from "./auth-step-up-store";

describe("auth-step-up-store (in-memory fallback)", () => {
  beforeEach(() => {
    clearStepUpStateForTests();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    clearStepUpStateForTests();
  });

  it("rememberConfirm + hasRecentConfirm round trips", async () => {
    await rememberConfirm("admin1:s1:op_a", 60);
    await expect(hasRecentConfirm("admin1:s1:op_a", 60_000)).resolves.toBe(true);
    await expect(hasRecentConfirm("admin1:s1:op_a", 0)).resolves.toBe(false);
  });

  it("returns false for unrelated keys", async () => {
    await rememberConfirm("admin1:s1:op_a", 60);
    await expect(hasRecentConfirm("admin1:s1:op_b", 60_000)).resolves.toBe(false);
    await expect(hasRecentConfirm("admin2:s1:op_a", 60_000)).resolves.toBe(false);
  });

  it("locks out after maxFailures", async () => {
    for (let i = 0; i < 4; i++) {
      const r = await registerFailure({
        key: "admin:fail",
        windowSec: 300,
        maxFailures: 5,
        lockoutSec: 600,
      });
      expect(r.locked).toBe(false);
    }
    const final = await registerFailure({
      key: "admin:fail",
      windowSec: 300,
      maxFailures: 5,
      lockoutSec: 600,
    });
    expect(final.locked).toBe(true);
    expect(final.retryAfterSec).toBeGreaterThan(0);

    const lock = await getFailureLockout("admin:fail");
    expect(lock.locked).toBe(true);
    expect(lock.retryAfterSec).toBeGreaterThan(0);
  });

  it("clearFailures unlocks the key", async () => {
    for (let i = 0; i < 5; i++) {
      await registerFailure({
        key: "admin:clear",
        windowSec: 300,
        maxFailures: 5,
        lockoutSec: 600,
      });
    }
    expect((await getFailureLockout("admin:clear")).locked).toBe(true);
    await clearFailures("admin:clear");
    expect((await getFailureLockout("admin:clear")).locked).toBe(false);
  });
});

describe("auth-step-up-store (Redis configured)", () => {
  type Store = typeof import("./auth-step-up-store");

  async function loadStoreWithFetch(fetchImpl: typeof fetch): Promise<Store> {
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t".repeat(32));
    vi.stubGlobal("fetch", fetchImpl);
    return import("./auth-step-up-store");
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("round-trips confirms and failures through Redis when healthy", async () => {
    const kv = new Map<string, string>();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const [command, ...args] = segments;
      let result: unknown = "OK";
      if (command === "SET") kv.set(args[0], args[1]);
      else if (command === "GET") result = kv.get(args[0]) ?? null;
      else if (command === "INCR") {
        const next = Number(kv.get(args[0]) || "0") + 1;
        kv.set(args[0], String(next));
        result = next;
      } else if (command === "DEL") kv.delete(args[0]);
      else if (command === "EXPIRE") result = 1;
      return { ok: true, json: async () => ({ result }) } as Response;
    });
    const store = await loadStoreWithFetch(fetchImpl as unknown as typeof fetch);

    await store.rememberConfirm("admin1:s1:op_redis", 60);
    await expect(store.hasRecentConfirm("admin1:s1:op_redis", 60_000)).resolves.toBe(true);

    for (let i = 0; i < 2; i++) {
      const r = await store.registerFailure({ key: "admin:redis-fail", windowSec: 300, maxFailures: 3, lockoutSec: 600 });
      expect(r.locked).toBe(false);
    }
    const final = await store.registerFailure({ key: "admin:redis-fail", windowSec: 300, maxFailures: 3, lockoutSec: 600 });
    expect(final.locked).toBe(true);
    expect((await store.getFailureLockout("admin:redis-fail")).locked).toBe(true);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("getFailureLockout fails closed when Redis is configured but erroring", async () => {
    const store = await loadStoreWithFetch(
      vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch,
    );
    const lock = await store.getFailureLockout("admin:degraded");
    expect(lock.locked).toBe(true);
    expect(lock.unavailable).toBe(true);
    expect(lock.retryAfterSec).toBeGreaterThan(0);
  });

  it("registerFailure fails closed when Redis is configured but erroring", async () => {
    const store = await loadStoreWithFetch(
      vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch,
    );
    const result = await store.registerFailure({
      key: "admin:degraded",
      windowSec: 300,
      maxFailures: 5,
      lockoutSec: 600,
    });
    expect(result.locked).toBe(true);
    expect(result.unavailable).toBe(true);
  });

  it("hasRecentConfirm denies the grace window when Redis is configured but erroring", async () => {
    const store = await loadStoreWithFetch(
      vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch,
    );
    // rememberConfirm degrades to the local map, but the read side must not
    // trust per-instance state while the configured distributed store errors.
    await store.rememberConfirm("admin1:s1:op_degraded", 60);
    await expect(store.hasRecentConfirm("admin1:s1:op_degraded", 60_000)).resolves.toBe(false);
  });
});
