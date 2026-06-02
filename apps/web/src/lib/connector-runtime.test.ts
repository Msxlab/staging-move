import { describe, expect, it, vi, beforeEach } from "vitest";

const rcMock = vi.hoisted(() => ({ getRuntimeConfigValue: vi.fn() }));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: rcMock.getRuntimeConfigValue }));

import { connectorRegistry } from "./connector-registry";
import { toCanonicalAddress, isApiSyncConnector } from "./connector-runtime";

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

describe("isApiSyncConnector — server push only with a real agreement + credentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("false for usps with no production agreement (the default)", async () => {
    rcMock.getRuntimeConfigValue.mockResolvedValue(null);
    expect(await isApiSyncConnector("usps", { enabled: true, stage: "GA" })).toBe(false);
  });

  it("true for usps with a PRODUCTION agreement + credentials", async () => {
    rcMock.getRuntimeConfigValue.mockImplementation((k: string) => {
      if (k.endsWith("_AGREEMENT_STATUS")) return Promise.resolve("PRODUCTION");
      if (k.endsWith("_OAUTH_CLIENT_ID") || k.endsWith("_OAUTH_CLIENT_SECRET")) return Promise.resolve("x");
      return Promise.resolve(null);
    });
    expect(await isApiSyncConnector("usps", { enabled: true, stage: "GA" })).toBe(true);
  });

  it("false with an agreement but missing credentials", async () => {
    rcMock.getRuntimeConfigValue.mockImplementation((k: string) =>
      k.endsWith("_AGREEMENT_STATUS") ? Promise.resolve("PRODUCTION") : Promise.resolve(null),
    );
    expect(await isApiSyncConnector("usps", { enabled: true, stage: "GA" })).toBe(false);
  });

  it("false for an unregistered connector", async () => {
    rcMock.getRuntimeConfigValue.mockResolvedValue("PRODUCTION");
    expect(await isApiSyncConnector("nope", { enabled: true, stage: "GA" })).toBe(false);
  });
});
