import { describe, expect, it } from "vitest";
import { sanitizeProviderSeedRecords } from "../provider-integrity";

describe("sanitizeProviderSeedRecords", () => {
  it("deduplicates same-category providers even when their slugs differ", () => {
    const result = sanitizeProviderSeedRecords([
      {
        name: "T-Mobile Home Internet",
        slug: "t-mobile-home",
        category: "UTILITY_INTERNET",
        website: "https://www.t-mobile.com",
        description: "More complete record",
        phone: "1-800-937-8997",
      },
      {
        name: "T-Mobile Home Internet",
        slug: "tmobile-home-internet",
        category: "UTILITY_INTERNET",
        website: "https://www.t-mobile.com",
      },
    ]);

    expect(result.providers).toHaveLength(1);
    expect(result.deduped).toEqual([
      expect.objectContaining({
        keptName: "T-Mobile Home Internet",
        keptCategory: "UTILITY_INTERNET",
        removedCount: 1,
      }),
    ]);
  });

  it("keeps cross-category providers but renames slug collisions safely", () => {
    const result = sanitizeProviderSeedRecords([
      {
        name: "Progressive",
        slug: "progressive",
        category: "FINANCIAL_INSURANCE_AUTO",
        website: "https://www.progressive.com",
      },
      {
        name: "Progressive Motorcycle",
        slug: "progressive",
        category: "FINANCIAL_INSURANCE_MOTORCYCLE",
        website: "https://www.progressive.com/motorcycle",
      },
    ]);

    expect(result.providers).toHaveLength(2);
    expect(new Set(result.providers.map((provider) => provider.slug)).size).toBe(2);
    expect(result.renamed).toEqual([
      expect.objectContaining({
        category: "FINANCIAL_INSURANCE_MOTORCYCLE",
      }),
    ]);
  });
});
