import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLimiterHealth, probeLimiterReachable } from "../rate-limit-health";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("buildLimiterHealth", () => {
  it("flags productionEnvOk=false in production without Upstash env", () => {
    process.env.APP_ENV = "production";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const out = buildLimiterHealth({ url: "", token: "" });
    expect(out.distributedLimiterConfigured).toBe(false);
    expect(out.limiterMode).toBe("memory");
    expect(out.environment).toBe("production");
    expect(out.productionEnvOk).toBe(false);
  });

  it("treats placeholder values as unconfigured", () => {
    process.env.APP_ENV = "production";
    const out = buildLimiterHealth({
      url: "https://YOUR_INSTANCE.upstash.io".replace("YOUR_INSTANCE", "REPLACE"),
      token: "REPLACE_TOKEN",
    });
    expect(out.distributedLimiterConfigured).toBe(false);
    expect(out.limiterMode).toBe("memory");
  });

  it("allows in-memory fallback in development", () => {
    process.env.APP_ENV = "development";
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env.DIGITALOCEAN_APP_ID;
    const out = buildLimiterHealth({ url: "", token: "" });
    expect(out.environment).toBe("development");
    expect(out.productionEnvOk).toBe(true);
  });

  it("reports distributed when configured and reachable=true", () => {
    process.env.APP_ENV = "production";
    const out = buildLimiterHealth(
      { url: "https://x.upstash.io", token: "tok" },
      true,
    );
    expect(out.distributedLimiterConfigured).toBe(true);
    expect(out.limiterMode).toBe("distributed");
    expect(out.distributedLimiterReachable).toBe(true);
  });

  it("reports degraded when configured but reachable=false", () => {
    process.env.APP_ENV = "production";
    const out = buildLimiterHealth(
      { url: "https://x.upstash.io", token: "tok" },
      false,
      "HTTP_503",
    );
    expect(out.limiterMode).toBe("degraded");
    expect(out.distributedLimiterReachable).toBe(false);
    expect(out.lastErrorReasonCode).toBe("HTTP_503");
  });

  it("never echoes URL or token into output", () => {
    process.env.APP_ENV = "production";
    const out = buildLimiterHealth(
      {
        url: "https://very-secret-host.upstash.io",
        token: "verysupersecrettoken123",
      },
      true,
    );
    const json = JSON.stringify(out);
    expect(json).not.toContain("very-secret-host.upstash.io");
    expect(json).not.toContain("verysupersecrettoken123");
  });
});

describe("probeLimiterReachable", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns NOT_CONFIGURED for empty env without making a network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await probeLimiterReachable({ url: "", token: "" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redacts URL/token leakage from the reason string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        new Error(
          "fetch failed: connect to https://leaky-host.upstash.io with Bearer SUPERLONGTOKENVALUEXYZ123ABC456789",
        ),
      ),
    );
    const result = await probeLimiterReachable({
      url: "https://leaky-host.upstash.io",
      token: "SUPERLONGTOKENVALUEXYZ123ABC456789",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(result.reason).not.toContain("leaky-host.upstash.io");
    expect(result.reason).not.toContain("SUPERLONGTOKENVALUEXYZ");
  });

  it("treats non-PONG response as unreachable without revealing payload internals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: "WAT" }),
      }),
    );
    const result = await probeLimiterReachable({
      url: "https://x.upstash.io",
      token: "tok",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("UNEXPECTED_RESPONSE");
  });
});
