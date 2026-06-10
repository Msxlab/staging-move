import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAirQualityCache, lookupAirQuality, pickWorstObservation } from "./airnow";

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

/** Configure the runtime-config mock with the given AirNow key (null = unset). */
function configure(apiKey: string | null) {
  mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
    key === "AIRNOW_API_KEY" ? apiKey : null,
  );
}

function observation(parameter: string, aqi: number, category = "Moderate") {
  return {
    ParameterName: parameter,
    AQI: aqi,
    Category: { Number: 2, Name: category },
    ReportingArea: "Austin",
  };
}

const COORDS = { latitude: 30.2672, longitude: -97.7431 };

describe("airnow current AQI lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearAirQualityCache();
  });

  it("returns not_configured without fetching when AIRNOW_API_KEY is unset", async () => {
    configure(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupAirQuality(COORDS);

    expect(result.status).toBe("not_configured");
    expect(result.aqi).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not_configured when the runtime-config read itself rejects", async () => {
    mocks.getRuntimeConfigValue.mockRejectedValue(new Error("db down"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupAirQuality(COORDS)).status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns no_location without fetching when coordinates are missing", async () => {
    configure("test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupAirQuality({ latitude: null, longitude: null })).status).toBe("no_location");
    expect((await lookupAirQuality({ latitude: Number.NaN, longitude: -97 })).status).toBe("no_location");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the AirNow observation endpoint with coordinates, distance, and the key", async () => {
    configure("test-key");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([observation("O3", 41, "Good")]));
    vi.stubGlobal("fetch", fetchMock);

    await lookupAirQuality(COORDS);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://www.airnowapi.org/aq/observation/latLong/current/");
    expect(url.searchParams.get("format")).toBe("application/json");
    expect(url.searchParams.get("latitude")).toBe("30.2672");
    expect(url.searchParams.get("longitude")).toBe("-97.7431");
    expect(url.searchParams.get("distance")).toBe("25");
    expect(url.searchParams.get("API_KEY")).toBe("test-key");
  });

  it("reports the worst pollutant's AQI as the headline number (airnow.gov convention)", async () => {
    configure("test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          observation("O3", 41, "Good"),
          observation("PM2.5", 72, "Moderate"),
          observation("PM10", 18, "Good"),
        ]),
      ),
    );

    const result = await lookupAirQuality(COORDS);

    expect(result).toMatchObject({
      status: "ok",
      aqi: 72,
      category: "Moderate",
      parameter: "PM2.5",
      reportingArea: "Austin",
    });
  });

  it("returns ok with nulls when no monitor reports within range (honest empty, not an error)", async () => {
    configure("test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    const result = await lookupAirQuality(COORDS);

    expect(result).toMatchObject({ status: "ok", aqi: null, category: null });
  });

  it("ignores AirNow's negative-AQI missing-data sentinels", async () => {
    configure("test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([observation("O3", -999), observation("PM2.5", 55)])),
    );

    const result = await lookupAirQuality(COORDS);

    expect(result.aqi).toBe(55);
    expect(result.parameter).toBe("PM2.5");
  });

  it("degrades to error (not throw) on network failure, non-2xx, and non-array payloads", async () => {
    configure("test-key");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect((await lookupAirQuality(COORDS)).status).toBe("error");

    clearAirQualityCache();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    expect((await lookupAirQuality(COORDS)).status).toBe("error");

    clearAirQualityCache();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ WebServiceError: "bad key" })));
    expect((await lookupAirQuality(COORDS)).status).toBe("error");
  });

  it("never leaks the API key into the degraded reason", async () => {
    configure("super-secret-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));

    const result = await lookupAirQuality(COORDS);

    expect(result.status).toBe("error");
    expect(result.reason || "").not.toContain("super-secret-key");
  });

  it("caches ok results per coordinate for the TTL (no second fetch) but never caches errors", async () => {
    configure("test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([observation("PM2.5", 72)]))
      .mockResolvedValue(jsonResponse([observation("PM2.5", 10)]));
    vi.stubGlobal("fetch", fetchMock);

    expect((await lookupAirQuality(COORDS)).aqi).toBe(72);
    expect((await lookupAirQuality(COORDS)).aqi).toBe(72); // served from cache
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearAirQualityCache();
    const failingFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(jsonResponse([observation("PM2.5", 30)]));
    vi.stubGlobal("fetch", failingFetch);
    expect((await lookupAirQuality(COORDS)).status).toBe("error");
    expect((await lookupAirQuality(COORDS)).status).toBe("ok");
    expect(failingFetch).toHaveBeenCalledTimes(2);
  });

  describe("pickWorstObservation", () => {
    it("returns null when every row is invalid", () => {
      expect(
        pickWorstObservation([
          { ParameterName: "O3", AQI: -1 },
          { ParameterName: "PM2.5", AQI: null },
          { ParameterName: "PM10" },
        ]),
      ).toBeNull();
    });
  });
});
