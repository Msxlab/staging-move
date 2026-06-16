import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  lookupElectricUtilities,
  isElectricUtilityServiceable,
  normalizeUtilityName,
  utilityNamesMatch,
  significantUtilityTokens,
  clearElectricUtilityCache,
  type ElectricLookupResult,
} from "./electric-utility";

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

/** Configure the runtime-config mock to enable the lookup with the given key. */
function configure(values: Record<string, string | null>) {
  mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => values[key] ?? null);
}

const COORDS = { latitude: 30.27, longitude: -97.74 };

describe("utility name normalization & matching", () => {
  it("normalizes municipal naming variants to the same distinctive core", () => {
    // The fragile case called out in the integration plan: brand name vs
    // municipal legal name must match via token overlap.
    expect(normalizeUtilityName("Austin Energy")).toBe(normalizeUtilityName("City of Austin"));
    expect(utilityNamesMatch("Austin Energy", "City of Austin")).toBe(true);
    expect(normalizeUtilityName(null)).toBe("");
  });

  it("matches when one name's distinctive tokens are a subset of the other's", () => {
    expect(utilityNamesMatch("Duke Energy", "Duke Energy Indiana")).toBe(true);
    expect(utilityNamesMatch("Pacific Gas & Electric", "Pacific Gas and Electric Company")).toBe(true);
  });

  it("matches common utility abbreviations to official source names", () => {
    expect(normalizeUtilityName("ComEd")).toBe(normalizeUtilityName("Commonwealth Edison Co"));
    expect(utilityNamesMatch("ComEd", "Commonwealth Edison Company")).toBe(true);
    expect(utilityNamesMatch("JCP&L", "Jersey Central Power & Lt Co")).toBe(true);
    expect(utilityNamesMatch("PSE&G", "Public Service Electric and Gas")).toBe(true);
    expect(utilityNamesMatch("FPL", "Florida Power & Light Company")).toBe(true);
  });

  it("is conservative: different brands never match", () => {
    expect(utilityNamesMatch("Georgia Power", "Florida Power & Light")).toBe(false);
    expect(utilityNamesMatch("Austin Energy", "Reliant Energy")).toBe(false);
    expect(utilityNamesMatch("Duke Energy", "Dominion Energy")).toBe(false);
  });

  it("refuses to match names made up purely of generic utility words", () => {
    // "Public Service Co" carries zero brand identity — flagging it against
    // any other generic name would claim the wrong monopoly serves the address.
    expect(significantUtilityTokens("Public Service Co").size).toBe(0);
    expect(utilityNamesMatch("Public Service Co", "City Light & Power")).toBe(false);
    expect(utilityNamesMatch("Public Service Co", "Public Service Co")).toBe(false);
  });
});

