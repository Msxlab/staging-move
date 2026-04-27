import { describe, expect, it } from "vitest";
import { getProviderEmptyStateCopy } from "./provider-empty-state";

describe("getProviderEmptyStateCopy", () => {
  it("explains state-level empty provider results without claiming unavailability", () => {
    const copy = getProviderEmptyStateCopy({ state: "NJ" });
    expect(copy.title).toContain("No listed providers");
    expect(copy.description).toContain("NJ");
    expect(copy.description).toContain("does not mean service is unavailable");
  });

  it("mentions local/custom providers for category misses", () => {
    const copy = getProviderEmptyStateCopy({ state: "NJ", hasCategoryFilter: true });
    expect(copy.description).toContain("local/custom provider");
  });

  it("handles search misses separately", () => {
    const copy = getProviderEmptyStateCopy({ search: "dentist" });
    expect(copy.title).toContain("search");
    expect(copy.description).toContain("dentist");
  });
});
