import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ScoredProvider } from "@/lib/recommendation-engine";
import {
  CATEGORY_RECOMMENDED_LIMIT,
  getCategoryRecommendedProviders,
  resolvePreselectedCategoryKey,
} from "./category-preselect";

function provider(
  over: Partial<ScoredProvider> & { id: string; category: string },
): ScoredProvider {
  return {
    name: over.id,
    scope: "STATE",
    states: ["NJ"],
    tags: [],
    popularityScore: 0,
    recommendationScore: 0,
    urgencyTier: "RECOMMENDED",
    matchReasons: [],
    explanation: {} as ScoredProvider["explanation"],
    geoDistanceBucket: 0,
    ...over,
  } as ScoredProvider;
}

describe("resolvePreselectedCategoryKey", () => {
  it("returns null for missing/blank params", () => {
    expect(resolvePreselectedCategoryKey(null)).toBeNull();
    expect(resolvePreselectedCategoryKey(undefined)).toBeNull();
    expect(resolvePreselectedCategoryKey("")).toBeNull();
    expect(resolvePreselectedCategoryKey("   ")).toBeNull();
  });

  it("passes catalog keys through (case-insensitively)", () => {
    expect(resolvePreselectedCategoryKey("UTILITY_INTERNET")).toBe("UTILITY_INTERNET");
    expect(resolvePreselectedCategoryKey("utility_internet")).toBe("UTILITY_INTERNET");
  });

  it("maps FINANCIAL_* subcategories to their mid-level display buckets", () => {
    expect(resolvePreselectedCategoryKey("FINANCIAL_BANK")).toBe("FINANCIAL_BANKING");
    expect(resolvePreselectedCategoryKey("FINANCIAL_INSURANCE_RENTERS")).toBe("FINANCIAL_INSURANCE");
    expect(resolvePreselectedCategoryKey("FINANCIAL_CREDIT_CARD")).toBe("FINANCIAL_CARDS");
    expect(resolvePreselectedCategoryKey("FINANCIAL_INSURANCE_HEALTH")).toBe("FINANCIAL_HEALTH");
  });

  it("passes unknown values through unchanged (page degrades to an empty filter, never crashes)", () => {
    expect(resolvePreselectedCategoryKey("NOT_A_CATEGORY")).toBe("NOT_A_CATEGORY");
  });
});

