import { describe, expect, it } from "vitest";
import {
  DATA_QUALITY_BASE,
  computeOnboardingDataQuality,
  type OnboardingDataQualityState,
} from "./onboarding-data-quality";

const EMPTY: OnboardingDataQualityState = {
  hasName: false,
  hasAgeRange: false,
  householdSignals: 0,
  hasAddress: false,
  providersKept: 0,
  hasDestinationState: false,
  hasMoveDate: false,
};

const FULL: OnboardingDataQualityState = {
  hasName: true,
  hasAgeRange: true,
  householdSignals: 4,
  hasAddress: true,
  providersKept: 6,
  hasDestinationState: true,
  hasMoveDate: true,
};

describe("computeOnboardingDataQuality", () => {
  it("scores an empty state at exactly the base", () => {
    expect(computeOnboardingDataQuality(EMPTY)).toBe(DATA_QUALITY_BASE);
  });

  it("scores a fully-answered state at exactly 100", () => {
    expect(computeOnboardingDataQuality(FULL)).toBe(100);
  });

  it("awards the documented per-signal deltas", () => {
    expect(computeOnboardingDataQuality({ ...EMPTY, hasName: true })).toBe(DATA_QUALITY_BASE + 8);
    expect(computeOnboardingDataQuality({ ...EMPTY, hasAgeRange: true })).toBe(DATA_QUALITY_BASE + 4);
    expect(computeOnboardingDataQuality({ ...EMPTY, hasAddress: true })).toBe(DATA_QUALITY_BASE + 15);
    expect(computeOnboardingDataQuality({ ...EMPTY, hasDestinationState: true })).toBe(DATA_QUALITY_BASE + 8);
    expect(computeOnboardingDataQuality({ ...EMPTY, hasMoveDate: true })).toBe(DATA_QUALITY_BASE + 4);
  });

  it("grows as the user keeps more providers, saturating at the cap", () => {
    const at = (providersKept: number) => computeOnboardingDataQuality({ ...EMPTY, providersKept });
    expect(at(1)).toBe(DATA_QUALITY_BASE + 3);
    expect(at(2)).toBe(DATA_QUALITY_BASE + 6);
    expect(at(6)).toBe(DATA_QUALITY_BASE + 18);
    // Past the cap: no further growth, but never a decrease.
    expect(at(7)).toBe(at(6));
    expect(at(50)).toBe(at(6));
  });

  it("grows with household signals, saturating at the cap", () => {
    const at = (householdSignals: number) => computeOnboardingDataQuality({ ...EMPTY, householdSignals });
    expect(at(1)).toBe(DATA_QUALITY_BASE + 2);
    expect(at(4)).toBe(DATA_QUALITY_BASE + 8);
    expect(at(10)).toBe(at(4));
  });

  it("is monotonic: adding any signal never lowers the score", () => {
    let previous = computeOnboardingDataQuality(EMPTY);
    const progression: OnboardingDataQualityState[] = [
      { ...EMPTY, hasName: true },
      { ...EMPTY, hasName: true, hasAgeRange: true },
      { ...EMPTY, hasName: true, hasAgeRange: true, householdSignals: 2 },
      { ...EMPTY, hasName: true, hasAgeRange: true, householdSignals: 2, hasAddress: true },
      { ...EMPTY, hasName: true, hasAgeRange: true, householdSignals: 2, hasAddress: true, providersKept: 4 },
      { ...FULL },
    ];
    for (const state of progression) {
      const next = computeOnboardingDataQuality(state);
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });

  it("never exceeds 100 even with absurd counts", () => {
    expect(
      computeOnboardingDataQuality({ ...FULL, providersKept: 9999, householdSignals: 9999 }),
    ).toBe(100);
  });

  it("treats garbage counts as zero instead of corrupting the score", () => {
    expect(computeOnboardingDataQuality({ ...EMPTY, providersKept: Number.NaN })).toBe(DATA_QUALITY_BASE);
    expect(computeOnboardingDataQuality({ ...EMPTY, providersKept: Number.POSITIVE_INFINITY })).toBe(DATA_QUALITY_BASE);
    expect(computeOnboardingDataQuality({ ...EMPTY, householdSignals: -3 })).toBe(DATA_QUALITY_BASE);
  });

  it("floors fractional counts (no partial-credit rounding up)", () => {
    expect(computeOnboardingDataQuality({ ...EMPTY, providersKept: 1.9 })).toBe(DATA_QUALITY_BASE + 3);
  });

  it("always returns an integer within [base, 100]", () => {
    const states: OnboardingDataQualityState[] = [EMPTY, FULL, { ...EMPTY, providersKept: 3, householdSignals: 1 }];
    for (const state of states) {
      const score = computeOnboardingDataQuality(state);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(DATA_QUALITY_BASE);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
