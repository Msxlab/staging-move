import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearEvChargingCache,
  lookupEvCharging,
  parseEvChargingPayload,
} from "./nlr-alt-fuel-stations";

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

const COORDS = { latitude: 30.2672, longitude: -97.7431 };

describe("NLR EV charging lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearEvChargingCache();
  });

  it("returns disabled without fetching when the feature flag is off", async () => {
    configure({ NLR_ALT_FUEL_STATIONS_ENABLED: "false", NLR_API_KEY: "key" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupEvCharging(COORDS);

    expect(result.status).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not_configured without fetching when the API key is missing", async () => {
    configure({ NLR_ALT_FUEL_STATIONS_ENABLED: "true", NLR_API_KEY: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupEvCharging(COORDS);

    expect(result.status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns no_location without fetching when coordinates are missing", async () => {
    configure({ NLR_ALT_FUEL_STATIONS_ENABLED: "true", NLR_API_KEY: "key" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupEvCharging({ latitude: null, longitude: -97 })).status).toBe("no_location");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries NLR nearest stations for public active EV stations near the point", async () => {
    configure({ NLR_ALT_FUEL_STATIONS_ENABLED: "true", NLR_API_KEY: "test-key" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ total_results: 0, fuel_stations: [] })));

    await lookupEvCharging(COORDS);

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://developer.nlr.gov/api/alt-fuel-stations/v1/nearest.json");
    expect(url.searchParams.get("api_key")).toBe("test-key");
    expect(url.searchParams.get("latitude")).toBe("30.2672");
    expect(url.searchParams.get("longitude")).toBe("-97.7431");
    expect(url.searchParams.get("radius")).toBe("10");
    expect(url.searchParams.get("fuel_type")).toBe("ELEC");
    expect(url.searchParams.get("access")).toBe("public");
    expect(url.searchParams.get("status")).toBe("E");
  });

  it("summarizes station counts, nearest distance, ports, and connector support", () => {
    const parsed = parseEvChargingPayload({
      total_results: 2,
      fuel_stations: [
        {
          id: 2,
          station_name: "Far Level 2",
          distance: "4.2",
          ev_network: "ChargePoint Network",
          ev_connector_types: ["J1772"],
          ev_level2_evse_num: "6",
        },
        {
          id: 1,
          station_name: "Near Fast",
          distance: 1.24,
          ev_network: "Electrify America",
          ev_connector_types: ["J1772COMBO", "TESLA"],
          ev_dc_fast_num: 4,
          ev_level2_evse_num: 2,
        },
      ],
    });

    expect(parsed).toMatchObject({
      totalResults: 2,
      stationCount: 2,
      nearestDistanceMiles: 1.24,
      dcFastPortCount: 4,
      level2PortCount: 8,
      teslaCompatibleCount: 1,
      ccsCompatibleCount: 1,
    });
    expect(parsed?.stations[0]).toMatchObject({ name: "Near Fast", distanceMiles: 1.24 });
  });

  it("degrades to error and never leaks the API key in the reason", async () => {
    configure({ NLR_ALT_FUEL_STATIONS_ENABLED: "true", NLR_API_KEY: "super-secret-key" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));

    const result = await lookupEvCharging(COORDS);

    expect(result.status).toBe("error");
    expect(result.reason || "").not.toContain("super-secret-key");
  });
});