describe("getCategoryRecommendedProviders", () => {
  const availableAtAddress = provider({
    id: "isp-confirmed",
    category: "UTILITY_INTERNET",
    recommendationScore: 90,
    matchReasons: ["Available at your address"],
  });
  const recommendedIsp = provider({
    id: "isp-recommended",
    category: "UTILITY_INTERNET",
    recommendationScore: 60,
    matchReasons: ["Listed in NJ"],
  });
  const unscoredIsp = provider({ id: "isp-unscored", category: "UTILITY_INTERNET" });
  const electric = provider({
    id: "electric-1",
    category: "UTILITY_ELECTRIC",
    recommendationScore: 80,
    matchReasons: ["Needed this phase"],
  });

  it("filters to the requested category only", () => {
    const out = getCategoryRecommendedProviders(
      [availableAtAddress, electric, recommendedIsp],
      "UTILITY_INTERNET",
    );
    expect(out.map((p) => p.id)).toEqual(["isp-confirmed", "isp-recommended"]);
  });

  it("keeps the engine's existing sort — 'Available at your address' stays first", () => {
    const out = getCategoryRecommendedProviders(
      [availableAtAddress, recommendedIsp, unscoredIsp],
      "UTILITY_INTERNET",
    );
    expect(out[0].id).toBe("isp-confirmed");
    expect(out[0].matchReasons[0]).toBe("Available at your address");
  });

  it("lifts recommendable providers above unscored directory entries (stable partition)", () => {
    const out = getCategoryRecommendedProviders(
      [unscoredIsp, availableAtAddress, recommendedIsp],
      "UTILITY_INTERNET",
    );
    expect(out.map((p) => p.id)).toEqual(["isp-confirmed", "isp-recommended", "isp-unscored"]);
  });

  it("matches by merged display category (financial subcategories group into their bucket)", () => {
    const bank = provider({ id: "bank", category: "FINANCIAL_BANK", matchReasons: ["x"] });
    const fintech = provider({ id: "fintech", category: "FINANCIAL_FINTECH" });
    const renters = provider({ id: "renters", category: "FINANCIAL_INSURANCE_RENTERS" });
    // Banking bucket holds bank + fintech; insurance is now its own bucket.
    const banking = getCategoryRecommendedProviders([bank, fintech, renters, electric], "FINANCIAL_BANKING");
    expect(banking.map((p) => p.id)).toEqual(["bank", "fintech"]);
    const insurance = getCategoryRecommendedProviders([bank, renters, electric], "FINANCIAL_INSURANCE");
    expect(insurance.map((p) => p.id)).toEqual(["renters"]);
  });

  it("caps the panel at the limit", () => {
    const many = Array.from({ length: 10 }, (_v, i) =>
      provider({ id: `isp-${i}`, category: "UTILITY_INTERNET", matchReasons: ["m"] }),
    );
    expect(getCategoryRecommendedProviders(many, "UTILITY_INTERNET")).toHaveLength(
      CATEGORY_RECOMMENDED_LIMIT,
    );
    expect(getCategoryRecommendedProviders(many, "UTILITY_INTERNET", 2)).toHaveLength(2);
  });

  it("returns [] for a null key, an unknown category, or a non-positive limit", () => {
    expect(getCategoryRecommendedProviders([availableAtAddress], null)).toEqual([]);
    expect(getCategoryRecommendedProviders([availableAtAddress], "NOT_A_CATEGORY")).toEqual([]);
    expect(getCategoryRecommendedProviders([availableAtAddress], "UTILITY_INTERNET", 0)).toEqual([]);
  });
});

// ── Wiring regressions (home-dossier.test.tsx pattern) ─────────
// The page is effect/fetch driven, so these pin the load-bearing wiring in the
// source: the ?category= param is honored on the FIRST render (state
// initializers, not a late effect) and the show-all escape hatch exists.
describe("services/new category-preselect wiring", () => {
  function readWebSource(relativePath: string) {
    const cwd = process.cwd();
    const webRoot = cwd.endsWith(`${path.sep}apps${path.sep}web`) ? cwd : path.join(cwd, "apps", "web");
    return readFileSync(path.join(webRoot, relativePath), "utf8");
  }
  const pageSource = () => readWebSource("src/app/(app)/services/new/page.tsx");

  it("honors the category param on first render via state initializers", () => {
    const source = pageSource();
    expect(source).toContain("resolvePreselectedCategoryKey(prefillCategory)");
    expect(source).toContain("useState<string | null>(preselectedCategoryKey)");
    expect(source).toContain("new Set(preselectedCategoryKey ? [preselectedCategoryKey] : [])");
  });

  it("renders the category-scoped recommended panel from the shared helper", () => {
    const source = pageSource();
    expect(source).toContain("getCategoryRecommendedProviders(allProviders, activeCategory)");
    expect(source).toContain('ts("categoryPreselect_recommendedTitle"');
  });

  it("offers the show-all-categories escape hatch that clears the filter", () => {
    const source = pageSource();
    expect(source).toContain('ts("categoryPreselect_showAll")');
    expect(source).toContain("setActiveCategory(null)");
  });

  it("keeps en/es catalog keys for the preselect strings in parity", () => {
    const en = JSON.parse(readWebSource("src/i18n/messages/en.json"));
    const es = JSON.parse(readWebSource("src/i18n/messages/es.json"));
    const keys = (cat: Record<string, Record<string, unknown>>) =>
      Object.keys(cat.services).filter((k) => k.startsWith("categoryPreselect_"));
    expect(keys(en).sort()).toEqual(keys(es).sort());
    expect(keys(en).length).toBeGreaterThan(0);
  });
});
