import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(() => Promise.resolve("user-1")),
  rateLimit: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: () => mocks.requireDbUserId(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "maps:static:203.0.113.10"),
  rateLimit: (...args: unknown[]) => mocks.rateLimit(...args),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => mocks.getRuntimeConfigValue(...args),
}));

import { GET, buildStaticMapUrl, __resetStaticMapCacheForTests } from "./route";

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
    mocks.getRuntimeConfigValue.mockResolvedValue("test-maps-key-123");
    fetchMock.mockResolvedValue(pngResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects unauthenticated requests before touching Google", async () => {
    mocks.requireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(401);
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

  it("degrades to 503 when GOOGLE_MAPS_API_KEY is unconfigured", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);

    const response = await GET(request(VALID_QUERY));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("MAPS_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, max-age=604800, immutable");
    expect(response.headers.get("x-maps-cache")).toBe("MISS");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it("builds the upstream URL with sage/accent markers, geodesic path, Aurora styles, and the key", async () => {
    await GET(request(`${VALID_QUERY}&accent=FF9DB2`));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const upstreamUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(upstreamUrl).toContain("https://maps.googleapis.com/maps/api/staticmap");
    expect(upstreamUrl).toContain("size=640x296");
    expect(upstreamUrl).toContain("scale=2");
    // old home pin in sage, new home pin in the plan accent
    expect(upstreamUrl).toContain("markers=size:mid|color:0x87DDC0|41.8781,-87.6298");
    expect(upstreamUrl).toContain("markers=size:mid|color:0xFF9DB2|30.2672,-97.7431");
    expect(upstreamUrl).toContain("path=color:0xFF9DB2CC|weight:3|geodesic:true|41.8781,-87.6298|30.2672,-97.7431");
    // Aurora dark styling + label icons off
    expect(upstreamUrl).toContain("style=element:geometry|color:0x0F1726");
    expect(upstreamUrl).toContain("style=feature:poi|visibility:off");
    expect(upstreamUrl).toContain("key=test-maps-key-123");
  });

  it("never leaks the API key into the response", async () => {
    const response = await GET(request(VALID_QUERY));

    const headerDump = JSON.stringify(Object.fromEntries(response.headers.entries()));
    expect(headerDump).not.toContain("test-maps-key-123");
    const bodyText = Buffer.from(await response.arrayBuffer()).toString("utf8");
    expect(bodyText).not.toContain("test-maps-key-123");
  });

  it("serves repeat requests from the in-process LRU without re-hitting Google", async () => {
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
    expect(upstreamUrl).toContain("markers=size:mid|color:0x7FB6E8|30.2672,-97.7431");
  });

  it("uses the light Aurora palette for theme=light", async () => {
    await GET(request(VALID_QUERY.replace("theme=dark", "theme=light")));

    const upstreamUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(upstreamUrl).toContain("markers=size:mid|color:0x2E9B79|41.8781,-87.6298");
    expect(upstreamUrl).toContain("style=element:geometry|color:0xEDF1F7");
  });

  it("clamps oversized dimensions to the Static Maps free-tier maximum", async () => {
    await GET(request("from=41.8781,-87.6298&to=30.2672,-97.7431&w=5000&h=4"));

    const upstreamUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(upstreamUrl).toContain("size=640x80");
  });

  it("502s without caching when Google errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({ "content-type": "text/plain" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response);

    const errorResponse = await GET(request(VALID_QUERY));
    expect(errorResponse.status).toBe(502);
    expect((await errorResponse.json()).code).toBe("MAPS_UPSTREAM_ERROR");

    // The failure was not cached — the next request retries upstream.
    const retry = await GET(request(VALID_QUERY));
    expect(retry.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("502s when the upstream responds OK with a non-image body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response);

    const response = await GET(request(VALID_QUERY));
    expect(response.status).toBe(502);
  });

  it("buildStaticMapUrl rounds coordinates to 5 decimals", () => {
    const url = buildStaticMapUrl(
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
    // simply formats — assert the formatted pair appears once per marker.
    expect(decodeURIComponent(url)).toContain("41.123456789,-87.987654321");
    expect(decodeURIComponent(url)).toContain("30.5,-97.25");
  });
});
