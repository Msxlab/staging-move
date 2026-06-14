import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSchoolDistrictCache, lookupSchoolDistrict } from "./nces-district";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function edgeFeatures(features: Array<{ NAME?: string | null; GEOID?: string | null }>) {
  return { features: features.map((attributes) => ({ attributes })) };
}

const COORDS = { latitude: 29.9511, longitude: -90.0715 };

describe("nces-district school district lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearSchoolDistrictCache();
  });

  it("returns no_location without fetching when coordinates are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupSchoolDistrict({ latitude: null, longitude: null })).status).toBe("no_location");
    expect((await lookupSchoolDistrict({ longitude: -90.0715 })).status).toBe("no_location");
    expect((await lookupSchoolDistrict({ latitude: 29.9511, longitude: Number.NaN })).status).toBe(
      "no_location",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the verified TL25/SY2425 composite layer with a point intersect for NAME,GEOID", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(edgeFeatures([{ NAME: "Orleans Parish School District", GEOID: "2201170" }])));
    vi.stubGlobal("fetch", fetchMock);

    await lookupSchoolDistrict(COORDS);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(
      "https://nces.ed.gov/opengis/rest/services/School_District_Boundaries/EDGE_SCHOOLDISTRICT_TL25_SY2425/MapServer/1/query",
    );
    expect(url).toContain("geometryType=esriGeometryPoint");
    expect(url).toContain("inSR=4326");
    expect(url).toContain(`geometry=${encodeURIComponent("-90.0715,29.9511")}`);
    expect(url).toContain(`outFields=${encodeURIComponent("NAME,GEOID")}`);
    expect(url).toContain("returnGeometry=false");
    expect(url).toContain("f=json");
  });

  it("returns the district name and NCES id when the point is inside a district", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(edgeFeatures([{ NAME: "Orleans Parish School District", GEOID: "2201170" }]))),
    );
    const result = await lookupSchoolDistrict(COORDS);
    expect(result).toMatchObject({
      status: "ok",
      districtName: "Orleans Parish School District",
      ncesId: "2201170",
    });
  });

  it("returns ok with nulls when no district polygon covers the point", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ features: [] })));
    const result = await lookupSchoolDistrict(COORDS);
    expect(result).toMatchObject({ status: "ok", districtName: null, ncesId: null });
  });

  it("skips features without a usable NAME", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(edgeFeatures([{ NAME: "  ", GEOID: "0000000" }, { NAME: "Real District", GEOID: "1234567" }])),
      ),
    );
    const result = await lookupSchoolDistrict(COORDS);
    expect(result).toMatchObject({ status: "ok", districtName: "Real District", ncesId: "1234567" });
  });

  it("degrades to error (not throw) on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await lookupSchoolDistrict(COORDS);
    expect(result.status).toBe("error");
    expect(result.districtName).toBeNull();
    expect(result.ncesId).toBeNull();
  });

  it("degrades to error on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    expect((await lookupSchoolDistrict(COORDS)).status).toBe("error");
  });

  it("degrades to error when ArcGIS reports a failure inside an HTTP 200 body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ error: { code: 400, message: "Invalid parameters" } }))),
    );
    const result = await lookupSchoolDistrict(COORDS);
    expect(result.status).toBe("error");
    expect(result.reason).toBe("arcgis_error_payload");
  });

  it("caches ok results per coordinate (no second fetch) but never caches errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(edgeFeatures([{ NAME: "First District", GEOID: "1111111" }])))
      .mockResolvedValue(jsonResponse(edgeFeatures([{ NAME: "Second District", GEOID: "2222222" }])));
    vi.stubGlobal("fetch", fetchMock);

    const first = await lookupSchoolDistrict(COORDS);
    const second = await lookupSchoolDistrict(COORDS);
    expect(first.districtName).toBe("First District");
    expect(second.districtName).toBe("First District"); // served from cache
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Errors are not cached: a failing lookup retries on the next call.
    clearSchoolDistrictCache();
    const failingFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("fallback blip"))
      .mockResolvedValueOnce(jsonResponse(edgeFeatures([{ NAME: "Recovered", GEOID: "3333333" }])));
    vi.stubGlobal("fetch", failingFetch);
    expect((await lookupSchoolDistrict(COORDS)).status).toBe("error");
    expect((await lookupSchoolDistrict(COORDS)).status).toBe("ok");
    expect(failingFetch).toHaveBeenCalledTimes(3);
  });
});
