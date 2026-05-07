import { describe, expect, it } from "vitest";
import {
  getProviderCoverageConfidence,
  getProviderQualityWarnings,
  getProviderTrustSummary,
  sanitizeProviderSeedRecords,
} from "../provider-integrity";

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

describe("provider trust helpers", () => {
  it("labels provider records as listed and manual-only", () => {
    const summary = getProviderTrustSummary({
      name: "Example Internet",
      category: "UTILITY_INTERNET",
      scope: "FEDERAL",
      website: "https://example.com",
      description: "Internet provider",
    });

    expect(summary.statusLabel).toBe("Listed provider");
    expect(summary.manualTrackingLabel).toBe("Manual tracking only");
    expect(summary.verificationLabel).toBe("Unverified directory data");
    expect(summary.qualityWarnings.map((warning) => warning.code)).toContain(
      "broad_national_coverage",
    );
  });

  it("surfaces state and address-level coverage caveats", () => {
    expect(
      getProviderCoverageConfidence({
        name: "Metro Water",
        category: "UTILITY_WATER",
        scope: "STATE",
        coverageMatchLevel: "state",
      }).label,
    ).toBe("State-level listing");

    expect(
      getProviderCoverageConfidence({
        name: "Fiber Co",
        category: "UTILITY_INTERNET",
        scope: "FEDERAL",
        coverageModel: "live_address",
      }).label,
    ).toBe("Address check required");
  });

  it("flags common data quality warnings without claiming verification", () => {
    const warnings = getProviderQualityWarnings({
      name: "Best Provider",
      category: "UTILITY_WATER",
      scope: "STATE",
      states: ["CA"],
      description: "Best provider",
      website: "https://example.com",
      duplicateDomainCount: 2,
    });

    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "missing_logo",
        "missing_phone",
        "generic_description",
        "marketing_description",
        "duplicate_domain",
        "broad_state_coverage",
      ]),
    );
  });
});
