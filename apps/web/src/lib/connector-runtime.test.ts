import { describe, expect, it } from "vitest";
import { connectorRegistry, toCanonicalAddress } from "./connector-runtime";

describe("toCanonicalAddress", () => {
  it("maps DB address fields and normalizes USA → US", () => {
    expect(
      toCanonicalAddress({ street: "1 New St", street2: null, city: "Boston", state: "MA", zip: "02101", country: "USA" }),
    ).toEqual({ street1: "1 New St", street2: null, city: "Boston", state: "MA", zip: "02101", country: "US" });
  });

  it("passes through a non-USA country and keeps street2", () => {
    const out = toCanonicalAddress({ street: "x", street2: "Apt 4", city: "Toronto", state: "ON", zip: "M5V", country: "CA" });
    expect(out.country).toBe("CA");
    expect(out.street2).toBe("Apt 4");
  });
});

describe("connectorRegistry", () => {
  it("registers the USPS connector", () => {
    expect(connectorRegistry.has("usps")).toBe(true);
    expect(connectorRegistry.get("usps")?.manifest.fallbackActionKey).toBeTruthy();
  });
});
