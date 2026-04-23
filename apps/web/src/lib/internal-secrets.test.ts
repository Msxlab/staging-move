import { afterEach, describe, expect, it, vi } from "vitest";
import { getInternalCallerSecret, verifyInternalAuth } from "./internal-secrets";

describe("web internal secrets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not accept CRON_SECRET for impersonation", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect(getInternalCallerSecret("impersonation")).toBeUndefined();
    expect(verifyInternalAuth("Bearer cron-secret", "impersonation")).toBe(false);
  });

  it("accepts IMPERSONATION_HANDOFF_SECRET for impersonation", () => {
    vi.stubEnv("IMPERSONATION_HANDOFF_SECRET", "handoff-secret");
    expect(getInternalCallerSecret("impersonation")).toBe("handoff-secret");
    expect(verifyInternalAuth("Bearer handoff-secret", "impersonation")).toBe(true);
  });
});
