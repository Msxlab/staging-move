import { describe, expect, it } from "vitest";
import { STATE_PROVIDER_COMPLETENESS_CATALOG } from "../../../db/prisma/seed-data/state-provider-catalog";
import { STATE_PROVIDERS } from "../../../db/prisma/seed-data/provider-seed";

const ALL_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
] as const;

describe("state provider completeness catalog", () => {
  it("covers every state with at least one official-source catalog entry", () => {
    const coveredStates = new Set(
      STATE_PROVIDER_COMPLETENESS_CATALOG.flatMap((entry) => entry.states)
    );

    expect([...coveredStates].sort()).toEqual([...ALL_STATES].sort());
  });

  it("surfaces every seed-ready catalog record in the merged provider seed", () => {
    const seedReadyEntries = STATE_PROVIDER_COMPLETENESS_CATALOG.filter(
      (entry) => entry.seedRecord
    );
    const mergedSlugs = new Set(STATE_PROVIDERS.map((provider) => provider.slug));

    expect(seedReadyEntries.length).toBeGreaterThan(0);
    for (const entry of seedReadyEntries) {
      expect(mergedSlugs.has(entry.seedRecord!.slug)).toBe(true);
    }
  });
});
