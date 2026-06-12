import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearHudHousingCache,
  extractCbsaCodeFromCrosswalk,
  extractCountyFipsFromCrosswalk,
  lookupHudHousing,
  parseFairMarketRent,
  parseIncomeLimits,
} from "./hud-housing";

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

function configure(values: Record<string, string | null>) {
  mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => values[key] ?? null);
}

function countyCrosswalk(county = "48453") {
  return { data: { results: [{ county, res_ratio: "0.92" }] } };
}

function cbsaCrosswalk(cbsa = "12420") {
  return { data: { results: [{ cbsa, res_ratio: "0.92" }] } };
}

const fmrPayload = {
  data: {
    county_name: "Travis County, TX",
    metro_name: "Austin-Round Rock-Georgetown, TX",
    area_name: "Austin-Round Rock-Georgetown, TX HUD Metro FMR Area",
    basicdata: {
      Efficiency: "1310",
      "One-Bedroom": "1480",
      "Two-Bedroom": "1888.4",
      "Three-Bedroom": "2450",
      "Four-Bedroom": "2890",
      year: "2026",
    },
  },
};

const incomePayload = {
  data: {
    year: "2026",
    median_income: 101200,
    extremely_low: { il30_p4: 37200 },
    very_low: { il50_p4: 62000 },
    low: { il80_p4: 84200 },
  },
};

describe("HUD housing lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearHudHousingCache();
  });

  it("returns disabled without fetching when the feature flag is off", async () => {
    configure({ HUD_HOUSING_DATA_ENABLED: "false", HUD_USER_API_TOKEN: "token" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupHudHousing({ zip: "78701", state: "TX" });

    expect(result.status).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not_configured or no_zip without fetching before calling HUD", async () => {
    configure({ HUD_HOUSING_DATA_ENABLED: "true", HUD_USER_API_TOKEN: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupHudHousing({ zip: "78701" })).status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();

    configure({ HUD_HOUSING_DATA_ENABLED: "true", HUD_USER_API_TOKEN: "token" });
    expect((await lookupHudHousing({ zip: "bad" })).status).toBe("no_zip");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("extracts county and CBSA codes from HUD USPS crosswalk payloads", () => {
    expect(extractCountyFipsFromCrosswalk(countyCrosswalk())).toBe("48453");
    expect(extractCbsaCodeFromCrosswalk(cbsaCrosswalk())).toBe("12420");
  });

  it("parses FMR and income-limit payloads defensively", () => {
    expect(parseFairMarketRent(fmrPayload, "78701")).toEqual({
      year: 2026,
      efficiency: 1310,
      oneBedroom: 1480,
      twoBedroom: 1888.4,
      threeBedroom: 2450,
      fourBedroom: 2890,
      zipSpecific: false,
    });
    expect(parseIncomeLimits(incomePayload)).toEqual({
      year: 2026,
      medianIncome: 101200,
      extremelyLowIncome4Person: 37200,
      veryLowIncome4Person: 62000,
      lowIncome4Person: 84200,
    });
  });

  it("queries crosswalk, then county HUD entity FMR and IL with bearer auth", async () => {
    configure({ HUD_HOUSING_DATA_ENABLED: "true", HUD_USER_API_TOKEN: "hud-token" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(countyCrosswalk()))
      .mockResolvedValueOnce(jsonResponse(cbsaCrosswalk()))
      .mockResolvedValueOnce(jsonResponse(fmrPayload))
      .mockResolvedValueOnce(jsonResponse(incomePayload));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupHudHousing({ zip: "78701-1234", state: "TX" });

    expect(result).toMatchObject({
      status: "ok",
      zip: "78701",
      entityId: "4845399999",
      countyFips: "48453",
      cbsaCode: "12420",
      countyName: "Travis County, TX",
      fairMarketRent: { twoBedroom: 1888.4 },
      incomeLimits: { medianIncome: 101200, lowIncome4Person: 84200 },
    });

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls[0]).toContain("/hudapi/public/usps?type=2&query=78701");
    expect(urls[1]).toContain("/hudapi/public/usps?type=3&query=78701");
    expect(urls[2]).toContain("/hudapi/public/fmr/data/4845399999");
    expect(urls[3]).toContain("/hudapi/public/il/data/4845399999");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer hud-token");
  });

  it("returns not_found when HUD has no geography/data for the ZIP", async () => {
    configure({ HUD_HOUSING_DATA_ENABLED: "true", HUD_USER_API_TOKEN: "hud-token" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ data: { results: [] } }))
        .mockResolvedValueOnce(jsonResponse({ data: { results: [] } })),
    );

    expect((await lookupHudHousing({ zip: "99999" })).status).toBe("not_found");
  });
});
