import { afterEach, describe, expect, it, vi } from "vitest";
import { getRateLimitKey, rateLimit } from "./rate-limit";

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
