import { afterEach, describe, expect, it, vi } from "vitest";
import { getInternalCallerSecret, verifyInternalAuth } from "./internal-secrets";

describe("admin internal secrets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not fall back to CRON_SECRET for impersonation", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect(getInternalCallerSecret("impersonation")).toBeUndefined();
    expect(verifyInternalAuth("Bearer cron-secret", "impersonation")).toBe(false);
  });

  it("uses IMPERSONATION_HANDOFF_SECRET for impersonation", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("IMPERSONATION_HANDOFF_SECRET", "handoff-secret");
    expect(getInternalCallerSecret("impersonation")).toBe("handoff-secret");
    expect(verifyInternalAuth("Bearer handoff-secret", "impersonation")).toBe(true);
  });

  it("keeps legacy CRON_SECRET compatibility for internal calls", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect(getInternalCallerSecret("internal")).toBe("cron-secret");
    expect(verifyInternalAuth("Bearer cron-secret", "internal")).toBe(true);
  });
});
