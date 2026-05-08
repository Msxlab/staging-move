import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/internal-secrets", () => ({
  verifyInternalAuth: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

import { verifyInternalAuth } from "@/lib/internal-secrets";
import { rateLimit } from "@/lib/rate-limit";
import { guardCronRequest } from "./cron-guard";

const verifyMock = verifyInternalAuth as unknown as Mock;
const rateLimitMock = rateLimit as unknown as Mock;

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://x.example.com/api/cron/test", {
    method: "POST",
    headers,
  });
}

describe("guardCronRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allows a valid request inside the rate-limit window", async () => {
    verifyMock.mockReturnValue(true);
    rateLimitMock.mockResolvedValue({ success: true, remaining: 9, resetAt: Date.now() + 60_000 });

    const result = await guardCronRequest(makeRequest({ authorization: "Bearer secret" }), "test-route");
    expect(result.ok).toBe(true);
    expect(verifyMock).toHaveBeenCalledWith("Bearer secret", "cron");
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
