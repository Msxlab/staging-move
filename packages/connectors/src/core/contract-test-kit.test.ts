import { describe, expect, it } from "vitest";
import type { AddressConnector } from "./connector";
import type { CanonicalAddressChange, ConnectorCapabilities, ConnectorManifest } from "./types";
import { assertConnectorContract, checkConnectorContract } from "./contract-test-kit";
import { uspsConnector } from "../usps";

const sample: CanonicalAddressChange = {
  eventId: "e1",
  from: { street1: "1 Old St", city: "Austin", state: "TX", zip: "78701", country: "US" },
  to: { street1: "2 New St", city: "Boston", state: "MA", zip: "02101", country: "US" },
  fullName: "Jane Doe",
  fields: {},
};

function makeConnector(overrides: {
  caps?: Partial<ConnectorCapabilities>;
  allowedHosts?: readonly string[];
  requiresOrigin?: boolean;
  fallbackActionKey?: string;
  buildRequest?: AddressConnector["buildRequest"];
  verify?: AddressConnector["verify"];
  parseWebhook?: AddressConnector["parseWebhook"];
}): AddressConnector {
  const manifest: ConnectorManifest = {
    key: "mock",
    version: "1.0.0",
    displayName: "Mock",
    auth: { type: "API_KEY" },
    allowedHosts: overrides.allowedHosts ?? ["api.mock.test"],
    requiredFields: [],
    capabilities: {
      addressValidate: false,
      addressUpdatePush: true,
      readBackVerify: false,
      asyncConfirm: false,
      household: false,
      business: false,
      ...(overrides.caps ?? {}),
    },
    requiresOrigin: overrides.requiresOrigin,
    fallbackActionKey: "fallbackActionKey" in overrides ? overrides.fallbackActionKey : "mock:FALLBACK",
  };
  return {
    manifest,
    buildRequest: overrides.buildRequest ?? (() => ({ method: "POST", url: "https://api.mock.test/x", body: {} })),
    push: async () => ({ outcome: "SUBMITTED" }),
    verify: overrides.verify,
    parseWebhook: overrides.parseWebhook,
  };
}

describe("checkConnectorContract", () => {
  it("passes a well-formed push connector", () => {
    expect(checkConnectorContract(makeConnector({}), { sampleInput: sample })).toEqual([]);
  });

  it("flags readBackVerify declared without a verify() method", () => {
    const issues = checkConnectorContract(makeConnector({ caps: { readBackVerify: true } }), { sampleInput: sample });
    expect(issues.some((i) => i.includes("verify() is not implemented"))).toBe(true);
  });

  it("flags asyncConfirm declared without a parseWebhook() method", () => {
    const issues = checkConnectorContract(makeConnector({ caps: { asyncConfirm: true } }), { sampleInput: sample });
    expect(issues.some((i) => i.includes("parseWebhook() is not implemented"))).toBe(true);
  });

  it("flags buildRequest targeting a host outside the egress allowlist", () => {
    const c = makeConnector({ buildRequest: () => ({ method: "POST", url: "https://evil.example.com/x", body: {} }) });
    const issues = checkConnectorContract(c, { sampleInput: sample });
    expect(issues.some((i) => i.includes("egress allowlist"))).toBe(true);
  });

  it("flags a non-deterministic buildRequest", () => {
    let n = 0;
    const c = makeConnector({ buildRequest: () => ({ method: "POST", url: `https://api.mock.test/${n++}`, body: {} }) });
    const issues = checkConnectorContract(c, { sampleInput: sample });
    expect(issues.some((i) => i.includes("not deterministic"))).toBe(true);
  });

  it("flags a push-capable connector with no fallbackActionKey", () => {
    const issues = checkConnectorContract(makeConnector({ fallbackActionKey: undefined }), { sampleInput: sample });
    expect(issues.some((i) => i.includes("fallbackActionKey"))).toBe(true);
  });

  it("flags a parseWebhook that accepts an unrecognized payload", () => {
    const c = makeConnector({
      caps: { asyncConfirm: true },
      parseWebhook: () => ({ ref: "x", result: { outcome: "CONFIRMED" } }),
    });
    const issues = checkConnectorContract(c, { sampleInput: sample });
    expect(issues.some((i) => i.includes("must return null"))).toBe(true);
  });

  it("requires an origin in the sample for a requiresOrigin connector", () => {
    const issues = checkConnectorContract(makeConnector({ requiresOrigin: true }), {
      sampleInput: { ...sample, from: null },
    });
    expect(issues.some((i) => i.includes("requiresOrigin"))).toBe(true);
  });
});

describe("the real USPS connector honors the contract (dogfood)", () => {
  it("passes checkConnectorContract with no issues", () => {
    expect(checkConnectorContract(uspsConnector, { sampleInput: sample })).toEqual([]);
  });

  it("assertConnectorContract throws for a broken connector but not for USPS", () => {
    const broken = makeConnector({ buildRequest: () => ({ method: "POST", url: "https://evil.example.com/x", body: {} }) });
    expect(() => assertConnectorContract(broken, { sampleInput: sample })).toThrow(/fails the contract/);
    expect(() => assertConnectorContract(uspsConnector, { sampleInput: sample })).not.toThrow();
  });
});
