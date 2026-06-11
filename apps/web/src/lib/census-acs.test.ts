import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyBand,
  clearNeighborhoodAcsCache,
  computeOwnerShare,
  extractTractGeography,
  lookupNeighborhoodAcs,
  parseAcsEstimate,
  rowToEstimateMap,
} from "./census-acs";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => mocks.getRuntimeConfigValue(...args),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Configure the runtime-config mock with the given Census key (null = unset). */
function configure(apiKey: string | null) {
  mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
    key === "CENSUS_API_KEY" ? apiKey : null,
  );
}

/** A geographies response resolving to Austin's tract 48/453/001103. */
function geoResponse(
  tract: Partial<{ STATE: string; COUNTY: string; TRACT: string; GEOID: string; NAME: string }> = {},
) {
  return {
    result: {
      geographies: {
        "Census Tracts": [
          {
            STATE: "48",
            COUNTY: "453",
            TRACT: "001103",
            GEOID: "48453001103",
            NAME: "Census Tract 11.03",
            ...tract,
          },
        ],
      },
    },
  };
}

/** An ACS data response (header + one data row) for the requested variables. */
function acsResponse(values: {
  home?: string | null;
  rent?: string | null;
  income?: string | null;
  total?: string | null;
  owner?: string | null;
}) {
  const header = [
    "NAME",
    "B25077_001E",
    "B25064_001E",
    "B19013_001E",
    "B25003_001E",
    "B25003_002E",
    "state",
    "county",
    "tract",
  ];
  const row = [
    "Census Tract 11.03, Travis County, Texas",
    values.home ?? null,
    values.rent ?? null,
    values.income ?? null,
    values.total ?? null,
    values.owner ?? null,
    "48",
    "453",
    "001103",
  ];
  return [header, row];
}

const COORDS = { latitude: 30.2672, longitude: -97.7431 };

describe("census-acs pure helpers", () => {
  it("parseAcsEstimate accepts non-negative numbers, rejects sentinels/garbage", () => {
    expect(parseAcsEstimate("420000")).toBe(420000);
    expect(parseAcsEstimate("0")).toBe(0);
    expect(parseAcsEstimate(125000)).toBe(125000);
    // Census suppression sentinels and junk → null (never fabricated).
    expect(parseAcsEstimate("-666666666")).toBeNull();
    expect(parseAcsEstimate(null)).toBeNull();
    expect(parseAcsEstimate(undefined)).toBeNull();
    expect(parseAcsEstimate("N/A")).toBeNull();
    expect(parseAcsEstimate("")).toBeNull();
  });

  it("classifyBand buckets a figure vs. the US reference midpoint", () => {
    expect(classifyBand(30_000, 78_000)).toBe("well_below_us"); // ratio <0.5
    expect(classifyBand(50_000, 78_000)).toBe("below_us"); // ratio <0.75
    expect(classifyBand(78_000, 78_000)).toBe("near_us"); // ratio ~1.0 (0.75–1.25)
    expect(classifyBand(95_000, 78_000)).toBe("near_us"); // ratio 1.22, still near
    expect(classifyBand(105_000, 78_000)).toBe("above_us"); // ratio 1.35 (1.25–1.5)
    expect(classifyBand(200_000, 78_000)).toBe("well_above_us"); // ratio >1.5
    expect(classifyBand(null, 78_000)).toBe("unknown");
    expect(classifyBand(50_000, 0)).toBe("unknown");
  });

  it("computeOwnerShare divides tenure counts, guarding empty/invalid universes", () => {
    expect(computeOwnerShare(600, 1000)).toBe(0.6);
    expect(computeOwnerShare(0, 1000)).toBe(0);
    expect(computeOwnerShare(500, 0)).toBeNull(); // empty universe
    expect(computeOwnerShare(null, 1000)).toBeNull();
    expect(computeOwnerShare(1200, 1000)).toBeNull(); // owners > total = bad row
  });

  it("extractTractGeography pulls FIPS from a geographies payload, null when absent", () => {
    const tract = extractTractGeography(geoResponse());
    expect(tract).toMatchObject({ state: "48", county: "453", tract: "001103", tractFips: "48453001103" });
    expect(extractTractGeography({ result: { geographies: { "Census Tracts": [] } } })).toBeNull();
    expect(extractTractGeography({})).toBeNull();
    // Malformed FIPS lengths are skipped, not coerced.
    expect(extractTractGeography(geoResponse({ STATE: "4", COUNTY: "453", TRACT: "001103" }))).toBeNull();
  });

  it("rowToEstimateMap zips a header+row, null on unexpected shapes (e.g. HTML page)", () => {
    const map = rowToEstimateMap([
      ["NAME", "B19013_001E"],
      ["Tract X", "78000"],
    ]);
    expect(map).toMatchObject({ NAME: "Tract X", B19013_001E: "78000" });
    expect(rowToEstimateMap("not an array")).toBeNull();
    expect(rowToEstimateMap([["NAME"]])).toBeNull(); // header only
  });
});

