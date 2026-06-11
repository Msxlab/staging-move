import { describe, expect, it } from "vitest";
import {
  hasProShowcaseContext,
  selectProShowcaseFeatures,
  type ProShowcaseContext,
} from "./ob-pro-showcase";

const base: ProShowcaseContext = {
  fromState: "TX",
  toState: "CO",
  hasChildren: false,
  hasPets: false,
};

describe("selectProShowcaseFeatures", () => {
  it("always surfaces the move-universal Pro rows", () => {
    const ids = selectProShowcaseFeatures(base).map((f) => f.id);
    expect(ids).toContain("movers");
    expect(ids).toContain("neighborhood");
    expect(ids).toContain("dossier");
    expect(ids).toContain("ai");
  });

  it("omits schools when the household has no children", () => {
    const ids = selectProShowcaseFeatures({ ...base, hasChildren: false }).map((f) => f.id);
    expect(ids).not.toContain("schools");
  });

  it("includes schools only when children are present", () => {
    const ids = selectProShowcaseFeatures({ ...base, hasChildren: true }).map((f) => f.id);
    expect(ids).toContain("schools");
  });

  it("is deterministic and respects the cap", () => {
    const ids = selectProShowcaseFeatures({ ...base, hasChildren: true }, 4).map((f) => f.id);
    expect(ids).toHaveLength(4);
    // Fixed priority order: movers, neighborhood, schools, then dossier/ai.
    expect(ids).toEqual(["movers", "neighborhood", "schools", "dossier"]);
  });

  it("never returns an empty list even with an absurd cap", () => {
    expect(selectProShowcaseFeatures(base, 0).length).toBeGreaterThan(0);
  });
});

describe("hasProShowcaseContext", () => {
  it("requires a destination state to be concrete", () => {
    expect(hasProShowcaseContext({ ...base, toState: "CO" })).toBe(true);
    expect(hasProShowcaseContext({ ...base, toState: "" })).toBe(false);
    expect(hasProShowcaseContext({ ...base, toState: "   " })).toBe(false);
    expect(hasProShowcaseContext({ ...base, toState: null })).toBe(false);
  });
});
