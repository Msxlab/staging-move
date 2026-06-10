import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFloodCache, lookupFloodZone } from "./fema-flood";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function nfhlFeatures(features: Array<{ FLD_ZONE?: string | null; ZONE_SUBTY?: string | null }>) {
  return { features: features.map((attributes) => ({ attributes })) };
}

const COORDS = { latitude: 29.9511, longitude: -90.0715 };

describe("fema-flood zone lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearFloodCache();
  });

  it("returns no_location without fetching when coordinates are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupFloodZone({ latitude: null, longitude: null })).status).toBe("no_location");
    expect((await lookupFloodZone({ latitude: 29.9511 })).status).toBe("no_location");
    expect((await lookupFloodZone({ latitude: Number.NaN, longitude: -90 })).status).toBe("no_location");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the verified Flood Hazard Zones layer (28) with a point intersect", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(nfhlFeatures([{ FLD_ZONE: "X" }])));
    vi.stubGlobal("fetch", fetchMock);

    await lookupFloodZone(COORDS);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query");
    expect(url).toContain("geometryType=esriGeometryPoint");
    expect(url).toContain("inSR=4326");
    expect(url).toContain(`geometry=${encodeURIComponent("-90.0715,29.9511")}`);
    expect(url).toContain(`outFields=${encodeURIComponent("FLD_ZONE,ZONE_SUBTY")}`);
    expect(url).toContain("returnGeometry=false");
    expect(url).toContain("f=json");
  });

  it("flags A* and V* zones as high risk", async () => {
    for (const zone of ["A", "AE", "AO", "A99", "V", "VE"]) {
      clearFloodCache();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(nfhlFeatures([{ FLD_ZONE: zone }]))));
      const result = await lookupFloodZone(COORDS);
      expect(result.status).toBe("ok");
      expect(result.zone).toBe(zone);
      expect(result.isHighRisk).toBe(true);
    }
  });

  it("reports zone X (and other mapped non-SFHA zones) as not high risk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(nfhlFeatures([{ FLD_ZONE: "X", ZONE_SUBTY: "0.2 PCT ANNUAL CHANCE FLOOD HAZARD" }])),
      ),
    );
    const result = await lookupFloodZone(COORDS);
    expect(result).toMatchObject({
      status: "ok",
      zone: "X",
      zoneSubtype: "0.2 PCT ANNUAL CHANCE FLOOD HAZARD",
      isHighRisk: false,
    });
  });

  it("returns ok with null zone AND null isHighRisk when no polygon covers the point (unknown, not minimal)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ features: [] })));
    const result = await lookupFloodZone(COORDS);
    expect(result).toMatchObject({ status: "ok", zone: null, isHighRisk: null });
  });

  it("treats the 'AREA NOT INCLUDED' sentinel as unmapped rather than a high-risk 'A' zone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(nfhlFeatures([{ FLD_ZONE: "AREA NOT INCLUDED" }]))),
    );
    const result = await lookupFloodZone(COORDS);
    expect(result).toMatchObject({ status: "ok", zone: null, isHighRisk: null });
  });

  it("degrades to error (not throw) on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await lookupFloodZone(COORDS);
    expect(result.status).toBe("error");
    expect(result.zone).toBeNull();
    expect(result.isHighRisk).toBeNull();
  });

  it("degrades to error on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    const result = await lookupFloodZone(COORDS);
    expect(result.status).toBe("error");
  });

  it("degrades to error when ArcGIS reports a failure inside an HTTP 200 body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: 400, message: "Invalid parameters" } })),
    );
    const result = await lookupFloodZone(COORDS);
    expect(result.status).toBe("error");
    expect(result.reason).toBe("arcgis_error_payload");
  });

  it("caches ok results per coordinate (no second fetch) but never caches errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(nfhlFeatures([{ FLD_ZONE: "AE" }])))
      .mockResolvedValue(jsonResponse(nfhlFeatures([{ FLD_ZONE: "X" }])));
    vi.stubGlobal("fetch", fetchMock);

    const first = await lookupFloodZone(COORDS);
    const second = await lookupFloodZone(COORDS);
    expect(first.zone).toBe("AE");
    expect(second.zone).toBe("AE"); // served from cache
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Errors are not cached: a failing lookup retries on the next call.
    clearFloodCache();
    const failingFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(jsonResponse(nfhlFeatures([{ FLD_ZONE: "X" }])));
    vi.stubGlobal("fetch", failingFetch);
    expect((await lookupFloodZone(COORDS)).status).toBe("error");
    expect((await lookupFloodZone(COORDS)).status).toBe("ok");
    expect(failingFetch).toHaveBeenCalledTimes(2);
  });
});