describe("lookupNeighborhoodAcs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearNeighborhoodAcsCache();
    configure("test-census-key");
  });

  it("returns not_configured without fetching when CENSUS_API_KEY is unset", async () => {
    configure(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupNeighborhoodAcs(COORDS);

    expect(result.status).toBe("not_configured");
    expect(result.medianHomeValue).toBeNull();
    expect(result.caveat).toContain("census tract");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not_configured when the runtime-config read itself rejects", async () => {
    mocks.getRuntimeConfigValue.mockRejectedValue(new Error("db down"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupNeighborhoodAcs(COORDS)).status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns no_location without fetching when coordinates are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupNeighborhoodAcs({ latitude: null, longitude: null })).status).toBe("no_location");
    expect((await lookupNeighborhoodAcs({ longitude: -97.7431 })).status).toBe("no_location");
    expect((await lookupNeighborhoodAcs({ latitude: Number.NaN, longitude: -97 })).status).toBe("no_location");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("geocodes (keyless) then queries ACS (keyed) with the resolved tract FIPS", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(geoResponse()))
      .mockResolvedValueOnce(
        jsonResponse(acsResponse({ home: "420000", rent: "1500", income: "105000", total: "1000", owner: "600" })),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupNeighborhoodAcs(COORDS);

    // First call: keyless geographies endpoint with the point.
    const geoUrl = String(fetchMock.mock.calls[0][0]);
    expect(geoUrl).toContain("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
    expect(geoUrl).toContain("x=-97.7431");
    expect(geoUrl).toContain("y=30.2672");
    expect(geoUrl).not.toContain("test-census-key");

    // Second call: keyed ACS data query scoped to the resolved tract.
    const dataUrl = String(fetchMock.mock.calls[1][0]);
    expect(dataUrl).toContain("https://api.census.gov/data/2023/acs/acs5");
    // URLSearchParams encodes ":" as %3A and the space between the two `in`
    // clauses as "+", so assert on the param value parsed back out.
    expect(new URL(dataUrl).searchParams.get("for")).toBe("tract:001103");
    expect(new URL(dataUrl).searchParams.get("in")).toBe("state:48 county:453");
    expect(dataUrl).toContain("key=test-census-key");
    const get = decodeURIComponent(new URL(dataUrl).searchParams.get("get") || "");
    expect(get).toContain("B25077_001E");
    expect(get).toContain("B25064_001E");
    expect(get).toContain("B19013_001E");

    expect(result).toMatchObject({
      status: "ok",
      geography: "tract",
      tractFips: "48453001103",
      medianHomeValue: 420000,
      medianGrossRent: 1500,
      medianHouseholdIncome: 105000,
      ownerOccupiedShare: 0.6,
      incomeBand: "above_us",
    });
  });

  it("reports suppressed estimates as null instead of fabricating them", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(geoResponse()))
        .mockResolvedValueOnce(
          jsonResponse(acsResponse({ home: "-666666666", rent: null, income: "60000", total: "0", owner: "0" })),
        ),
    );

    const result = await lookupNeighborhoodAcs(COORDS);
    expect(result.status).toBe("ok");
    expect(result.medianHomeValue).toBeNull();
    expect(result.medianGrossRent).toBeNull();
    expect(result.medianHouseholdIncome).toBe(60000);
    expect(result.ownerOccupiedShare).toBeNull(); // empty tenure universe
    expect(result.homeValueBand).toBe("unknown");
  });

  it("returns ok with null figures when no tract covers the point (offshore/non-US)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ result: { geographies: { "Census Tracts": [] } } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupNeighborhoodAcs(COORDS);
    expect(result).toMatchObject({ status: "ok", geography: null, tractFips: null, medianHomeValue: null });
    // No ACS data call is made when there is no tract to query.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("degrades to error (not throw) when the geocode hop fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await lookupNeighborhoodAcs(COORDS);
    expect(result.status).toBe("error");
    expect(result.medianHomeValue).toBeNull();
  });

  it("degrades to error when the ACS data hop returns a non-2xx (e.g. missing-key redirect)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(geoResponse()))
        .mockResolvedValueOnce(jsonResponse({}, 302)),
    );
    expect((await lookupNeighborhoodAcs(COORDS)).status).toBe("error");
  });

  it("degrades to error when the ACS data hop is not the expected [header,row] array", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(geoResponse()))
        .mockResolvedValueOnce(jsonResponse({ error: "missing key" })),
    );
    const result = await lookupNeighborhoodAcs(COORDS);
    expect(result.status).toBe("error");
    expect(result.reason).toBe("unexpected_acs_response_shape");
  });

  it("caches ok results per coordinate (no second pair of fetches) but never caches errors", async () => {
    const okFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(geoResponse()))
      .mockResolvedValueOnce(jsonResponse(acsResponse({ income: "80000" })));
    vi.stubGlobal("fetch", okFetch);

    expect((await lookupNeighborhoodAcs(COORDS)).medianHouseholdIncome).toBe(80000);
    expect((await lookupNeighborhoodAcs(COORDS)).medianHouseholdIncome).toBe(80000); // cache
    expect(okFetch).toHaveBeenCalledTimes(2); // one geocode + one data, not four

    clearNeighborhoodAcsCache();
    const failFirst = vi.fn().mockRejectedValue(new Error("blip"));
    vi.stubGlobal("fetch", failFirst);
    expect((await lookupNeighborhoodAcs(COORDS)).status).toBe("error");
    // Error not cached → a later success re-fetches.
    const recovered = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(geoResponse()))
      .mockResolvedValueOnce(jsonResponse(acsResponse({ income: "80000" })));
    vi.stubGlobal("fetch", recovered);
    expect((await lookupNeighborhoodAcs(COORDS)).status).toBe("ok");
  });
});
