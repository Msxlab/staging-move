import { describe, it, expect } from "vitest";
import { resolveConnectorMode, type ConnectorModeInput } from "./mode";

// A connector that WOULD be API_SYNC — every condition met. Each test flips one
// fact and asserts the resolver degrades honestly.
const liveApiSync: ConnectorModeInput = {
  addressUpdatePush: true,
  agreementStatus: "PRODUCTION",
  credentialsPresent: true,
  enabled: true,
  stage: "GA",
};

describe("resolveConnectorMode — the system cannot lie", () => {
  it("is API_SYNC only when push-capable + PRODUCTION agreement + creds + live + enabled", () => {
    const r = resolveConnectorMode(liveApiSync);
    expect(r.mode).toBe("API_SYNC");
    expect(r.canApiSync).toBe(true);
  });

  it("allows API_SYNC during ROLLOUT (connector-level capability; per-user gating is separate)", () => {
    expect(resolveConnectorMode({ ...liveApiSync, stage: "ROLLOUT" }).mode).toBe("API_SYNC");
  });

  it("DISABLED when the kill switch is off — overrides everything else", () => {
    const r = resolveConnectorMode({ ...liveApiSync, enabled: false });
    expect(r.mode).toBe("DISABLED");
    expect(r.canApiSync).toBe(false);
  });

  it("DISABLED when retired", () => {
    expect(resolveConnectorMode({ ...liveApiSync, stage: "RETIRED" }).mode).toBe("DISABLED");
  });

  it("COMING_SOON while in shadow testing", () => {
    expect(resolveConnectorMode({ ...liveApiSync, stage: "SHADOW" }).mode).toBe("COMING_SOON");
  });

  it("GUIDED_UPDATE when the connector cannot push server-side", () => {
    const r = resolveConnectorMode({ ...liveApiSync, addressUpdatePush: false });
    expect(r.mode).toBe("GUIDED_UPDATE");
    expect(r.canApiSync).toBe(false);
  });

  it("GUIDED_UPDATE without a PRODUCTION agreement (the legal gate)", () => {
    expect(resolveConnectorMode({ ...liveApiSync, agreementStatus: "NONE" }).mode).toBe("GUIDED_UPDATE");
    // SANDBOX is for testing, not real users → still guided.
    expect(resolveConnectorMode({ ...liveApiSync, agreementStatus: "SANDBOX" }).mode).toBe("GUIDED_UPDATE");
  });

  it("GUIDED_UPDATE when credentials are not configured", () => {
    expect(resolveConnectorMode({ ...liveApiSync, credentialsPresent: false }).mode).toBe("GUIDED_UPDATE");
  });

  it("kill switch beats a would-be API_SYNC (precedence)", () => {
    // Every API_SYNC condition is met EXCEPT enabled → DISABLED, never API_SYNC.
    const r = resolveConnectorMode({ ...liveApiSync, enabled: false });
    expect(r.mode).not.toBe("API_SYNC");
    expect(r.mode).toBe("DISABLED");
  });

  it("models USPS-without-agreement honestly: live + push-capable but agreement NONE → GUIDED_UPDATE", () => {
    // The exact case the team cares about: USPS code is push-capable, but with no
    // signed authorized-agent agreement it must NOT advertise/perform auto-submit.
    const usps = resolveConnectorMode({
      addressUpdatePush: true,
      agreementStatus: "NONE",
      credentialsPresent: false,
      enabled: true,
      stage: "GA",
    });
    expect(usps.mode).toBe("GUIDED_UPDATE");
    expect(usps.canApiSync).toBe(false);
  });
});
