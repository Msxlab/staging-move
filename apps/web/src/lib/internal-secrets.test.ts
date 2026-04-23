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

  it("does not accept CRON_SECRET for internal webhooks", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect(getInternalCallerSecret("internal")).toBeUndefined();
    expect(verifyInternalAuth("Bearer cron-secret", "internal")).toBe(false);
  });

  it("accepts INTERNAL_WEBHOOK_SECRET for internal webhooks", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("INTERNAL_WEBHOOK_SECRET", "internal-secret");
    expect(getInternalCallerSecret("internal")).toBe("internal-secret");
    expect(verifyInternalAuth("Bearer internal-secret", "internal")).toBe(true);
  });

  it("keeps CRON_SECRET scoped to cron calls", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect(getInternalCallerSecret("cron")).toBe("cron-secret");
    expect(verifyInternalAuth("Bearer cron-secret", "cron")).toBe(true);
  });
});
