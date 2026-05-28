import { describe, expect, it } from "vitest";
import {
  getCoverageMetadataIntegrityWarnings,
  getProviderCoverageMetadataMap,
} from "@locateflow/db";

describe("coverage metadata integrity", () => {
  it("only flags polygon-model entries that actually ship no polygons", () => {
    const map = getProviderCoverageMetadataMap();
    for (const warning of getCoverageMetadataIntegrityWarnings()) {
      expect(warning.code).toBe("polygon_model_missing_polygons");
      const entry = map.get(warning.slug);
      expect(entry?.coverageModel).toBe("polygon");
      expect(entry?.polygons ?? []).toHaveLength(0);
    }
  });

  it("surfaces the known dc-streetcar gap (polygon model, no envelope yet)", () => {
    const slugs = getCoverageMetadataIntegrityWarnings().map((w) => w.slug);
    expect(slugs).toContain("dc-streetcar");
  });
});
