import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    runtimeConfigEntry: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: (value: string) => value,
}));

import { getRuntimeConfigValue } from "./runtime-config";

describe("runtime config env precedence", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED;
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("uses deployment env before DB runtime config for Stripe secrets by default", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_env";
    mocks.findUnique.mockResolvedValue({
      key: "STRIPE_SECRET_KEY",
      isSecret: true,
      valueEncrypted: "sk_test_db",
      valuePlain: null,
      isActive: true,
      source: "DB",
    });

    await expect(getRuntimeConfigValue("STRIPE_SECRET_KEY")).resolves.toBe("sk_test_env");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("allows an intentional DB override only when the override flag is enabled", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_env";
    process.env.STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED = "true";
    mocks.findUnique.mockResolvedValue({
      key: "STRIPE_SECRET_KEY",
      isSecret: true,
      valueEncrypted: "sk_test_db",
      valuePlain: null,
      isActive: true,
      source: "DB",
    });

    await expect(getRuntimeConfigValue("STRIPE_SECRET_KEY")).resolves.toBe("sk_test_db");
  });
});
