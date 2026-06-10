import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearWeatherCache, lookupMoveDayForecast } from "./nws-weather";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const COORDS = { latitude: 29.9511, longitude: -90.0715 };
const TARGET_DATE = "2026-06-12";
const FORECAST_URL = "https://api.weather.gov/gridpoints/LIX/68,88/forecast";

function pointsPayload(forecast: unknown = FORECAST_URL) {
  return { properties: { forecast } };
}

function forecastPayload(periods: unknown[]) {
  return { properties: { periods } };
}

const DAY_PERIOD = {
  startTime: "2026-06-12T06:00:00-05:00",
  isDaytime: true,
  temperature: 91,
  temperatureUnit: "F",
  shortForecast: "Partly Sunny then Slight Chance Showers",
  probabilityOfPrecipitation: { value: 40 },
};
const NIGHT_PERIOD = {
  startTime: "2026-06-12T18:00:00-05:00",
  isDaytime: false,
  temperature: 76,
  temperatureUnit: "F",
  shortForecast: "Mostly Cloudy",
  probabilityOfPrecipitation: { value: 30 },
};

describe("nws-weather move-day forecast lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearWeatherCache();
  });

  it("returns no_location without fetching when coordinates are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(
      (await lookupMoveDayForecast({ latitude: null, longitude: null, targetDate: TARGET_DATE })).status,
    ).toBe("no_location");
    expect(
      (await lookupMoveDayForecast({ latitude: Number.NaN, longitude: -90, targetDate: TARGET_DATE })).status,
    ).toBe("no_location");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed target date without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await lookupMoveDayForecast({ ...COORDS, targetDate: "June 12 2026" });
    expect(result.status).toBe("error");
    expect(result.reason).toBe("invalid_target_date");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the required NWS User-Agent on both requests and rounds coordinates to 4 decimals", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pointsPayload()))
      .mockResolvedValueOnce(jsonResponse(forecastPayload([DAY_PERIOD, NIGHT_PERIOD])));
    vi.stubGlobal("fetch", fetchMock);

    await lookupMoveDayForecast({ latitude: 29.95112345, longitude: -90.07154321, targetDate: TARGET_DATE });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.weather.gov/points/29.9511,-90.0715");
    expect(String(fetchMock.mock.calls[1][0])).toBe(FORECAST_URL);
    for (const call of fetchMock.mock.calls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers["User-Agent"]).toBe("LocateFlow (support@locateflow.com)");
    }
  });

  it("shapes the target date's day + night periods into the forecast result", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(pointsPayload()))
        .mockResolvedValueOnce(
          jsonResponse(
            forecastPayload([
              // A prior day's periods must be skipped, not matched.
              { ...DAY_PERIOD, startTime: "2026-06-11T06:00:00-05:00", shortForecast: "Sunny", temperature: 88 },
              DAY_PERIOD,
              NIGHT_PERIOD,
            ]),
          ),
        ),
    );

    const result = await lookupMoveDayForecast({ ...COORDS, targetDate: TARGET_DATE });
    expect(result).toMatchObject({
      status: "ok",
      forecastDate: TARGET_DATE,
      summary: "Partly Sunny then Slight Chance Showers",
      tempHighF: 91,
      tempLowF: 76,
      precipChancePct: 40,
    });
  });

  it("returns too_far when the target date is beyond the returned forecast periods", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(pointsPayload()))
        .mockResolvedValueOnce(jsonResponse(forecastPayload([DAY_PERIOD, NIGHT_PERIOD]))),
    );
    const result = await lookupMoveDayForecast({ ...COORDS, targetDate: "2026-06-25" });
    expect(result.status).toBe("too_far");
    expect(result.summary).toBeNull();
    expect(result.tempHighF).toBeNull();
  });

  it("falls back to the night period when the day half has rolled off", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(pointsPayload()))
        .mockResolvedValueOnce(jsonResponse(forecastPayload([NIGHT_PERIOD]))),
    );
    const result = await lookupMoveDayForecast({ ...COORDS, targetDate: TARGET_DATE });
    expect(result).toMatchObject({
      status: "ok",
      summary: "Mostly Cloudy",
      tempHighF: null,
      tempLowF: 76,
      precipChancePct: 30,
    });
  });

  it("tolerates a missing probabilityOfPrecipitation and converts Celsius temperatures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(pointsPayload()))
        .mockResolvedValueOnce(
          jsonResponse(
            forecastPayload([
              {
                ...DAY_PERIOD,
                temperature: 33,
                temperatureUnit: "C",
                probabilityOfPrecipitation: { value: null },
              },
            ]),
          ),
        ),
    );
    const result = await lookupMoveDayForecast({ ...COORDS, targetDate: TARGET_DATE });
    expect(result).toMatchObject({ status: "ok", tempHighF: 91, precipChancePct: null });
  });

  it("refuses to follow a forecast URL that is not on weather.gov", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pointsPayload("https://evil.example.com/forecast")));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupMoveDayForecast({ ...COORDS, targetDate: TARGET_DATE });
    expect(result.status).toBe("error");
    expect(result.reason).toBe("no_forecast_url");
    expect(fetchMock).toHaveBeenCalledTimes(1); // never fetched the foreign URL
  });

  it("degrades to error (not throw) when the points call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await lookupMoveDayForecast({ ...COORDS, targetDate: TARGET_DATE });
    expect(result.status).toBe("error");
  });

  it("degrades to error on a non-2xx forecast response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(pointsPayload()))
        .mockResolvedValueOnce(jsonResponse({}, 503)),
    );
    expect((await lookupMoveDayForecast({ ...COORDS, targetDate: TARGET_DATE })).status).toBe("error");
  });

  it("caches ok results per location+date (no extra fetches) but never caches errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pointsPayload()))
      .mockResolvedValueOnce(jsonResponse(forecastPayload([DAY_PERIOD, NIGHT_PERIOD])));
    vi.stubGlobal("fetch", fetchMock);

    const first = await lookupMoveDayForecast({ ...COORDS, targetDate: TARGET_DATE });
    const second = await lookupMoveDayForecast({ ...COORDS, targetDate: TARGET_DATE });
    expect(first.status).toBe("ok");
    expect(second).toEqual(first); // served from cache
    expect(fetchMock).toHaveBeenCalledTimes(2); // points + forecast, once each

    // Errors are not cached: a failing lookup retries on the next call.
    clearWeatherCache();
    const failingFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(jsonResponse(pointsPayload()))
      .mockResolvedValueOnce(jsonResponse(forecastPayload([DAY_PERIOD, NIGHT_PERIOD])));
    vi.stubGlobal("fetch", failingFetch);
    expect((await lookupMoveDayForecast({ ...COORDS, targetDate: TARGET_DATE })).status).toBe("error");
    expect((await lookupMoveDayForecast({ ...COORDS, targetDate: TARGET_DATE })).status).toBe("ok");
    expect(failingFetch).toHaveBeenCalledTimes(3);
  });
});
