import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  lookupFccIsps,
  isIspServiceable,
  normalizeIspName,
  clearFccCache,
} from "./fcc-isp";

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

/** Configure the runtime-config mock to enable FCC with the given key. */
function configure(values: Record<string, string | null>) {
  mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => values[key] ?? null);
}

const COORDS = { latitude: 38.0, longitude: -77.0 };

describe("fcc-isp serviceability lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFccCache();
    vi.restoreAllMocks();
  });

  it("normalizes ISP names for cross-source matching", () => {
    expect(normalizeIspName("AT&T Internet")).toBe(normalizeIspName("AT&T"));
    expect(normalizeIspName("Comcast Communications")).toBe("comcast");
    expect(normalizeIspName(null)).toBe("");
  });

  it("returns not_configured when the master flag is off (graceful no-op)", async () => {
    configure({ FCC_BDC_ENABLED: "false", FCC_BDC_API_KEY: "tok" });
    const result = await lookupFccIsps(COORDS);
    expect(result.status).toBe("not_configured");
    expect(result.providers).toHaveLength(0);
  });

  it("returns not_configured when the API key is missing", async () => {
    configure({ FCC_BDC_ENABLED: "true", FCC_BDC_API_KEY: null });
    const result = await lookupFccIsps(COORDS);
    expect(result.status).toBe("not_configured");
  });

  it("returns no_location when enabled but no coordinates/block given", async () => {
    configure({ FCC_BDC_ENABLED: "true", FCC_BDC_API_KEY: "tok" });
    const result = await lookupFccIsps({ latitude: null, longitude: null });
    expect(result.status).toBe("no_location");
  });

  it("parses FCC availability rows when configured and coordinates resolve", async () => {
    configure({ FCC_BDC_ENABLED: "true", FCC_BDC_API_KEY: "tok" });
    const fetchMock = vi
      .fn()
      // 1st call: FCC block API → resolve block GEOID
      .mockResolvedValueOnce(jsonResponse({ Block: { FIPS: "510079999001234" } }))
      // 2nd call: FCC availability endpoint
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              provider_id: 1234,
              brand_name: "Comcast",
              technology: 40,
              max_advertised_download_speed: 1000,
              max_advertised_upload_speed: 35,
            },
            {
              provider_id: 5678,
              brand_name: "AT&T",
              technology: 50,
              max_advertised_download_speed: 5000,
              max_advertised_upload_speed: 5000,
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupFccIsps(COORDS);
    expect(result.status).toBe("ok");
    expect(result.blockGeoid).toBe("510079999001234");
    expect(result.providers.map((p) => p.brandName).sort()).toEqual(["AT&T", "Comcast"]);

    // Catalog name "AT&T Internet" should match FCC "AT&T".
    expect(isIspServiceable(result, "AT&T Internet")).toBe(true);
    expect(isIspServiceable(result, "Comcast")).toBe(true);
    expect(isIspServiceable(result, "Verizon Fios")).toBe(false);
  });

  it("degrades to error (not throw) on network failure", async () => {
    configure({ FCC_BDC_ENABLED: "true", FCC_BDC_API_KEY: "tok" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ Block: { FIPS: "510079999001234" } }))
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupFccIsps(COORDS);
    expect(result.status).toBe("error");
    expect(result.providers).toHaveLength(0);
    // isIspServiceable must be safe to call on a degraded result.
    expect(isIspServiceable(result, "Comcast")).toBe(false);
  });

  it("never reports serviceable for a non-ok result", () => {
    const degraded = {
      status: "not_configured" as const,
      providers: [],
      normalizedBrandNames: new Set<string>(["comcast"]),
      blockGeoid: null,
      reason: "fcc_bdc_disabled",
      source: {
        name: "FCC National Broadband Map (BDC)" as const,
        url: "https://broadbandmap.fcc.gov/" as const,
        selfReported: true as const,
      },
    };
    expect(isIspServiceable(degraded, "Comcast")).toBe(false);
  });
});
