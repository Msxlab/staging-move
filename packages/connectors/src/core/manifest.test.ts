import { describe, expect, it } from "vitest";
import type { ConnectorManifest } from "./types";
import { isValidManifest, validateManifest } from "./manifest";

function makeManifest(overrides: Partial<ConnectorManifest> = {}): ConnectorManifest {
  return {
    key: "usps",
    version: "1.0.0",
    displayName: "USPS Mail Forwarding",
    auth: { type: "API_KEY" },
    allowedHosts: ["secure.shippingapis.com"],
    requiredFields: [],
    capabilities: {
      addressValidate: true,
      addressUpdatePush: false,
      readBackVerify: false,
      asyncConfirm: false,
      household: true,
      business: true,
    },
    ...overrides,
  };
}

describe("validateManifest", () => {
  it("accepts a well-formed manifest", () => {
    expect(validateManifest(makeManifest())).toEqual([]);
    expect(isValidManifest(makeManifest())).toBe(true);
  });

  it("rejects a non-kebab-case key", () => {
    expect(validateManifest(makeManifest({ key: "USPS" })).join()).toMatch(/kebab-case/);
  });

  it("rejects a non-semver version", () => {
    expect(validateManifest(makeManifest({ version: "v1" })).join()).toMatch(/semver/);
  });

  it("rejects an empty allowlist", () => {
    expect(validateManifest(makeManifest({ allowedHosts: [] })).join()).toMatch(/allowedHosts/);
  });

  it("rejects an allowlist entry that is not a bare host", () => {
    expect(validateManifest(makeManifest({ allowedHosts: ["https://x.com/path"] })).join()).toMatch(
      /bare lowercase host/,
    );
  });

  it("requires scopes for OAUTH connectors", () => {
    const issues = validateManifest(makeManifest({ auth: { type: "OAUTH" } }));
    expect(issues.join()).toMatch(/scope/);
  });

  it("requires a fallback when the connector can push", () => {
    const issues = validateManifest(
      makeManifest({
        capabilities: {
          addressValidate: true,
          addressUpdatePush: true,
          readBackVerify: false,
          asyncConfirm: false,
          household: false,
          business: false,
        },
      }),
    );
    expect(issues.join()).toMatch(/fallbackActionKey/);
  });

  it("accepts a push-capable connector that declares a fallback", () => {
    const issues = validateManifest(
      makeManifest({
        capabilities: {
          addressValidate: true,
          addressUpdatePush: true,
          readBackVerify: true,
          asyncConfirm: false,
          household: false,
          business: false,
        },
        fallbackActionKey: "usps:MAIL_FORWARDING:DEEP_LINK",
      }),
    );
    expect(issues).toEqual([]);
  });
});
