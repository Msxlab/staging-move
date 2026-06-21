import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  resolveAdminAlertRecipients: vi.fn(),
  sendLoggedEmail: vi.fn(),
  recordIntegrationOutcome: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: (...a: unknown[]) => mocks.guardCronRequest(...a),
}));
vi.mock("@/lib/admin-alerts", () => ({
  resolveAdminAlertRecipients: (...a: unknown[]) => mocks.resolveAdminAlertRecipients(...a),
}));
vi.mock("@/lib/email-service", () => ({
  sendLoggedEmail: (...a: unknown[]) => mocks.sendLoggedEmail(...a),
}));
vi.mock("@/lib/integration-telemetry", () => ({
  recordIntegrationOutcome: (...a: unknown[]) => mocks.recordIntegrationOutcome(...a),
}));

import { GET, PROBE_TIMEOUT_MS, buildTargets, evaluateProbeResponse } from "./route";

// Frozen "now" so the per-day dedupe key component is deterministic.
const NOW_UTC = new Date("2026-06-12T12:00:00.000Z");
const DAY = "2026-06-12";

const HOME_URL = "https://locateflow.com/";
const HEALTH_URL = "https://locateflow.com/api/health";
const ADMIN_URL = "https://admin.locateflow.com/login";

/** Healthy bodies per URL — the home page carries the SITE_NAME marker. */
function healthyFetchImpl(url: string): Promise<Response> {
  if (url === HOME_URL) {
    return Promise.resolve(
      new Response("<html><title>Move | Moving Checklist</title></html>", { status: 200 }),
    );
  }
  if (url === HEALTH_URL) {
    return Promise.resolve(new Response(JSON.stringify({ status: "healthy" }), { status: 200 }));
  }
  return Promise.resolve(new Response("<html>Admin login</html>", { status: 200 }));
}

