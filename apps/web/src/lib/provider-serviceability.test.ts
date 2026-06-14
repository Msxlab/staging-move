import { beforeEach, describe, expect, it, vi } from "vitest";
import { enrichProviderServiceability, type ServiceabilityProvider } from "./provider-serviceability";
import { isIspServiceable, lookupFccIsps } from "@/lib/fcc-isp";
import { isElectricUtilityServiceable, lookupElectricUtilities } from "@/lib/electric-utility";

vi.mock("@/lib/fcc-isp", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fcc-isp")>("@/lib/fcc-isp");
  return {
    ...actual,
    lookupFccIsps: vi.fn(),
    isIspServiceable: vi.fn(),
  };
});

vi.mock("@/lib/electric-utility", async () => {
  const actual = await vi.importActual<typeof import("@/lib/electric-utility")>("@/lib/electric-utility");
  return {
    ...actual,
    lookupElectricUtilities: vi.fn(),
    isElectricUtilityServiceable: vi.fn(),
  };
});

const lookupFccIspsMock = vi.mocked(lookupFccIsps);
const isIspServiceableMock = vi.mocked(isIspServiceable);
const lookupElectricUtilitiesMock = vi.mocked(lookupElectricUtilities);
const isElectricUtilityServiceableMock = vi.mocked(isElectricUtilityServiceable);

function fccResult(overrides: Record<string, unknown> = {}) {
  return {
    status: "not_configured",
    providers: [],
    normalizedBrandNames: new Set<string>(),
    blockGeoid: null,
    reason: "fcc_bdc_disabled",
    source: {
      name: "FCC National Broadband Map (BDC)",
      url: "https://broadbandmap.fcc.gov/",
      selfReported: true,
    },
    ...overrides,
  } as Awaited<ReturnType<typeof lookupFccIsps>>;
}

function electricResult(overrides: Record<string, unknown> = {}) {
  return {
    status: "not_configured",
    utilities: [],
    normalizedNames: new Set<string>(),
    reason: "electric_lookup_disabled",
    source: {
      name: "OpenEI U.S. Utility Rate Database (URDB)",
      url: "https://openei.org/wiki/Utility_Rate_Database",
      modeled: true,
    },
    ...overrides,
  } as Awaited<ReturnType<typeof lookupElectricUtilities>>;
}

describe("provider serviceability source gaps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupFccIspsMock.mockResolvedValue(fccResult());
    isIspServiceableMock.mockReturnValue(false);
    lookupElectricUtilitiesMock.mockResolvedValue(electricResult());
    isElectricUtilityServiceableMock.mockReturnValue(false);
  });

  it("does not let one FCC catalog match hide other source-backed ISP gaps", async () => {
    lookupFccIspsMock.mockResolvedValue(
      fccResult({
        status: "ok",
        providers: [
          { brandName: "Comcast", providerId: "1", maxDownloadMbps: 1000, maxUploadMbps: 40, technologyCodes: [40] },
          { brandName: "FiberTown", providerId: "2", maxDownloadMbps: 2000, maxUploadMbps: 2000, technologyCodes: [50] },
        ],
        normalizedBrandNames: new Set(["comcast", "fibertown"]),
        reason: null,
      }),
    );
    isIspServiceableMock.mockImplementation((_result, name) => name === "Comcast");

    const providers: ServiceabilityProvider[] = [{ name: "Comcast", category: "UTILITY_INTERNET" }];
    const meta = await enrichProviderServiceability(providers, { latitude: 30, longitude: -97 });

    expect(providers[0]?.fccServiceable).toBe(true);
    expect(meta.sourceGaps).toEqual([
      expect.objectContaining({
        source: "FCC_BDC",
        category: "UTILITY_INTERNET",
        name: "FiberTown",
      }),
    ]);
  });

  it("can query OpenEI for setup-critical electric evidence even before a catalog candidate exists", async () => {
    lookupElectricUtilitiesMock.mockResolvedValue(
      electricResult({
        status: "ok",
        utilities: [{ name: "City of Austin, Texas (Utility Company)", eiaId: "16604" }],
        normalizedNames: new Set(["austintexas"]),
        reason: null,
      }),
    );

    const meta = await enrichProviderServiceability([], {
      latitude: 30.2672,
      longitude: -97.7431,
      forceCategories: ["UTILITY_ELECTRIC"],
    });

    expect(lookupElectricUtilitiesMock).toHaveBeenCalledTimes(1);
    expect(meta.electric).toEqual({ status: "ok", confirmedCount: 0, utilityCount: 1 });
    expect(meta.sourceGaps).toEqual([
      expect.objectContaining({
        source: "OPENEI_URDB",
        category: "UTILITY_ELECTRIC",
        name: "City of Austin, Texas (Utility Company)",
        sourceProviderId: "16604",
      }),
    ]);
  });
});
