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

  it("does not double-flag address-qualified or polygon coverage as broad state coverage", () => {
    const liveAddressWarnings = getProviderQualityWarnings({
      name: "Metro Water",
      category: "UTILITY_WATER",
      scope: "STATE",
      states: ["CA"],
      coverageModel: "live_address",
      description: "Metro Water provides residential water service in selected communities.",
      website: "https://example.com",
    }).map((warning) => warning.code);

    expect(liveAddressWarnings).toContain("address_check_required");
    expect(liveAddressWarnings).not.toContain("broad_state_coverage");

    const polygonWarnings = getProviderQualityWarnings({
      name: "Metro Tollway",
      category: "TRANSPORTATION_TOLL",
      scope: "STATE",
      states: ["CA"],
      coverageModel: "polygon",
      description: "Metro Tollway operates a mapped regional toll road network.",
      website: "https://example.com",
    }).map((warning) => warning.code);

    expect(polygonWarnings).toContain("polygon_check_required");
    expect(polygonWarnings).not.toContain("broad_state_coverage");
  });

  it("flags a stale record only when last review is older than the freshness window", () => {
    const now = Date.UTC(2026, 0, 1);
    const base = {
      name: "Acme Water",
      category: "UTILITY_WATER",
      scope: "STATE",
      states: ["CA"],
      description: "Acme Water provides residential water service across California.",
      website: "https://acme-water.example.com",
      phone: "+1-555-0100",
      logoUrl: "https://acme-water.example.com/logo.png",
    };

    const stale = getProviderQualityWarnings(
      { ...base, updatedAt: new Date(now - 200 * 24 * 60 * 60 * 1000) },
      now,
    );
    expect(stale.map((w) => w.code)).toContain("stale_record");

    const fresh = getProviderQualityWarnings(
      { ...base, updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000) },
      now,
    );
    expect(fresh.map((w) => w.code)).not.toContain("stale_record");

    // No updatedAt → no freshness claim (don't fabricate staleness).
    expect(getProviderQualityWarnings({ ...base }, now).map((w) => w.code)).not.toContain("stale_record");
  });
});
