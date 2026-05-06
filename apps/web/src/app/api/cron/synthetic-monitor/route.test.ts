import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/internal-secrets", () => ({
  verifyInternalAuth: vi.fn(),
}));

vi.mock("@/lib/app-url", () => ({
  getConfiguredAppUrl: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { verifyInternalAuth } from "@/lib/internal-secrets";
import { getConfiguredAppUrl } from "@/lib/app-url";
import { GET, POST } from "./route";

const verifyInternalAuthMock = verifyInternalAuth as unknown as Mock;
const getConfiguredAppUrlMock = getConfiguredAppUrl as unknown as Mock;

const BASE = "https://app.example.com";

function makeRequest(headers: Record<string, string> = {}, method: "GET" | "POST" = "POST") {
  return new NextRequest("http://localhost/api/cron/synthetic-monitor", {
    method,
    headers: { ...headers },
  });
}

interface FakeResponse {
  status: number;
}

function fakeFetch(map: Record<string, FakeResponse | Error>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [path, value] of Object.entries(map)) {
      if (url.endsWith(path)) {
        if (value instanceof Error) throw value;
        return new Response(null, { status: value.status });
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const ALL_OK_MAP: Record<string, FakeResponse> = {
  "/": { status: 200 },
  "/api/health": { status: 200 },
  "/sign-in": { status: 200 },
  "/sign-up": { status: 200 },
  "/pricing": { status: 200 },
  "/faq": { status: 200 },
  "/robots.txt": { status: 200 },
  "/sitemap.xml": { status: 200 },
  "/dashboard": { status: 307 },
};

describe("synthetic-monitor route", () => {
  let originalFetch: typeof fetch;
  let originalEnabled: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    verifyInternalAuthMock.mockReturnValue(true);
    getConfiguredAppUrlMock.mockResolvedValue(BASE);
    originalFetch = globalThis.fetch;
    originalEnabled = process.env.TEST_AUTOMATION_ENABLED;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnabled === undefined) {
      delete process.env.TEST_AUTOMATION_ENABLED;
    } else {
      process.env.TEST_AUTOMATION_ENABLED = originalEnabled;
    }
  });

  it("returns 401 when CRON_SECRET is missing or wrong", async () => {
    verifyInternalAuthMock.mockReturnValue(false);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.failures).toContain("unauthorized");
    expect(body.checks).toEqual([]);
  });

  it("accepts Bearer token via Authorization header", async () => {
    globalThis.fetch = fakeFetch(ALL_OK_MAP) as unknown as typeof fetch;
    const res = await POST(makeRequest({ authorization: "Bearer correct-secret" }));
    expect(verifyInternalAuthMock).toHaveBeenCalledWith("Bearer correct-secret", "cron");
    expect(res.status).toBe(200);
  });

  it("accepts legacy x-cron-secret header", async () => {
    globalThis.fetch = fakeFetch(ALL_OK_MAP) as unknown as typeof fetch;
    const res = await POST(makeRequest({ "x-cron-secret": "legacy-secret" }));
    expect(verifyInternalAuthMock).toHaveBeenCalledWith("Bearer legacy-secret", "cron");
    expect(res.status).toBe(200);
  });

  it("short-circuits with skipped reason when TEST_AUTOMATION_ENABLED=false", async () => {
    process.env.TEST_AUTOMATION_ENABLED = "false";
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const res = await POST(makeRequest({ authorization: "Bearer x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe("TEST_AUTOMATION_ENABLED=false");
    expect(body.checks).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 200 + ok=true when every check passes", async () => {
    globalThis.fetch = fakeFetch(ALL_OK_MAP) as unknown as typeof fetch;
    const res = await POST(makeRequest({ authorization: "Bearer x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.failures).toEqual([]);
    expect(body.baseUrl).toBe(BASE);
    expect(body.testRunId).toMatch(/^synthetic-\d{4}-\d{2}-\d{2}T/);
    const names = body.checks.map((c: { name: string }) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "homepage",
        "health",
        "sign-in",
        "sign-up",
        "pricing",
        "faq",
        "robots",
        "sitemap",
        "dashboard-auth-gate",
      ]),
    );
  });

  it("returns 503 when a critical path returns the wrong status", async () => {
    globalThis.fetch = fakeFetch({
      ...ALL_OK_MAP,
      "/pricing": { status: 500 },
    }) as unknown as typeof fetch;
    const res = await POST(makeRequest({ authorization: "Bearer x" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.failures.some((f: string) => f.startsWith("pricing:"))).toBe(true);
  });

  it("treats unauth /dashboard returning 200 as a leak (failure)", async () => {
    // If the auth gate breaks and /dashboard renders without redirecting,
    // that's a serious regression — protected pages are leaking. The
    // monitor must catch it.
    globalThis.fetch = fakeFetch({
      ...ALL_OK_MAP,
      "/dashboard": { status: 200 },
    }) as unknown as typeof fetch;
    const res = await POST(makeRequest({ authorization: "Bearer x" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.failures.some((f: string) => f.startsWith("dashboard-auth-gate:"))).toBe(true);
  });

  it("captures fetch errors per-check without throwing", async () => {
    globalThis.fetch = fakeFetch({
      ...ALL_OK_MAP,
      "/api/health": new Error("ECONNREFUSED"),
    }) as unknown as typeof fetch;
    const res = await POST(makeRequest({ authorization: "Bearer x" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    const healthCheck = body.checks.find((c: { name: string }) => c.name === "health");
    expect(healthCheck.ok).toBe(false);
    expect(healthCheck.status).toBeNull();
    expect(healthCheck.error).toContain("ECONNREFUSED");
  });

  it("returns 500 with structured report when base URL cannot be resolved", async () => {
    getConfiguredAppUrlMock.mockRejectedValue(new Error("APP_URL_CONFIG_ERROR"));
    const res = await POST(makeRequest({ authorization: "Bearer x" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.failures[0]).toContain("base-url:");
    expect(body.checks).toEqual([]);
  });

  it("supports GET as well as POST so simple uptime probes can call it", async () => {
    globalThis.fetch = fakeFetch(ALL_OK_MAP) as unknown as typeof fetch;
    const res = await GET(makeRequest({ authorization: "Bearer x" }, "GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