describe("electric-utility serviceability lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearElectricUtilityCache();
    vi.restoreAllMocks();
  });

  it("returns not_configured when the master flag is off (graceful no-op)", async () => {
    configure({ ELECTRIC_LOOKUP_ENABLED: "false", OPENEI_API_KEY: "demo" });
    const result = await lookupElectricUtilities(COORDS);
    expect(result.status).toBe("not_configured");
    expect(result.utilities).toHaveLength(0);
  });

  it("returns not_configured when the API key is missing", async () => {
    configure({ ELECTRIC_LOOKUP_ENABLED: "true", OPENEI_API_KEY: null });
    const result = await lookupElectricUtilities(COORDS);
    expect(result.status).toBe("not_configured");
  });

  it("returns no_location when enabled but no coordinates given", async () => {
    configure({ ELECTRIC_LOOKUP_ENABLED: "true", OPENEI_API_KEY: "demo" });
    const result = await lookupElectricUtilities({ latitude: null, longitude: null });
    expect(result.status).toBe("no_location");
  });

  it("parses URDB items into distinct utilities when configured", async () => {
    configure({ ELECTRIC_LOOKUP_ENABLED: "true", OPENEI_API_KEY: "demo" });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        items: [
          // Multiple rate filings per utility must collapse to one company.
          { utility: "City of Austin, Texas (Utility Company)", eiaid: 16604, name: "Residential E-1" },
          { utility: "City of Austin, Texas (Utility Company)", eiaid: 16604, name: "Residential E-2 TOU" },
          { utility: "Pedernales Electric Cooperative, Inc", eiaid: 14776, name: "Residential" },
          // Rows without a utility name are tolerated and dropped.
          { eiaid: 99999, name: "Orphan rate" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupElectricUtilities(COORDS);
    expect(result.status).toBe("ok");
    expect(result.utilities.map((u) => u.name).sort()).toEqual([
      "City of Austin, Texas (Utility Company)",
      "Pedernales Electric Cooperative, Inc",
    ]);
    expect(result.utilities.find((u) => u.eiaId === "16604")).toBeTruthy();

    // The request itself is keyed + scoped the documented URDB v7 way.
    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("https://api.openei.org/utility_rates");
    expect(requestedUrl).toContain("version=7");
    expect(requestedUrl).toContain("api_key=demo");
    expect(requestedUrl).toContain("sector=Residential");

    // Catalog brand "Austin Energy" must match the municipal URDB name.
    expect(isElectricUtilityServiceable(result, "Austin Energy")).toBe(true);
    expect(isElectricUtilityServiceable(result, "Pedernales Electric Cooperative")).toBe(true);
    expect(isElectricUtilityServiceable(result, "Reliant Energy")).toBe(false);
    expect(isElectricUtilityServiceable(result, null)).toBe(false);
  });

  it("serves repeat lookups for the same coordinates from the process-local cache", async () => {
    configure({ ELECTRIC_LOOKUP_ENABLED: "true", OPENEI_API_KEY: "demo" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [{ utility: "Austin Energy", eiaid: 16604 }] }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await lookupElectricUtilities(COORDS);
    const second = await lookupElectricUtilities(COORDS);
    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("degrades to error (not throw) on network failure and does not cache it", async () => {
    configure({ ELECTRIC_LOOKUP_ENABLED: "true", OPENEI_API_KEY: "demo" });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(jsonResponse({ items: [{ utility: "Austin Energy", eiaid: 16604 }] }));
    vi.stubGlobal("fetch", fetchMock);

    const errored = await lookupElectricUtilities(COORDS);
    expect(errored.status).toBe("error");
    expect(errored.utilities).toHaveLength(0);
    // isElectricUtilityServiceable must be safe to call on a degraded result.
    expect(isElectricUtilityServiceable(errored, "Austin Energy")).toBe(false);

    // The error was NOT cached — the next call retries and succeeds.
    const recovered = await lookupElectricUtilities(COORDS);
    expect(recovered.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("degrades to error on an unexpected response shape", async () => {
    configure({ ELECTRIC_LOOKUP_ENABLED: "true", OPENEI_API_KEY: "demo" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ unexpected: true })));

    const result = await lookupElectricUtilities(COORDS);
    expect(result.status).toBe("error");
    expect(result.reason).toBe("unexpected_response_shape");
  });

  it("degrades to error on a non-2xx HTTP status", async () => {
    configure({ ELECTRIC_LOOKUP_ENABLED: "true", OPENEI_API_KEY: "demo" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ error: "rate limit" }, 429)));

    const result = await lookupElectricUtilities(COORDS);
    expect(result.status).toBe("error");
  });

  it("never reports serviceable for a non-ok result", () => {
    const degradedResult: ElectricLookupResult = {
      status: "not_configured",
      utilities: [],
      normalizedNames: new Set<string>(["austin"]),
      reason: "electric_lookup_disabled",
      source: {
        name: "OpenEI U.S. Utility Rate Database (URDB)",
        url: "https://openei.org/wiki/Utility_Rate_Database",
        modeled: true,
      },
    };
    expect(isElectricUtilityServiceable(degradedResult, "Austin Energy")).toBe(false);
  });
});
