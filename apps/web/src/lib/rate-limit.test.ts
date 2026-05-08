import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetLimiterHealthForTests,
  getLimiterHealth,
  getRateLimitKey,
  rateLimit,
} from "./rate-limit";

const originalEnv = { ...process.env };

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/", { headers });
}

async function importFreshRateLimit(env: NodeJS.ProcessEnv) {
  vi.resetModules();
  process.env = { ...originalEnv, ...env };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  return import("./rate-limit");
}

describe("getRateLimitKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores x-vercel-forwarded-for outside Vercel", () => {
    const req = makeRequest({
      "x-vercel-forwarded-for": "1.1.1.1",
      "cf-connecting-ip": "2.2.2.2",
      "x-real-ip": "3.3.3.3",
      "x-forwarded-for": "4.4.4.4",
    });
    expect(getRateLimitKey(req, "test")).toBe("test:2.2.2.2");
  });

  it("trusts x-vercel-forwarded-for on Vercel only", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const req = makeRequest({
      "x-vercel-forwarded-for": "1.1.1.1",
      "cf-connecting-ip": "2.2.2.2",
    });
    expect(getRateLimitKey(req, "test")).toBe("test:1.1.1.1");
  });

  it("falls back to cf-connecting-ip after vercel header", () => {
    const req = makeRequest({
      "cf-connecting-ip": "2.2.2.2",
      "x-real-ip": "3.3.3.3",
    });
    expect(getRateLimitKey(req)).toBe("api:2.2.2.2");
  });

  it("falls back to x-real-ip", () => {
    const req = makeRequest({ "x-real-ip": "3.3.3.3" });
    expect(getRateLimitKey(req, "auth")).toBe("auth:3.3.3.3");
  });

  it("takes the leftmost IP from x-forwarded-for", () => {
    const req = makeRequest({
      "x-forwarded-for": "5.5.5.5, 6.6.6.6, 7.7.7.7",
    });
    expect(getRateLimitKey(req)).toBe("api:5.5.5.5");
  });

  it("defaults to anonymous when no IP headers are present", () => {
    const req = makeRequest({});
    expect(getRateLimitKey(req)).toBe("api:anonymous");
  });
});

describe("rateLimit (in-memory fallback)", () => {
  it("allows requests up to the limit and denies beyond", async () => {
    const key = `test:rl:allow:${Math.random()}`;
    const config = { limit: 3, windowSeconds: 60 };

    const r1 = await rateLimit(key, config);
    const r2 = await rateLimit(key, config);
    const r3 = await rateLimit(key, config);
    const r4 = await rateLimit(key, config);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
    expect(r4.success).toBe(false);
  });

  it("reports decreasing remaining counts", async () => {
    const key = `test:rl:remaining:${Math.random()}`;
    const config = { limit: 5, windowSeconds: 60 };

    const r1 = await rateLimit(key, config);
    const r2 = await rateLimit(key, config);
    expect(r1.remaining).toBe(4);
    expect(r2.remaining).toBe(3);
  });

  it("tracks different keys independently", async () => {
    const k1 = `test:rl:iso1:${Math.random()}`;
    const k2 = `test:rl:iso2:${Math.random()}`;
    const config = { limit: 2, windowSeconds: 60 };

    await rateLimit(k1, config);
    await rateLimit(k1, config);
    const k1Over = await rateLimit(k1, config);
    const k2First = await rateLimit(k2, config);

    expect(k1Over.success).toBe(false);
    expect(k2First.success).toBe(true);
  });

  it("returns a resetAt in the future", async () => {
    const key = `test:rl:reset:${Math.random()}`;
    const config = { limit: 1, windowSeconds: 60 };
    const before = Date.now();
    const result = await rateLimit(key, config);
    expect(result.resetAt).toBeGreaterThan(before);
  });
});

