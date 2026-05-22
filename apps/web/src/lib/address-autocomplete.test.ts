import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PlacesProviderConfigError,
  lookupAddressAutocomplete,
  searchAddressAutocomplete,
} from "./address-autocomplete";

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

describe("address autocomplete Google Places integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRuntimeConfigValue.mockResolvedValue("AIzaServerPlacesKey");
  });

  it("uses Places API (New) autocomplete and maps predictions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      suggestions: [
        {
          placePrediction: {
            placeId: "abc123",
            text: { text: "123 Main St, Austin, TX, USA" },
            structuredFormat: {
              mainText: { text: "123 Main St" },
              secondaryText: { text: "Austin, TX, USA" },
            },
          },
        },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchAddressAutocomplete({
      query: "123 Main",
      sessionToken: "session_1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:autocomplete",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "AIzaServerPlacesKey",
        }),
      }),
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      input: "123 Main",
      includedRegionCodes: ["us"],
      sessionToken: "session_1",
    });
    expect(result.predictions).toEqual([
      {
        placeId: "abc123",
        description: "123 Main St, Austin, TX, USA",
        primaryText: "123 Main St",
        secondaryText: "Austin, TX, USA",
      },
    ]);
  });

  it("uses Places API (New) details and normalizes address components", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      id: "abc123",
      formattedAddress: "123 Main St, Austin, TX 78701, USA",
      addressComponents: [
        { longText: "123", shortText: "123", types: ["street_number"] },
        { longText: "Main Street", shortText: "Main St", types: ["route"] },
        { longText: "Austin", shortText: "Austin", types: ["locality"] },
        { longText: "Texas", shortText: "TX", types: ["administrative_area_level_1"] },
        { longText: "78701", shortText: "78701", types: ["postal_code"] },
        { longText: "United States", shortText: "US", types: ["country"] },
      ],
      location: { latitude: 30.2672, longitude: -97.7431 },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupAddressAutocomplete("places/abc123", "session_1");

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://places.googleapis.com/v1/places/abc123?sessionToken=session_1");
    expect(result.result).toMatchObject({
      placeId: "abc123",
      formattedAddress: "123 Main St, Austin, TX 78701, USA",
      street: "123 Main Street",
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "US",
      latitude: 30.2672,
      longitude: -97.7431,
    });
  });

  it("surfaces rejected Places keys as provider config errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: {
        status: "PERMISSION_DENIED",
        message: "API key not authorized to use Places API.",
      },
    }, 403)));

    await expect(searchAddressAutocomplete({
      query: "123 Main",
      sessionToken: "session_1",
    })).rejects.toBeInstanceOf(PlacesProviderConfigError);
  });
});
