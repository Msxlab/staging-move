import { describe, expect, it } from "vitest";
import { isUnlimited } from "./service-usage-indicator";

describe("isUnlimited", () => {
  it("treats the UNLIMITED sentinel (MAX_SAFE_INTEGER) as unlimited", () => {
    // The entitlement layer uses Number.MAX_SAFE_INTEGER for an unlimited cap.
    // Rendering it raw would show "9007199254740991" to a full-access free user.
    expect(isUnlimited(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it("treats non-finite limits as unlimited", () => {
    expect(isUnlimited(Infinity)).toBe(true);
    expect(isUnlimited(Number.POSITIVE_INFINITY)).toBe(true);
  });

  it("treats ordinary finite caps as bounded (flag-OFF parity)", () => {
    // Real paid plans use small finite caps — these must still render the
    // "X / limit" usage UI exactly as before.
    expect(isUnlimited(10)).toBe(false);
    expect(isUnlimited(25)).toBe(false);
    expect(isUnlimited(0)).toBe(false);
    expect(isUnlimited(100)).toBe(false);
  });

  it("is false for null/undefined limits", () => {
    expect(isUnlimited(null)).toBe(false);
    expect(isUnlimited(undefined)).toBe(false);
  });
});
