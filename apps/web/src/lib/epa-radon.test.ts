import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRadonCache, lookupRadonZone } from "./epa-radon";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function radonFeatures(
  features: Array<{ RadonZone?: number | null; CountyFIPS?: string | null; CountyName?: string | null }>,
) {
  return { features: features.map((attributes) => ({ attributes })) };
}

const COORDS = { latitude: 30.2672, longitude: -97.7431 };

describe("epa-radon zone lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearRadonCache();
  });

  it("returns no_location without fetching when coordinates are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupRadonZone({ latitude: null, longitude: null })).status).toBe("no_location");
    expect((await lookupRadonZone({ longitude: -97.7431 })).status).toBe("no_location");
    expect((await lookupRadonZone({ latitude: Number.NaN, longitude: -97.7431 })).status).toBe("no_location");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the verified ROE_Radon layer (0) with a point intersect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(radonFeatures([{ RadonZone: 3, CountyFIPS: "48453", CountyName: "Travis" }])));
    vi.stubGlobal("fetch", fetchMock);

    await lookupRadonZone(COORDS);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("https://gispub.epa.gov/arcgis/rest/services/ORD/ROE_Radon/MapServer/0/query");
    expect(url).toContain("geometryType=esriGeometryPoint");
    expect(url).toContain("inSR=4326");
    expect(url).toContain(`geometry=${encodeURIComponent("-97.7431,30.2672")}`);
    expect(url).toContain(`outFields=${encodeURIComponent("RadonZone,CountyFIPS,CountyName")}`);
    expect(url).toContain("returnGeometry=false");
    expect(url).toContain("f=json");
  });

  it("maps each valid zone (1 = highest potential) with county context", async () => {
    for (const zone of [1, 2, 3] as const) {
      clearRadonCache();
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(jsonResponse(radonFeatures([{ RadonZone: zone, CountyFIPS: "48453", CountyName: "Travis" }]))),
      );
      const result = await lookupRadonZone(COORDS);
      expect(result).toMatchObject({ status: "ok", zone, countyName: "Travis", countyFips: "48453" });
    }
  });

  it("returns ok with null zone when no county polygon covers the point (unknown, not fabricated)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ features: [] })));
    const result = await lookupRadonZone(COORDS);
    expect(result).toMatchObject({ status: "ok", zone: null, countyName: null, countyFips: null });
  });

  it("rejects out-of-range or non-numeric RadonZone values instead of inventing a zone", async () => {
    for (const bad of [0, 4, 2.5, null, undefined]) {
      clearRadonCache();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse(radonFeatures([{ RadonZone: bad as number | null }]))),
      );
      const result = await lookupRadonZone(COORDS);
      expect(result.status).toBe("ok");
      expect(result.zone).toBeNull();
    }
  });

  it("degrades to error (not throw) on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await lookupRadonZone(COORDS);
    expect(result.status).toBe("error");
    expect(result.zone).toBeNull();
  });

  it("degrades to error on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    expect((await lookupRadonZone(COORDS)).status).toBe("error");
  });

  it("degrades to error when ArcGIS reports a failure inside an HTTP 200 body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: 400, message: "Invalid parameters" } })),
    );
    const result = await lookupRadonZone(COORDS);
    expect(result.status).toBe("error");
    expect(result.reason).toBe("arcgis_error_payload");
  });

  it("caches ok results per coordinate (no second fetch) but never caches errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(radonFeatures([{ RadonZone: 1 }])))
      .mockResolvedValue(jsonResponse(radonFeatures([{ RadonZone: 3 }])));
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupRadonZone(COORDS)).zone).toBe(1);
    expect((await lookupRadonZone(COORDS)).zone).toBe(1); // served from cache
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearRadonCache();
    const failingFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(jsonResponse(radonFeatures([{ RadonZone: 2 }])));
    vi.stubGlobal("fetch", failingFetch);
    expect((await lookupRadonZone(COORDS)).status).toBe("error");
    expect((await lookupRadonZone(COORDS)).status).toBe("ok");
    expect(failingFetch).toHaveBeenCalledTimes(2);
  });
});
