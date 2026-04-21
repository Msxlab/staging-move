import { describe, expect, it } from "vitest";
import { getProviderMatchLevelFromDb, tierProvidersFromDb } from "./provider-matching";

describe("tierProvidersFromDb", () => {
  it("keeps exact matches without dropping broader state/federal providers", () => {
    const result = tierProvidersFromDb(
      [
        {
          id: "exact",
          scope: "STATE",
          coverages: [{ state: "TX", zipPrefix: null, zipExact: "78701" }],
        },
        {
          id: "prefix",
          scope: "STATE",
          coverages: [{ state: "TX", zipPrefix: "787", zipExact: null }],
        },
        {
          id: "state",
          scope: "STATE",
          coverages: [{ state: "TX", zipPrefix: null, zipExact: null }],
        },
        {
          id: "federal",
          scope: "FEDERAL",
          coverages: [],
        },
      ],
      { state: "TX", zip: "78701" }
    );

    expect(result.zipMatchLevel).toBe("exact");
    expect(result.providers.map((provider) => provider.id)).toEqual(["exact", "prefix", "state", "federal"]);
  });

  it("falls back to prefix then state order when exact is unavailable", () => {
    const result = tierProvidersFromDb(
      [
        {
          id: "prefix",
          scope: "STATE",
          coverages: [{ state: "TX", zipPrefix: "787", zipExact: null }],
        },
        {
          id: "state",
          scope: "STATE",
          coverages: [{ state: "TX", zipPrefix: null, zipExact: null }],
        },
      ],
      { state: "TX", zip: "78759" }
    );

    expect(result.zipMatchLevel).toBe("prefix");
    expect(result.providers.map((provider) => provider.id)).toEqual(["prefix", "state"]);
  });

  it("keeps polygon providers when the address coordinates land inside their service envelope", () => {
    const result = tierProvidersFromDb(
      [
        {
          id: "polygon",
          slug: "wmata",
          scope: "STATE",
          coverageModel: "polygon" as const,
          coverages: [{ state: "DC", zipPrefix: null, zipExact: null }],
        },
        {
          id: "state",
          scope: "STATE",
          coverages: [{ state: "DC", zipPrefix: null, zipExact: null }],
        },
      ],
      { state: "DC", zip: "20001", latitude: 38.9072, longitude: -77.0369 }
    );

    expect(result.zipMatchLevel).toBe("polygon");
    expect(result.providers.map((provider) => provider.id)).toEqual(["polygon", "state"]);
  });

  it("drops polygon providers when the address sits outside their service envelope", () => {
    const result = tierProvidersFromDb(
      [
        {
          id: "polygon",
          slug: "wmata",
          scope: "STATE",
          coverageModel: "polygon" as const,
          coverages: [{ state: "MD", zipPrefix: null, zipExact: null }],
        },
        {
          id: "state",
          scope: "STATE",
          coverages: [{ state: "MD", zipPrefix: null, zipExact: null }],
        },
      ],
      { state: "MD", zip: "21201", latitude: 39.2904, longitude: -76.6122 }
    );

    expect(result.zipMatchLevel).toBe("state");
    expect(result.providers.map((provider) => provider.id)).toEqual(["state"]);
  });

  it("marks address-qualified providers as live_address when no better local rule exists", () => {
    const provider = {
      id: "fiber",
      scope: "STATE",
      coverageModel: "live_address" as const,
      coverages: [{ state: "TX", zipPrefix: null, zipExact: null }],
    };

    expect(getProviderMatchLevelFromDb(provider, { state: "TX", zip: "78759" })).toBe("live_address");
  });
});
