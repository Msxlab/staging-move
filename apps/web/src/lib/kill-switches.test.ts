import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => mocks.getRuntimeConfigValue(...args),
}));

import {
  areSignupsKilled,
  isOutboundEmailKilled,
  SIGNUPS_PAUSED_CODE,
  SIGNUPS_PAUSED_MESSAGE,
} from "./kill-switches";

describe("kill switches (SEC-KILL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRuntimeConfigValue.mockResolvedValue(null);
  });

  it("defaults OFF when the keys are unset", async () => {
    await expect(areSignupsKilled()).resolves.toBe(false);
    await expect(isOutboundEmailKilled()).resolves.toBe(false);
    expect(mocks.getRuntimeConfigValue).toHaveBeenCalledWith("KILL_SIGNUPS");
    expect(mocks.getRuntimeConfigValue).toHaveBeenCalledWith("KILL_OUTBOUND_EMAIL");
  });

  it("turns ON only for the exact value 'true' (trimmed, case-insensitive)", async () => {
    for (const value of ["true", "TRUE", " true ", "True"]) {
      mocks.getRuntimeConfigValue.mockResolvedValue(value);
      await expect(areSignupsKilled()).resolves.toBe(true);
      await expect(isOutboundEmailKilled()).resolves.toBe(true);
    }
  });

  it("stays OFF for every non-'true' value (no surprise lockouts from typos)", async () => {
    for (const value of ["false", "1", "yes", "on", "enabled", ""]) {
      mocks.getRuntimeConfigValue.mockResolvedValue(value);
      await expect(areSignupsKilled()).resolves.toBe(false);
      await expect(isOutboundEmailKilled()).resolves.toBe(false);
    }
  });

  it("fails open (OFF) when the config read rejects — a config outage must not pause the platform", async () => {
    mocks.getRuntimeConfigValue.mockRejectedValue(new Error("db down"));
    await expect(areSignupsKilled()).resolves.toBe(false);
    await expect(isOutboundEmailKilled()).resolves.toBe(false);
  });

  it("exports the shared paused-signups code and polite copy", () => {
    expect(SIGNUPS_PAUSED_CODE).toBe("SIGNUPS_PAUSED");
    expect(SIGNUPS_PAUSED_MESSAGE).toContain("temporarily paused");
  });
});
