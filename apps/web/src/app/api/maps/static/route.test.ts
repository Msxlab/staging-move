import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(() => Promise.resolve("user-1")),
  rateLimit: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  requestHasPlanFeature: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: (options?: unknown) => (mocks.requireDbUserId as any)(options),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "maps:static:203.0.113.10"),
  rateLimit: (...args: unknown[]) => mocks.rateLimit(...args),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => mocks.getRuntimeConfigValue(...args),
}));

vi.mock("@/lib/request-entitlements", () => ({
  requestHasPlanFeature: (...args: unknown[]) => mocks.requestHasPlanFeature(...args),
}));

import { GET, buildGeoapifyStaticUrl, __resetStaticMapCacheForTests, runtime } from "./route";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function pngResponse() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "image/png" }),
    arrayBuffer: async () => PNG_BYTES.buffer.slice(0),
  } as unknown as Response;
}

function request(query: string) {
  return new NextRequest(`https://app.locateflow.com/api/maps/static?${query}`, {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
}

const VALID_QUERY = "from=41.8781,-87.6298&to=30.2672,-97.7431&w=640&h=296&theme=dark";

describe("/api/maps/static proxy", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    __resetStaticMapCacheForTests();
    mocks.requireDbUserId.mockResolvedValue("user-1");
    mocks.rateLimit.mockResolvedValue({ success: true, remaining: 10, resetAt: Date.now() + 1000 });
    mocks.requestHasPlanFeature.mockResolvedValue(true);
    mocks.getRuntimeConfigValue.mockResolvedValue("test-maps-key-123");
    fetchMock.mockResolvedValue(pngResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs in the Node runtime so the image proxy does not fall back to Edge semantics", () => {
    expect(runtime).toBe("nodejs");
  });

  it("rejects unauthenticated requests before touching Geoapify", async () => {
    mocks.requireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("403s before touching Geoapify when the plan lacks realMap", async () => {
    mocks.requestHasPlanFeature.mockResolvedValue(false);

    const response = await GET(request(VALID_QUERY));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("REAL_MAP_UPGRADE_REQUIRED");
    expect(mocks.getRuntimeConfigValue).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s on missing or malformed coordinates", async () => {
    for (const query of [
      "to=30.2672,-97.7431", // missing from
      "from=abc,def&to=30.2672,-97.7431", // non-numeric
      "from=91,-87.6&to=30.2672,-97.7431", // latitude out of range
      "from=41.8781&to=30.2672,-97.7431", // not a pair
    ]) {
      const response = await GET(request(query));
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.code).toBe("MAPS_INVALID_COORDINATES");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("degrades to 503 when no map source is configured", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);

    const response = await GET(request(VALID_QUERY));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("MAPS_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Geoapify for full route maps", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue("test-geoapify-key-123");

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const upstreamUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(upstreamUrl).toContain("https://maps.geoapify.com/v1/staticmap");
    expect(upstreamUrl).toContain("apiKey=test-geoapify-key-123");
  });

  it("429s when the per-user rate limit trips", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetAt: Date.now() + 1000 });

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams the PNG back with long immutable private cache headers", async () => {
    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(200);
    expect(mocks.requireDbUserId).toHaveBeenCalledWith({ invalidateOnFingerprintMismatch: false });
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, max-age=604800, immutable");
    expect(response.headers.get("x-maps-cache")).toBe("MISS");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it("builds the Geoapify upstream URL with sage/accent markers, route geometry, style, and the key", async () => {
    await GET(request(`${VALID_QUERY}&accent=FF9DB2`));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const upstreamUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(upstreamUrl).toContain("https://maps.geoapify.com/v1/staticmap");
    expect(upstreamUrl).toContain("width=640");
    expect(upstreamUrl).toContain("height=296");
    expect(upstreamUrl).toContain("scaleFactor=2");
    // old home pin in sage, new home pin in the plan accent
    expect(upstreamUrl).toContain("lonlat:-87.6298,41.8781;color:#87DDC0;size:48");
    expect(upstreamUrl).toContain("lonlat:-97.7431,30.2672;color:#FF9DB2;size:48");
    expect(upstreamUrl).toContain("geometry=polyline:-87.6298,41.8781,-97.7431,30.2672;linecolor:#FF9DB2;linewidth:4");
    expect(upstreamUrl).toContain("style=osm-bright-grey");
    expect(upstreamUrl).toContain("apiKey=test-maps-key-123");
  });

  it("never leaks the API key into the response", async () => {
    const response = await GET(request(VALID_QUERY));

    const headerDump = JSON.stringify(Object.fromEntries(response.headers.entries()));
    expect(headerDump).not.toContain("test-maps-key-123");
    const bodyText = Buffer.from(await response.arrayBuffer()).toString("utf8");
    expect(bodyText).not.toContain("test-maps-key-123");
  });

  it("serves repeat requests from the in-process LRU without re-hitting Geoapify", async () => {
    const first = await GET(request(VALID_QUERY));
    const second = await GET(request(VALID_QUERY));

    expect(first.headers.get("x-maps-cache")).toBe("MISS");
    expect(second.headers.get("x-maps-cache")).toBe("HIT");
    expect(second.status).toBe(200);
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(PNG_BYTES);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats theme/size/accent as part of the cache identity", async () => {
    await GET(request(VALID_QUERY));
    await GET(request(VALID_QUERY.replace("theme=dark", "theme=light")));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the per-theme default accent when the override is not valid hex", async () => {
    await GET(request(`${VALID_QUERY}&accent=not-a-color`));

    const upstreamUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(upstreamUrl).toContain("lonlat:-97.7431,30.2672;color:#7FB6E8;size:48");
  });

  it("uses the light Aurora palette for theme=light", async () => {
    await GET(request(VALID_QUERY.replace("theme=dark", "theme=light")));

    const upstreamUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(upstreamUrl).toContain("lonlat:-87.6298,41.8781;color:#2E9B79;size:48");
    expect(upstreamUrl).toContain("style=osm-bright");
  });

  it("clamps oversized dimensions to the static map maximum", async () => {
    await GET(request("from=41.8781,-87.6298&to=30.2672,-97.7431&w=5000&h=4"));

    const upstreamUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(upstreamUrl).toContain("width=640");
    expect(upstreamUrl).toContain("height=80");
  });

  it("does not cache a failed Geoapify upstream response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({ "content-type": "text/plain" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response);

    const failed = await GET(request(VALID_QUERY));
    expect(failed.status).toBe(424);

    // The failure was not cached — the next request retries upstream.
    const retry = await GET(request(VALID_QUERY));
    expect(retry.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("maps.geoapify.com");
  });

  it("times out a stalled upstream map fetch so clients can fall back quickly", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    try {
      const pending = GET(request(VALID_QUERY));
      await vi.advanceTimersByTimeAsync(4_000);
      const response = await pending;

      expect(response.status).toBe(424);
      expect(response.headers.get("x-maps-source-statuses")).toBe("geoapify=network_error");
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns a controlled diagnostic response when Geoapify fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "text/plain" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response);

    const response = await GET(request(VALID_QUERY));
    const body = await response.json();

    expect(response.status).toBe(424);
    expect(response.headers.get("x-maps-error-code")).toBe("MAPS_UPSTREAM_ERROR");
    expect(response.headers.get("x-maps-source-statuses")).toBe("geoapify=upstream_401");
    expect(body).toMatchObject({
      code: "MAPS_UPSTREAM_ERROR",
      sourceStatuses: {
        geoapify: "upstream_401",
      },
    });
    expect(JSON.stringify(body)).not.toContain("test-maps-key-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preview=1 serves a free Geoapify map WITHOUT the realMap gate", async () => {
    mocks.requestHasPlanFeature.mockResolvedValue(false); // free user

    const response = await GET(request(`${VALID_QUERY}&preview=1`));

    expect(response.status).toBe(200);
    // The preview tier is not plan-gated, so realMap is never even checked.
    expect(mocks.requestHasPlanFeature).not.toHaveBeenCalled();
    const upstreamUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(upstreamUrl).toContain("https://maps.geoapify.com/v1/staticmap");
    // Geoapify uses lon,lat order: sage origin + accent destination + a route line.
    expect(upstreamUrl).toContain("lonlat:-87.6298,41.8781;color:#87DDC0;size:48");
    expect(upstreamUrl).toContain("lonlat:-97.7431,30.2672;color");
    expect(upstreamUrl).toContain("geometry=polyline:-87.6298,41.8781,-97.7431,30.2672");
    expect(upstreamUrl).toContain("apiKey=test-maps-key-123");
  });

  it("caps preview size and caches it separately from the full route map", async () => {
    await GET(request("from=41.8781,-87.6298&to=30.2672,-97.7431&theme=dark&preview=1&w=640&h=640"));
    const previewUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(previewUrl).toContain("width=480");
    expect(previewUrl).toContain("height=480");

    // Same coords, full map → different dimensions/cache key → separate fetch.
    await GET(request(VALID_QUERY));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("maps.geoapify.com");
  });

  it("preview degrades to 503 when GEOAPIFY_API_KEY is unset", async () => {
    mocks.getRuntimeConfigValue.mockImplementation((key: string) =>
      Promise.resolve(key === "GEOAPIFY_API_KEY" ? null : "test-maps-key-123"),
    );

    const response = await GET(request(`${VALID_QUERY}&preview=1`));

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("MAPS_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a controlled diagnostic response when Geoapify responds OK with a non-image body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response);

    const response = await GET(request(VALID_QUERY));
    const body = await response.json();
    expect(response.status).toBe(424);
    expect(response.headers.get("x-maps-source-statuses")).toBe("geoapify=non_image");
    expect(body.sourceStatuses.geoapify).toBe("non_image");
  });

  it("buildGeoapifyStaticUrl formats lon/lat coordinates into markers and geometry", () => {
    const url = buildGeoapifyStaticUrl(
      {
        from: { lat: 41.123456789, lng: -87.987654321 },
        to: { lat: 30.5, lng: -97.25 },
        width: 320,
        height: 160,
        theme: "dark",
        accent: null,
      },
      "k",
    );
    // NOTE: parseLatLng rounds before this point in the route; the builder
    // simply formats in Geoapify's lon,lat order.
    expect(decodeURIComponent(url)).toContain("lonlat:-87.987654321,41.123456789");
    expect(decodeURIComponent(url)).toContain("lonlat:-97.25,30.5");
  });
});
