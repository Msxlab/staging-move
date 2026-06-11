import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/internal-secrets", () => ({
  verifyInternalAuth: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
  getLimiterHealth: vi.fn(),
}));

import { verifyInternalAuth } from "@/lib/internal-secrets";
import { getLimiterHealth, rateLimit } from "@/lib/rate-limit";
import { guardCronRequest } from "./cron-guard";

const verifyMock = verifyInternalAuth as unknown as Mock;
const rateLimitMock = rateLimit as unknown as Mock;
const limiterHealthMock = getLimiterHealth as unknown as Mock;

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://x.example.com/api/cron/test", {
    method: "POST",
    headers,
  });
}

function setLimiterConfigured(configured: boolean) {
  limiterHealthMock.mockReturnValue({ distributedLimiterConfigured: configured });
}

describe("guardCronRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: distributed limiter is wired (production-like).
    setLimiterConfigured(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("allows a valid request inside the rate-limit window (configured-healthy)", async () => {
    verifyMock.mockReturnValue(true);
    rateLimitMock.mockResolvedValue({ success: true, remaining: 9, resetAt: Date.now() + 60_000 });

    const result = await guardCronRequest(makeRequest({ authorization: "Bearer secret" }), "test-route");
    expect(result.ok).toBe(true);
    expect(verifyMock).toHaveBeenCalledWith("Bearer secret", "cron");
    // Configured limiter stays fail-closed against actual Redis errors.
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.stringContaining("cron:test-route"),
      expect.objectContaining({ failClosed: true }),
    );
  });

  it("rejects an unauthenticated request with 401", async () => {
    verifyMock.mockReturnValue(false);

    const result = await guardCronRequest(makeRequest(), "test-route");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
    // Rate-limit should not be consulted for unauthenticated calls.
    expect(rateLimitMock).not.toHaveBeenCalled();
  });

  it("rejects with 429 when route-level rate-limit is exceeded", async () => {
    verifyMock.mockReturnValue(true);
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() + 30_000 });

    const result = await guardCronRequest(makeRequest({ authorization: "Bearer x" }), "test-route");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBeTruthy();
    }
  });

  it("stays fail-closed (429) when the configured limiter errors out", async () => {
    // rateLimit() with failClosed:true surfaces a Redis failure as
    // success:false in production — the guard must deny, not bypass.
    verifyMock.mockReturnValue(true);
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const result = await guardCronRequest(makeRequest({ authorization: "Bearer x" }), "test-route");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
    }
  });

  it("proceeds WITHOUT rate limiting when the distributed limiter is unconfigured", async () => {
    setLimiterConfigured(false);
    verifyMock.mockReturnValue(true);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await guardCronRequest(makeRequest({ authorization: "Bearer secret" }), "test-route");

    // CRON_SECRET auth alone is the gate; no 429 single-point-of-silence.
    expect(result.ok).toBe(true);
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("test-route");
  });

  it("still requires auth even when the limiter is unconfigured", async () => {
    setLimiterConfigured(false);
    verifyMock.mockReturnValue(false);

    const result = await guardCronRequest(makeRequest(), "test-route");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("accepts legacy x-cron-secret header in Bearer form", async () => {
    verifyMock.mockReturnValue(true);
    rateLimitMock.mockResolvedValue({ success: true, remaining: 9, resetAt: Date.now() + 60_000 });

    await guardCronRequest(makeRequest({ "x-cron-secret": "legacy" }), "test-route");
    expect(verifyMock).toHaveBeenCalledWith("Bearer legacy", "cron");
  });

  it("namespaces the rate-limit key by route + caller IP", async () => {
    verifyMock.mockReturnValue(true);
    rateLimitMock.mockResolvedValue({ success: true, remaining: 9, resetAt: Date.now() + 60_000 });

    await guardCronRequest(
      makeRequest({ authorization: "Bearer x", "cf-connecting-ip": "203.0.113.7" }),
      "alpha",
    );
    await guardCronRequest(
      makeRequest({ authorization: "Bearer x", "cf-connecting-ip": "203.0.113.7" }),
      "beta",
    );
    const [firstCall, secondCall] = rateLimitMock.mock.calls;
    expect(firstCall[0]).toBe("cron:alpha:203.0.113.7");
    expect(secondCall[0]).toBe("cron:beta:203.0.113.7");
  });
});
