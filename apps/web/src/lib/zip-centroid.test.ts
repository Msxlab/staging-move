import { describe, it, expect } from "vitest";
import { zipCentroid, zipCentroidCount } from "@locateflow/db";

describe("zipCentroid (Census ZCTA gazetteer, #3b)", () => {
  it("resolves a known ZIP to its centroid", () => {
    const austin = zipCentroid("78701");
    expect(austin).not.toBeNull();
    // Downtown Austin, TX ≈ 30.27, -97.74 — generous bounds, not an exact pin.
    expect(austin!.latitude).toBeGreaterThan(30);
    expect(austin!.latitude).toBeLessThan(31);
    expect(austin!.longitude).toBeGreaterThan(-98);
    expect(austin!.longitude).toBeLessThan(-97);
  });

  it("accepts ZIP+4 (uses the leading 5)", () => {
    expect(zipCentroid("78701-1234")).toEqual(zipCentroid("78701"));
  });

  it("returns null for non-ZCTA / invalid input", () => {
    expect(zipCentroid("")).toBeNull();
    expect(zipCentroid(null)).toBeNull();
    expect(zipCentroid(undefined)).toBeNull();
    expect(zipCentroid("abcde")).toBeNull();
    expect(zipCentroid("123")).toBeNull();
    expect(zipCentroid("00000")).toBeNull(); // not a real ZCTA
  });

  it("loads the full national dataset", () => {
    expect(zipCentroidCount()).toBeGreaterThan(33000);
  });
});
