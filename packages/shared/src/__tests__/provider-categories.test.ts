import { describe, expect, it } from "vitest";
import {
  FEDERAL_NEW,
  STATE_PROVIDERS,
} from "../../../db/prisma/seed-data/provider-seed";
import {
  normalizeProviderName,
  normalizeProviderUrlDomain,
} from "../provider-integrity";
import {
  PROVIDER_CATEGORY_VALUES,
  CATEGORY_META,
} from "../recommendation-engine";

const allProviders = [...FEDERAL_NEW, ...STATE_PROVIDERS];

describe("provider category taxonomy", () => {
  it("registers the four new consumer categories in the taxonomy", () => {
    const newCategories = [
      "FINANCIAL_INSURANCE_RENTERS",
      "FINANCIAL_FINTECH",
      "HEALTHCARE_TELEMEDICINE",
      "LOCAL_DINING",
    ] as const;

    for (const category of newCategories) {
      expect(PROVIDER_CATEGORY_VALUES).toContain(category);
      expect(CATEGORY_META[category]).toBeDefined();
      expect(CATEGORY_META[category].label).toBeTruthy();
      expect(CATEGORY_META[category].icon).toBeTruthy();
    }
  });

  it("seeds at least one provider for each new category", () => {
    const expectedMinimumsByCategory: Record<string, number> = {
      FINANCIAL_INSURANCE_RENTERS: 5,
      FINANCIAL_FINTECH: 5,
      HEALTHCARE_TELEMEDICINE: 5,
      LOCAL_DINING: 5,
    };

    for (const [category, minCount] of Object.entries(
      expectedMinimumsByCategory,
    )) {
      const providersInCategory = allProviders.filter(
        (p) => p.category === category,
      );
      expect(
        providersInCategory.length,
        `expected at least ${minCount} providers in ${category}, got ${providersInCategory.length}`,
      ).toBeGreaterThanOrEqual(minCount);
    }
  });

  it("keeps every provider category aligned with the canonical enum", () => {
    const validCategories = new Set<string>(
      PROVIDER_CATEGORY_VALUES as unknown as string[],
    );
    const orphanedCategories = new Set<string>();

    for (const provider of allProviders) {
      if (!validCategories.has(provider.category)) {
        orphanedCategories.add(provider.category);
      }
    }

    expect(
      Array.from(orphanedCategories),
      "found providers using categories that aren't in PROVIDER_CATEGORY_VALUES",
    ).toEqual([]);
  });

  it("maintains unique slugs across the full seed universe", () => {
    const slugCounts = new Map<string, number>();
    for (const provider of allProviders) {
      slugCounts.set(provider.slug, (slugCounts.get(provider.slug) ?? 0) + 1);
    }

    const duplicates = Array.from(slugCounts.entries()).filter(
      ([, count]) => count > 1,
    );
    expect(duplicates, "duplicate provider slugs found").toEqual([]);
  });

  it("keeps state-named regional providers scoped to their actual state", () => {
    const spectrumMaine = allProviders.find((provider) => provider.slug === "spectrum-me");

    expect(spectrumMaine?.states).toEqual(["ME"]);
  });
});
