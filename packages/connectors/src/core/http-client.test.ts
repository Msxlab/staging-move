import { describe, expect, it, vi } from "vitest";
import { ConnectorHttpError, createConnectorHttpClient } from "./http-client";
import { CircuitBreaker } from "./circuit-breaker";

type Init = Record<string, unknown>;

function fakeResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    headers: {
      forEach: (cb: (value: string, key: string) => void) =>
        Object.entries(headers).forEach(([k, v]) => cb(v, k)),
    },
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

const allowedHosts = ["api.partner.com"];

describe("createConnectorHttpClient", () => {
  it("blocks non-https URLs", async () => {
    const client = createConnectorHttpClient({ allowedHosts, fetchImpl: vi.fn() });
    await expect(client.request({ method: "GET", url: "http://api.partner.com/x" })).rejects.toThrow(
      /https only/,
    );
  });

  it("blocks hosts outside the allowlist", async () => {
    const client = createConnectorHttpClient({ allowedHosts, fetchImpl: vi.fn() });
    await expect(client.request({ method: "GET", url: "https://evil.com/x" })).rejects.toThrow(
      /allowlist/,
    );
  });

  it("returns a normalized response and parses JSON for an allowlisted host", async () => {
    const fetchImpl = vi.fn(async (_u: string, _i: Init) =>
      fakeResponse(200, { ok: true }, { "Content-Type": "application/json" }),
    );
    const client = createConnectorHttpClient({ allowedHosts, fetchImpl });

    const res = await client.request({ method: "POST", url: "https://api.partner.com/v1", body: { a: 1 } });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers["content-type"]).toBe("application/json");
    const init = fetchImpl.mock.calls[0]![1] as { body?: string };
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("adds signed headers via signRequest", async () => {
    const fetchImpl = vi.fn(async (_u: string, _i: Init) => fakeResponse(200, {}));
    const client = createConnectorHttpClient({
      allowedHosts,
      fetchImpl,
      signRequest: () => ({ "X-Sig": "abc" }),
    });

    await client.request({ method: "GET", url: "https://api.partner.com/v1" });

    const init = fetchImpl.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(init.headers["X-Sig"]).toBe("abc");
  });

  it("maps a thrown fetch error to PARTNER_DOWN", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const client = createConnectorHttpClient({ allowedHosts, fetchImpl });

    await expect(
      client.request({ method: "GET", url: "https://api.partner.com/v1" }),
    ).rejects.toMatchObject({ code: "PARTNER_DOWN" });
  });

  it("short-circuits to PARTNER_DOWN when the breaker is open", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    breaker.recordFailure(); // OPEN
    const fetchImpl = vi.fn(async (_u: string, _i: Init) => fakeResponse(200, {}));
    const client = createConnectorHttpClient({ allowedHosts, breaker, fetchImpl });

    await expect(
      client.request({ method: "GET", url: "https://api.partner.com/v1" }),
    ).rejects.toBeInstanceOf(ConnectorHttpError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("trips the breaker on a 5xx response", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    const fetchImpl = vi.fn(async (_u: string, _i: Init) => fakeResponse(503, "down"));
    const client = createConnectorHttpClient({ allowedHosts, breaker, fetchImpl });

    await client.request({ method: "GET", url: "https://api.partner.com/v1" });
    expect(breaker.canRequest()).toBe(false);
  });

  it("does not trip the breaker on a 4xx response", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    const fetchImpl = vi.fn(async (_u: string, _i: Init) => fakeResponse(422, { error: "bad" }));
    const client = createConnectorHttpClient({ allowedHosts, breaker, fetchImpl });

    const res = await client.request({ method: "GET", url: "https://api.partner.com/v1" });
    expect(res.ok).toBe(false);
    expect(breaker.canRequest()).toBe(true);
  });
});

describe("createConnectorHttpClient — redirect allowlist enforcement", () => {
  it("uses redirect:\"manual\" so fetch never auto-follows", async () => {
    const fetchImpl = vi.fn(async (_u: string, _i: Init) => fakeResponse(200, {}));
    const client = createConnectorHttpClient({ allowedHosts, fetchImpl });
    await client.request({ method: "GET", url: "https://api.partner.com/v1" });
    const init = fetchImpl.mock.calls[0]![1] as { redirect?: string };
    expect(init.redirect).toBe("manual");
  });

  it("follows a redirect to an allowed host, re-checking the allowlist each hop", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async (_u: string, _i: Init) =>
      n++ === 0
        ? fakeResponse(302, "", { Location: "https://api.partner.com/step2" })
        : fakeResponse(200, { ok: true }),
    );
    const client = createConnectorHttpClient({ allowedHosts, fetchImpl });
    const res = await client.request({ method: "GET", url: "https://api.partner.com/start" });
    expect(res.status).toBe(200);
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([
      "https://api.partner.com/start",
      "https://api.partner.com/step2",
    ]);
  });

  it("BLOCKS a redirect to a host outside the allowlist and never contacts it", async () => {
    const fetchImpl = vi.fn(async (_u: string, _i: Init) =>
      fakeResponse(302, "", { Location: "https://evil.com/steal" }),
    );
    const client = createConnectorHttpClient({ allowedHosts, fetchImpl });
    await expect(
      client.request({ method: "GET", url: "https://api.partner.com/start" }),
    ).rejects.toMatchObject({ code: "PARTNER_DOWN" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://api.partner.com/start");
  });

  it("stops after too many redirects", async () => {
    const fetchImpl = vi.fn(async (_u: string, _i: Init) =>
      fakeResponse(302, "", { Location: "https://api.partner.com/loop" }),
    );
    const client = createConnectorHttpClient({ allowedHosts, fetchImpl });
    await expect(
      client.request({ method: "GET", url: "https://api.partner.com/start" }),
    ).rejects.toThrow(/too many redirects/i);
  });
});
