import { describe, expect, it } from "vitest";
import {
  OB_COACH_COLLAPSED_PREFIX,
  coachCopyKeys,
  coachStorageKey,
  parseCoachCollapsed,
  serializeCoachCollapsed,
  COACH_STEP_SLUGS,
} from "./ob-coach-state";

describe("coachStorageKey", () => {
  it("scopes the key per user id", () => {
    expect(coachStorageKey("user_123")).toBe(`${OB_COACH_COLLAPSED_PREFIX}.user_123`);
  });

  it("falls back to the bare prefix for anonymous / missing ids", () => {
    expect(coachStorageKey(null)).toBe(OB_COACH_COLLAPSED_PREFIX);
    expect(coachStorageKey(undefined)).toBe(OB_COACH_COLLAPSED_PREFIX);
    expect(coachStorageKey("")).toBe(OB_COACH_COLLAPSED_PREFIX);
    expect(coachStorageKey("   ")).toBe(OB_COACH_COLLAPSED_PREFIX);
  });

  it("produces distinct keys for distinct users", () => {
    expect(coachStorageKey("a")).not.toBe(coachStorageKey("b"));
  });
});

describe("parse / serialize round trip", () => {
  it("round-trips both states", () => {
    expect(parseCoachCollapsed(serializeCoachCollapsed(true))).toBe(true);
    expect(parseCoachCollapsed(serializeCoachCollapsed(false))).toBe(false);
  });

  it("defaults to OPEN (not collapsed) for null / garbage values", () => {
    expect(parseCoachCollapsed(null)).toBe(false);
    expect(parseCoachCollapsed(undefined)).toBe(false);
    expect(parseCoachCollapsed("")).toBe(false);
    expect(parseCoachCollapsed("true")).toBe(false);
    expect(parseCoachCollapsed("{}")).toBe(false);
  });
});

describe("coachCopyKeys", () => {
  it("maps each onboarding step to namespaced eyebrow + body keys", () => {
    COACH_STEP_SLUGS.forEach((slug, index) => {
      expect(coachCopyKeys(index)).toEqual({
        eyebrowKey: `onboarding.coach_eyebrow_${slug}`,
        bodyKey: `onboarding.coach_body_${slug}`,
      });
    });
  });

  it("returns null for out-of-range or non-integer steps", () => {
    expect(coachCopyKeys(-1)).toBeNull();
    expect(coachCopyKeys(COACH_STEP_SLUGS.length)).toBeNull();
    expect(coachCopyKeys(1.5)).toBeNull();
    expect(coachCopyKeys(Number.NaN)).toBeNull();
  });
});
