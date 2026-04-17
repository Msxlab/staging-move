import { describe, it, expect } from "vitest";
import { rateLimit, getRateLimitKey } from "./rate-limit";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/", { headers });
}

describe("getRateLimitKey", () => {
  it("prefers x-vercel-forwarded-for over everything else", () => {
    const req = makeRequest({
      "x-vercel-forwarded-for": "1.1.1.1",
      "cf-connecting-ip": "2.2.2.2",
      "x-real-ip": "3.3.3.3",
      "x-forwarded-for": "4.4.4.4",
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
    const req = makeRequest({ "x-forwarded-for": "5.5.5.5, 6.6.6.6, 7.7.7.7" });
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
