import { describe, expect, it } from "vitest";
import { getProviderMatchLevelFromDb, tierProvidersFromDb } from "./provider-matching";

/**
 * Integration-style coverage of the full tier cascade:
 *   exact -> prefix -> polygon -> state -> live_address
 *
 * These complement the unit tests in provider-matching.test.ts by exercising
 * multiple tiers together and covering edge cases that the API routes rely on.
 *
 * Note: tierProvidersFromDb trusts that the DB query has already filtered by
 * state/scope — it classifies providers by tier precision but doesn't re-filter.
 */

describe("full coverage tier cascade", () => {
  it("promotes the highest-precision match when all tiers are available", () => {
    const result = tierProvidersFromDb(
      [
        { id: "federal", scope: "FEDERAL", coverages: [] },
        {
          id: "state-only",
          scope: "STATE",
          coverages: [{ state: "CA", zipPrefix: null, zipExact: null }],
        },
        {
          id: "prefix-941",
          scope: "STATE",
          coverages: [{ state: "CA", zipPrefix: "941", zipExact: null }],
        },
        {
          id: "exact-94103",
          scope: "STATE",
          coverages: [{ state: "CA", zipPrefix: null, zipExact: "94103" }],
        },
      ],
      { state: "CA", zip: "94103" }
    );

    expect(result.zipMatchLevel).toBe("exact");
    expect(result.providers.map((p) => p.id).sort()).toEqual(
      ["exact-94103", "federal", "prefix-941", "state-only"].sort()
    );
  });

  it("emits prefix-level result when exact is missing but prefix matches", () => {
    const result = tierProvidersFromDb(
      [
        {
          id: "prefix-941",
          scope: "STATE",
          coverages: [{ state: "CA", zipPrefix: "941", zipExact: null }],
        },
        {
          id: "state-only",
          scope: "STATE",
          coverages: [{ state: "CA", zipPrefix: null, zipExact: null }],
        },
      ],
      { state: "CA", zip: "94103" }
    );

    expect(result.zipMatchLevel).toBe("prefix");
    expect(result.providers.map((p) => p.id).sort()).toEqual(["prefix-941", "state-only"].sort());
  });

  it("resolves effective state from ZIP when state is not explicitly provided", () => {
    const result = tierProvidersFromDb(
      [
        { id: "federal", scope: "FEDERAL", coverages: [] },
        {
          id: "ca-provider",
          scope: "STATE",
          coverages: [{ state: "CA", zipPrefix: null, zipExact: null }],
        },
      ],
      { zip: "94103" }
    );

    expect(result.effectiveState).toBe("CA");
  });

  it("classifies a live_address provider as live_address when no stronger rule exists", () => {
    const provider = {
      id: "isp",
      scope: "STATE",
      coverageModel: "live_address" as const,
      coverages: [{ state: "TX", zipPrefix: null, zipExact: null }],
    };

    const matchLevel = getProviderMatchLevelFromDb(provider, { state: "TX", zip: "78759" });
    expect(matchLevel).toBe("live_address");

    const tiered = tierProvidersFromDb([provider], { state: "TX", zip: "78759" });
    expect(tiered.providers.map((p) => p.id)).toEqual(["isp"]);
  });

  it("matches prefix correctly when ZIP actually starts with the prefix", () => {
    const matchLevel = getProviderMatchLevelFromDb(
      {
        id: "p-prefix-941",
        scope: "STATE",
        coverages: [{ state: "CA", zipPrefix: "941", zipExact: null }],
      },
      { state: "CA", zip: "94122" }
    );

    expect(matchLevel).toBe("prefix");
  });

  it("does not claim prefix match when the ZIP does not start with the prefix", () => {
    const matchLevel = getProviderMatchLevelFromDb(
      {
        id: "p-prefix-940",
        scope: "STATE",
        coverages: [{ state: "CA", zipPrefix: "940", zipExact: null }],
      },
      { state: "CA", zip: "94122" } // 941 prefix, not 940
    );

    expect(matchLevel).toBe("state");
  });

  it("returns state-level match when no ZIP and no coords are provided", () => {
    const result = tierProvidersFromDb(
      [
        {
          id: "state-provider",
          scope: "STATE",
          coverages: [{ state: "FL", zipPrefix: null, zipExact: null }],
        },
      ],
      { state: "FL" }
    );

    expect(result.zipMatchLevel).toBe("state");
    expect(result.providers.map((p) => p.id)).toEqual(["state-provider"]);
  });

  it("handles an empty provider list gracefully", () => {
    const result = tierProvidersFromDb([], { state: "CA", zip: "94103" });

    expect(result.providers).toEqual([]);
    expect(result.effectiveState).toBe("CA");
  });
});

describe("polygon coverage edge cases", () => {
  it("keeps a polygon provider when coordinates are inside the service envelope", () => {
    const result = tierProvidersFromDb(
      [
        {
          id: "polygon",
          slug: "wmata",
          scope: "STATE",
          coverageModel: "polygon" as const,
          coverages: [{ state: "DC", zipPrefix: null, zipExact: null }],
        },
      ],
      { state: "DC", zip: "20001", latitude: 38.9072, longitude: -77.0369 }
    );

    expect(result.providers.map((p) => p.id)).toContain("polygon");
  });

  it("drops a polygon provider when coordinates are outside the service envelope", () => {
    const result = tierProvidersFromDb(
      [
        {
          id: "polygon",
          slug: "wmata",
          scope: "STATE",
          coverageModel: "polygon" as const,
          coverages: [{ state: "MD", zipPrefix: null, zipExact: null }],
        },
      ],
      { state: "MD", zip: "21201", latitude: 39.2904, longitude: -76.6122 }
    );

    expect(result.providers.map((p) => p.id)).not.toContain("polygon");
  });
});

describe("recommendation ranking boundaries", () => {
  it("strips non-digit characters from ZIP input before matching", () => {
    const result = tierProvidersFromDb(
      [
        {
          id: "exact",
          scope: "STATE",
          coverages: [{ state: "TX", zipPrefix: null, zipExact: "78701" }],
        },
      ],
      { state: "TX", zip: "78 701" }
    );

    expect(result.zipMatchLevel).toBe("exact");
  });

  it("treats undefined coverage model as state-level match for non-ZIP providers", () => {
    const matchLevel = getProviderMatchLevelFromDb(
      {
        id: "p-ny",
        scope: "STATE",
        coverages: [{ state: "NY", zipPrefix: null, zipExact: null }],
      },
      { state: "NY", zip: "10001" }
    );

    expect(matchLevel).toBe("state");
  });
});