function makeRequest() {
  return new NextRequest("http://localhost/api/cron/uptime-check", {
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("uptime-check cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW_UTC);
    vi.stubGlobal("fetch", mocks.fetch);
    vi.stubEnv("APP_ENV", "production");

    mocks.guardCronRequest.mockResolvedValue({ ok: true });
    mocks.resolveAdminAlertRecipients.mockResolvedValue(["owner@locateflow.com"]);
    mocks.sendLoggedEmail.mockResolvedValue({ success: true, skipped: false });
    mocks.fetch.mockImplementation((url: string) => healthyFetchImpl(String(url)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("rejects unauthenticated requests via the cron guard without probing anything", async () => {
    mocks.guardCronRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(mocks.guardCronRequest).toHaveBeenCalledWith(expect.anything(), "uptime-check");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
  });

  it("probes the three public surfaces and records ok telemetry when all are up", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, checked: 3, failures: 0, alertsSent: 0 });

    const probedUrls = mocks.fetch.mock.calls.map((c) => String(c[0]));
    expect(probedUrls).toEqual(expect.arrayContaining([HOME_URL, HEALTH_URL, ADMIN_URL]));
    // Every probe carries an abort signal (the 5s timeout).
    for (const call of mocks.fetch.mock.calls) {
      expect((call[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    }

    expect(mocks.recordIntegrationOutcome).toHaveBeenCalledTimes(3);
    expect(mocks.recordIntegrationOutcome).toHaveBeenCalledWith("uptime", "ok");
    expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    expect(mocks.resolveAdminAlertRecipients).not.toHaveBeenCalled();
  });

  it("flags a 200 home page WITHOUT the brand marker as DOWN and emails once per day per target", async () => {
    mocks.fetch.mockImplementation((url: string) => {
      if (String(url) === HOME_URL) {
        return Promise.resolve(new Response("<html>Bare maintenance splash</html>", { status: 200 }));
      }
      return healthyFetchImpl(String(url));
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    // Probe failures still answer HTTP 200 — the GHA job failure email is
    // reserved for total outage of the app hosting this route.
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: false, checked: 3, failures: 1, alertsSent: 1 });

    const failed = (body.targets as Array<Record<string, unknown>>).find((t) => !t.ok);
    expect(failed).toMatchObject({ id: "web-home", status: 200, reason: "marker_missing" });

    expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(1);
    const email = mocks.sendLoggedEmail.mock.calls[0][0] as Record<string, unknown>;
    expect(email.to).toBe("owner@locateflow.com");
    expect(email.subject).toContain("Uptime alert");
    // Per-day + per-target + per-recipient dedupe key.
    expect(email.dedupeKey).toBe(`cron:uptime-alert:web-home:${DAY}:owner@locateflow.com`);
    expect((email.metadata as Record<string, unknown>).kind).toBe("uptime-alert");

    expect(mocks.recordIntegrationOutcome).toHaveBeenCalledWith("uptime", "error");
    expect(
      mocks.recordIntegrationOutcome.mock.calls.filter(([, status]) => status === "ok"),
    ).toHaveLength(2);
  });

  it("flags a non-200 health endpoint with an http_<code> reason", async () => {
    mocks.fetch.mockImplementation((url: string) => {
      if (String(url) === HEALTH_URL) {
        return Promise.resolve(new Response("unhealthy", { status: 503 }));
      }
      return healthyFetchImpl(String(url));
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.ok).toBe(false);
    const failed = (body.targets as Array<Record<string, unknown>>).find((t) => !t.ok);
    expect(failed).toMatchObject({ id: "web-health", status: 503, reason: "http_503" });
    expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(1);
    expect((mocks.sendLoggedEmail.mock.calls[0][0] as Record<string, unknown>).dedupeKey).toBe(
      `cron:uptime-alert:web-health:${DAY}:owner@locateflow.com`,
    );
  });

  it("aborts a hung probe after 5s and reports it as a timeout", async () => {
    mocks.fetch.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url) === ADMIN_URL) {
        // Never resolves — only the abort signal can end it.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("This operation was aborted", "AbortError")),
          );
        });
      }
      return healthyFetchImpl(String(url));
    });

    const pending = GET(makeRequest());
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS + 1);
    const res = await pending;
    const body = await res.json();

    expect(body.ok).toBe(false);
    const failed = (body.targets as Array<Record<string, unknown>>).find((t) => !t.ok);
    expect(failed).toMatchObject({ id: "admin-login", status: null, reason: "timeout" });
    expect(mocks.recordIntegrationOutcome).toHaveBeenCalledWith("uptime", "error");
    expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(1);
  });

  it("reports a network-level fetch rejection as fetch_failed (never throws)", async () => {
    mocks.fetch.mockImplementation((url: string) => {
      if (String(url) === HOME_URL) {
        return Promise.reject(new TypeError("getaddrinfo ENOTFOUND locateflow.com"));
      }
      return healthyFetchImpl(String(url));
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    const failed = (body.targets as Array<Record<string, unknown>>).find((t) => !t.ok);
    expect(failed).toMatchObject({ id: "web-home", status: null, reason: "fetch_failed" });
  });

  it("fans alert emails out to every configured recipient with per-recipient dedupe keys", async () => {
    mocks.resolveAdminAlertRecipients.mockResolvedValue([
      "owner@locateflow.com",
      "ops@locateflow.com",
    ]);
    mocks.fetch.mockImplementation((url: string) => {
      if (String(url) === ADMIN_URL) {
        return Promise.resolve(new Response("nope", { status: 502 }));
      }
      return healthyFetchImpl(String(url));
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.alertsSent).toBe(2);
    const keys = mocks.sendLoggedEmail.mock.calls.map(
      (c) => (c[0] as Record<string, unknown>).dedupeKey,
    );
    expect(keys).toEqual([
      `cron:uptime-alert:admin-login:${DAY}:owner@locateflow.com`,
      `cron:uptime-alert:admin-login:${DAY}:ops@locateflow.com`,
    ]);
  });

  it("degrades to breadcrumbs only when no alert recipients are configured", async () => {
    mocks.resolveAdminAlertRecipients.mockResolvedValue([]);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.fetch.mockImplementation(() => Promise.resolve(new Response("down", { status: 500 })));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: false, failures: 3, alertsSent: 0 });
    expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    // Per-failure breadcrumbs + the no-recipients breadcrumb still fire.
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("answers a 200 JSON summary even when the alert transport itself fails", async () => {
    mocks.fetch.mockImplementation(() => Promise.resolve(new Response("down", { status: 500 })));
    mocks.sendLoggedEmail.mockRejectedValue(new Error("smtp exploded"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: false, failures: 3, alertsSent: 0 });
  });
});

describe("evaluateProbeResponse (pure verdict)", () => {
  it("passes a 200 with the marker present", () => {
    expect(evaluateProbeResponse({ marker: "Move" }, 200, "<title>Move</title>")).toEqual({
      ok: true,
      reason: null,
    });
  });

  it("passes a 200 without a marker requirement (body ignored)", () => {
    expect(evaluateProbeResponse({}, 200, null)).toEqual({ ok: true, reason: null });
  });

  it("fails a 200 missing the marker", () => {
    expect(evaluateProbeResponse({ marker: "Move" }, 200, "<h1>503</h1>")).toEqual({
      ok: false,
      reason: "marker_missing",
    });
  });

  it("fails any non-200 with the status in the reason", () => {
    expect(evaluateProbeResponse({}, 301, null)).toEqual({ ok: false, reason: "http_301" });
    expect(evaluateProbeResponse({}, 503, null)).toEqual({ ok: false, reason: "http_503" });
  });
});

describe("buildTargets", () => {
  const ENV_KEYS = [
    "UPTIME_WEB_BASE_URL",
    "UPTIME_ADMIN_BASE_URL",
    "NEXT_PUBLIC_ADMIN_URL",
    "APP_ENV",
    "VERCEL_ENV",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("defaults to the public production surfaces with the brand marker on the home page", () => {
    process.env.APP_ENV = "production";
    const targets = buildTargets();
    expect(targets.map((t) => t.url)).toEqual([HOME_URL, HEALTH_URL, ADMIN_URL]);
    expect(targets[0].marker).toBe("Move");
    expect(targets[1].marker).toBeUndefined();
  });

  it("does not default staging or preview runtimes to production surfaces", () => {
    process.env.APP_ENV = "staging";
    vi.stubEnv("NODE_ENV", "production");

    const targets = buildTargets();

    expect(targets.map((t) => t.url)).toEqual([
      "http://localhost:3000/",
      "http://localhost:3000/api/health",
      "http://localhost:3001/login",
    ]);
  });

  it("honors env overrides and strips trailing slashes", () => {
    process.env.UPTIME_WEB_BASE_URL = "https://staging.example.com/";
    process.env.NEXT_PUBLIC_ADMIN_URL = "https://admin-staging.example.com//";
    const targets = buildTargets();
    expect(targets.map((t) => t.url)).toEqual([
      "https://staging.example.com/",
      "https://staging.example.com/api/health",
      "https://admin-staging.example.com/login",
    ]);
  });
});
