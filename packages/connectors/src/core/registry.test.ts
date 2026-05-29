import { describe, expect, it } from "vitest";
import type { AddressConnector } from "./connector";
import type { ConnectorManifest } from "./types";
import { createConnectorRegistry } from "./registry";

function makeConnector(key: string, manifestOverrides: Partial<ConnectorManifest> = {}): AddressConnector {
  const manifest: ConnectorManifest = {
    key,
    version: "1.0.0",
    displayName: key,
    auth: { type: "API_KEY" },
    allowedHosts: ["api.test.com"],
    requiredFields: [],
    capabilities: {
      addressValidate: true,
      addressUpdatePush: false,
      readBackVerify: false,
      asyncConfirm: false,
      household: false,
      business: false,
    },
    ...manifestOverrides,
  };
  return {
    manifest,
    buildRequest: () => ({ method: "POST", url: "https://api.test.com/x" }),
    push: async () => ({ outcome: "NEEDS_USER" }),
  };
}

describe("createConnectorRegistry", () => {
  it("indexes connectors by key", () => {
    const registry = createConnectorRegistry([makeConnector("usps"), makeConnector("amazon")]);
    expect(registry.has("usps")).toBe(true);
    expect(registry.get("amazon")?.manifest.key).toBe("amazon");
    expect(registry.list()).toHaveLength(2);
    expect(registry.get("nope")).toBeUndefined();
  });

  it("rejects duplicate keys", () => {
    expect(() => createConnectorRegistry([makeConnector("usps"), makeConnector("usps")])).toThrow(
      /Duplicate connector key/,
    );
  });

  it("rejects an invalid manifest at construction", () => {
    expect(() => createConnectorRegistry([makeConnector("usps", { allowedHosts: [] })])).toThrow(
      /Invalid connector manifest/,
    );
  });
});
