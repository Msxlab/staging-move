import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCensusGeocoderCache,
  geocodeAddress,
  geocodeFallbackForPersist,
  normalizeAddressKey,
} from "./census-geocoder";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A well-formed Census geocoder payload with a single match at (lat, lng). */
function censusMatch(latitude: number, longitude: number) {
  return {
    result: {
      addressMatches: [
        {
          matchedAddress: "123 MAIN ST, SPRINGFIELD, VA, 22150",
          coordinates: { x: longitude, y: latitude },
        },
      ],
    },
  };
}

const FIELDS = { street: "123 Main St", city: "Springfield", state: "VA", zip: "22150" };

describe("census-geocoder", () => {
  beforeEach(() => {
    clearCensusGeocoderCache();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("normalizeAddressKey", () => {
    it("normalizes case, whitespace, and missing zip", () => {
      expect(
        normalizeAddressKey({ street: "  123  Main St ", city: "SPRINGFIELD", state: "va" }),
      ).toBe("123 main st|springfield|va|");
      expect(normalizeAddressKey(FIELDS)).toBe(
        normalizeAddressKey({ street: "123 MAIN st", city: " springfield", state: "VA", zip: "22150 " }),
      );
    });
  });

  describe("geocodeAddress", () => {
    it("returns ok with latitude/longitude on a successful match", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(censusMatch(38.78, -77.18)));
      vi.stubGlobal("fetch", fetchMock);

      const result = await geocodeAddress(FIELDS);
      expect(result).toEqual({ status: "ok", latitude: 38.78, longitude: -77.18 });

      // Calls the documented key-less Census endpoint with the oneline address.
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain("geocoding.geo.census.gov/geocoder/locations/onelineaddress");
      expect(url).toContain("benchmark=Public_AR_Current");
      expect(url).toContain(encodeURIComponent("123 Main St, Springfield, VA, 22150"));
    });

    it("returns no_match when the Census finds no candidates", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ result: { addressMatches: [] } })),
      );
      expect(await geocodeAddress(FIELDS)).toEqual({ status: "no_match" });
    });

    it("returns error (never throws) on network failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
      expect(await geocodeAddress(FIELDS)).toEqual({ status: "error" });
    });

    it("returns error on non-2xx responses and unexpected payload shapes", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ oops: true }, 500)));
      expect(await geocodeAddress(FIELDS)).toEqual({ status: "error" });

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ totally: "unexpected" })));
      expect(await geocodeAddress(FIELDS)).toEqual({ status: "no_match" });
    });

    it("aborts and returns error when the request exceeds the 2.5s cap", async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const promise = geocodeAddress(FIELDS);
      await vi.advanceTimersByTimeAsync(2600);
      expect(await promise).toEqual({ status: "error" });
    });

    it("skips coordinates that are out of range", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(censusMatch(999, -77.18))));
      expect(await geocodeAddress(FIELDS)).toEqual({ status: "no_match" });
    });

    it("caches ok results by normalized address (one fetch for repeat saves)", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(censusMatch(38.78, -77.18)));
      vi.stubGlobal("fetch", fetchMock);

      await geocodeAddress(FIELDS);
      const second = await geocodeAddress({ ...FIELDS, street: "123 MAIN ST  ", city: " springfield" });
      expect(second).toEqual({ status: "ok", latitude: 38.78, longitude: -77.18 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does NOT cache transient errors — a later attempt re-fetches", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("blip"))
        .mockResolvedValueOnce(jsonResponse(censusMatch(38.78, -77.18)));
      vi.stubGlobal("fetch", fetchMock);

      expect(await geocodeAddress(FIELDS)).toEqual({ status: "error" });
      expect(await geocodeAddress(FIELDS)).toEqual({ status: "ok", latitude: 38.78, longitude: -77.18 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("geocodeFallbackForPersist (route persist path)", () => {
    it("returns coordinates to persist when the geocode succeeds", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(censusMatch(38.78, -77.18))));
      const coords = await geocodeFallbackForPersist({ ...FIELDS, latitude: null, longitude: null });
      expect(coords).toEqual({ latitude: 38.78, longitude: -77.18 });
      // Observability marker, warn-level only.
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("[census-geocoder] fallback geocode"),
      );
    });

    it("returns null on no_match — nulls are persisted exactly as before", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ result: { addressMatches: [] } })),
      );
      expect(await geocodeFallbackForPersist({ ...FIELDS, latitude: null, longitude: null })).toBeNull();
    });

    it("returns null on timeout/error — fail-open, never throws", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
      expect(await geocodeFallbackForPersist({ ...FIELDS, latitude: null, longitude: null })).toBeNull();
    });

    it("never overwrites Places/user-provided coordinates (no network call)", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      expect(
        await geocodeFallbackForPersist({ ...FIELDS, latitude: 40.0, longitude: -75.0 }),
      ).toBeNull();
      // Even a single provided coordinate blocks the fallback.
      expect(
        await geocodeFallbackForPersist({ ...FIELDS, latitude: 40.0, longitude: null }),
      ).toBeNull();
      expect(
        await geocodeFallbackForPersist({ ...FIELDS, latitude: null, longitude: -75.0 }),
      ).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("skips silently when street/city/state are incomplete", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      expect(await geocodeFallbackForPersist({ street: "123 Main St", city: "", state: "VA" })).toBeNull();
      expect(await geocodeFallbackForPersist({ street: "  ", city: "Springfield", state: "VA" })).toBeNull();
      expect(await geocodeFallbackForPersist({ street: "123 Main St", city: "Springfield" })).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