describe("rateLimit fail-closed mode", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("fails closed for sensitive production-like endpoints when Redis is missing", async () => {
    const { rateLimit: freshRateLimit } = await importFreshRateLimit({
      NODE_ENV: "production",
      APP_ENV: "production",
    });

    const result = await freshRateLimit("auth:reset:test", {
      limit: 1,
      windowSeconds: 60,
      failClosed: true,
    });

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("keeps non-sensitive fallback behavior available outside fail-closed mode", async () => {
    const { rateLimit: freshRateLimit } = await importFreshRateLimit({
      NODE_ENV: "production",
      APP_ENV: "production",
    });

    const result = await freshRateLimit("read:test", {
      limit: 1,
      windowSeconds: 60,
    });

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
  });
});

describe("getLimiterHealth", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("reports memory mode and productionEnvOk=false in production without Redis", async () => {
    const mod = await importFreshRateLimit({
      NODE_ENV: "production",
      APP_ENV: "production",
    });
    const health = mod.getLimiterHealth();
    expect(health.distributedLimiterConfigured).toBe(false);
    expect(health.limiterMode).toBe("memory");
    expect(health.provider).toBe("memory");
    expect(health.environment).toBe("production");
    expect(health.productionEnvOk).toBe(false);
  });

  it("allows memory fallback in development without flagging productionEnvOk", async () => {
    const mod = await importFreshRateLimit({
      NODE_ENV: "development",
      APP_ENV: "development",
    });
    const health = mod.getLimiterHealth();
    expect(health.limiterMode).toBe("memory");
    expect(health.environment).toBe("development");
    expect(health.productionEnvOk).toBe(true);
  });

  it("never returns the Upstash URL or token in any field", async () => {
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: "https://secret-host.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "supersecrettoken1234567890ABCDEF",
      APP_ENV: "production",
      NODE_ENV: "production",
    };
    vi.resetModules();
    const mod = await import("./rate-limit");
    const health = mod.getLimiterHealth();
    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain("secret-host.upstash.io");
    expect(serialized).not.toContain("supersecrettoken1234567890ABCDEF");
    expect(health.distributedLimiterConfigured).toBe(true);
  });

  it("can be reset for tests", () => {
    __resetLimiterHealthForTests();
    const health = getLimiterHealth();
    expect(health.lastDegradedAt).toBeNull();
    expect(health.lastErrorReasonCode).toBeNull();
  });
});

describe("LIMITER_DEGRADED redaction", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("@upstash/ratelimit");
    vi.doUnmock("@upstash/redis");
    vi.resetModules();
  });

  it("scrubs URLs and bearer tokens out of the lastErrorReasonCode", async () => {
    vi.doMock("@upstash/ratelimit", () => {
      class MockRatelimit {
        static slidingWindow = () => ({});
        async limit() {
          throw new Error(
            "fetch failed: GET https://leaky.upstash.io/incr Bearer SUPERSECRETTOKEN_LEAKED",
          );
        }
      }
      return { Ratelimit: MockRatelimit };
    });
    vi.doMock("@upstash/redis", () => ({
      Redis: class MockRedis {
        constructor(_config: unknown) {}
      },
    }));
    vi.resetModules();
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: "https://leaky.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "SUPERSECRETTOKEN_LEAKED_PLEASE_REDACT",
    };

    const mod = await import("./rate-limit");
    mod.__resetLimiterHealthForTests();
    await mod.rateLimit("redacted-test-key", { limit: 5, windowSeconds: 60 });

    const health = mod.getLimiterHealth();
    expect(health.limiterMode).toBe("degraded");
    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain("leaky.upstash.io");
    expect(serialized).not.toContain("SUPERSECRETTOKEN_LEAKED");
    expect(health.lastErrorReasonCode).toMatch(/REDACTED|fetch failed/);
  });
});

describe("rateLimit (Redis-backed)", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("@upstash/ratelimit");
    vi.doUnmock("@upstash/redis");
    vi.resetModules();
  });

  it("uses the caller-provided limit and window for Redis limiters", async () => {
    const constructors: unknown[] = [];
    const limitMock = vi.fn(async () => ({
      success: true,
      remaining: 249,
      reset: Date.now() + 86_400_000,
    }));
    const slidingWindow = vi.fn((limit: number, window: string) => ({ limit, window }));

    vi.doMock("@upstash/ratelimit", () => {
      class MockRatelimit {
        static slidingWindow = slidingWindow;
        limit = limitMock;

        constructor(config: unknown) {
          constructors.push(config);
        }
      }

      return { Ratelimit: MockRatelimit };
    });
    vi.doMock("@upstash/redis", () => ({
      Redis: class MockRedis {
        constructor(_config: unknown) {}
      },
    }));

    vi.resetModules();
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "token",
    };

    const { rateLimit: freshRateLimit } = await import("./rate-limit");

    await freshRateLimit("places:autocomplete:daily:user:user-1:2026-04-30", {
      limit: 250,
      windowSeconds: 24 * 60 * 60,
    });

    expect(slidingWindow).toHaveBeenCalledWith(250, "86400 s");
    expect(constructors).toHaveLength(1);
    expect(constructors[0]).toEqual(expect.objectContaining({
      analytics: true,
      prefix: "rl:250:86400",
    }));
    expect(limitMock).toHaveBeenCalledWith("places:autocomplete:daily:user:user-1:2026-04-30");
  });
});
