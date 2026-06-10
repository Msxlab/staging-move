import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearHazardRiskCache, extractTopRisks, lookupHazardRisks } from "./fema-nri";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function nriFeatures(attributes: Record<string, unknown> | null) {
  return { features: attributes === null ? [] : [{ attributes }] };
}

const COORDS = { latitude: 29.9511, longitude: -90.0715 };

describe("fema-nri hazard risk lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearHazardRiskCache();
  });

  it("returns no_location without fetching when coordinates are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupHazardRisks({ latitude: null, longitude: null })).status).toBe("no_location");
    expect((await lookupHazardRisks({ latitude: 29.9511 })).status).toBe("no_location");
    expect((await lookupHazardRisks({ latitude: Number.NaN, longitude: -90 })).status).toBe("no_location");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the verified NRI census tracts layer (0) with a point intersect and all rating fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(nriFeatures({ RISK_RATNG: "Very Low" })));
    vi.stubGlobal("fetch", fetchMock);

    await lookupHazardRisks(COORDS);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(
      "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0/query",
    );
    expect(url).toContain("geometryType=esriGeometryPoint");
    expect(url).toContain("inSR=4326");
    expect(url).toContain(`geometry=${encodeURIComponent("-90.0715,29.9511")}`);
    expect(url).toContain("returnGeometry=false");
    expect(url).toContain("f=json");
    // The composite + all 18 hazard rating fields are requested.
    const outFields = decodeURIComponent(new URL(url).searchParams.get("outFields") || "");
    expect(outFields).toContain("RISK_RATNG");
    expect(outFields.match(/_RISKR/g)).toHaveLength(18);
  });

  it("maps qualifying hazards to topRisks worst-first, capped at 3", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          nriFeatures({
            RISK_RATNG: "Very High",
            HRCN_RISKR: "Very High",
            CFLD_RISKR: "Relatively Moderate",
            LTNG_RISKR: "Relatively High",
            HWAV_RISKR: "Relatively Moderate", // 4th qualifier — must be cut by the cap
            TRND_RISKR: "Relatively Low", // below threshold
            WFIR_RISKR: "Very Low", // below threshold
            ERQK_RISKR: "No Rating", // sentinel — never qualifies
          }),
        ),
      ),
    );

    const result = await lookupHazardRisks(COORDS);

    expect(result.status).toBe("ok");
    expect(result.overallRating).toBe("Very High");
    expect(result.topRisks).toEqual([
      { hazard: "Hurricane", rating: "Very High" },
      { hazard: "Lightning", rating: "Relatively High" },
      // Coastal Flooding wins the moderate tie against Heat Wave via the
      // stable field order; the 4th qualifier is dropped by the cap.
      { hazard: "Coastal Flooding", rating: "Relatively Moderate" },
    ]);
  });

  it("returns ok with empty topRisks when nothing reaches Relatively Moderate (a good answer)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(nriFeatures({ RISK_RATNG: "Very Low", TRND_RISKR: "Relatively Low", HAIL_RISKR: "Very Low" })),
      ),
    );

    const result = await lookupHazardRisks(COORDS);

    expect(result).toMatchObject({ status: "ok", topRisks: [], overallRating: "Very Low" });
  });

  it("returns ok with nulls/empty when no tract covers the point (unknown, not fabricated)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(nriFeatures(null))));
    const result = await lookupHazardRisks(COORDS);
    expect(result).toMatchObject({ status: "ok", topRisks: [], overallRating: null });
  });

  it("reports sentinel composite ratings (e.g. 'Insufficient Data') as null, never as a rating", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(nriFeatures({ RISK_RATNG: "Insufficient Data" }))),
    );
    const result = await lookupHazardRisks(COORDS);
    expect(result.status).toBe("ok");
    expect(result.overallRating).toBeNull();
  });

  it("degrades to error (not throw) on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await lookupHazardRisks(COORDS);
    expect(result.status).toBe("error");
    expect(result.topRisks).toEqual([]);
    expect(result.overallRating).toBeNull();
  });

  it("degrades to error on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    expect((await lookupHazardRisks(COORDS)).status).toBe("error");
  });

  it("degrades to error when ArcGIS reports a failure inside an HTTP 200 body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: 400, message: "Invalid parameters" } })),
    );
    const result = await lookupHazardRisks(COORDS);
    expect(result.status).toBe("error");
    expect(result.reason).toBe("arcgis_error_payload");
  });

  it("caches ok results per coordinate (no second fetch) but never caches errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(nriFeatures({ RISK_RATNG: "Very High" })))
      .mockResolvedValue(jsonResponse(nriFeatures({ RISK_RATNG: "Very Low" })));
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupHazardRisks(COORDS)).overallRating).toBe("Very High");
    expect((await lookupHazardRisks(COORDS)).overallRating).toBe("Very High"); // served from cache
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearHazardRiskCache();
    const failingFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(jsonResponse(nriFeatures({ RISK_RATNG: "Very Low" })));
    vi.stubGlobal("fetch", failingFetch);
    expect((await lookupHazardRisks(COORDS)).status).toBe("error");
    expect((await lookupHazardRisks(COORDS)).status).toBe("ok");
    expect(failingFetch).toHaveBeenCalledTimes(2);
  });

  describe("extractTopRisks", () => {
    it("ignores non-string and unknown rating values", () => {
      expect(
        extractTopRisks({
          HRCN_RISKR: 5,
          TRND_RISKR: "Not Applicable",
          WFIR_RISKR: "  Relatively High  ", // trimmed
          CWAV_RISKR: null,
        }),
      ).toEqual([{ hazard: "Wildfire", rating: "Relatively High" }]);
    });

    it("orders equally rated hazards by the stable field order", () => {
      expect(
        extractTopRisks({
          WNTW_RISKR: "Relatively Moderate",
          AVLN_RISKR: "Relatively Moderate",
        }),
      ).toEqual([
        { hazard: "Avalanche", rating: "Relatively Moderate" },
        { hazard: "Winter Weather", rating: "Relatively Moderate" },
      ]);
    });
  });
});
