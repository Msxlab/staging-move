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

  it("uses deployment env before DB for non-Stripe secrets too (RESEND_API_KEY)", async () => {
    process.env.RESEND_API_KEY = "re_env_value";
    mocks.findUnique.mockResolvedValue({
      key: "RESEND_API_KEY",
      isSecret: true,
      valueEncrypted: "re_db_value",
      valuePlain: null,
      isActive: true,
      source: "DB",
    });

    await expect(getRuntimeConfigValue("RESEND_API_KEY")).resolves.toBe("re_env_value");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("uses deployment env before DB for UPSTASH_REDIS_REST_TOKEN", async () => {
    process.env.UPSTASH_REDIS_REST_TOKEN = "AAA-from-env";
    mocks.findUnique.mockResolvedValue({
      key: "UPSTASH_REDIS_REST_TOKEN",
      isSecret: true,
      valueEncrypted: "BBB-from-db",
      valuePlain: null,
      isActive: true,
      source: "DB",
    });

    await expect(getRuntimeConfigValue("UPSTASH_REDIS_REST_TOKEN")).resolves.toBe("AAA-from-env");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to DB when deployment env is unset for runtime-tunable keys", async () => {
    delete process.env.ALERT_EMAIL_TO;
    mocks.findUnique.mockResolvedValue({
      key: "ALERT_EMAIL_TO",
      isSecret: false,
      valueEncrypted: null,
      valuePlain: "ops@example.com",
      isActive: true,
      source: "DB",
    });

    await expect(getRuntimeConfigValue("ALERT_EMAIL_TO")).resolves.toBe("ops@example.com");
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
  });

  it("does not use DB fallback for deployment-only secrets", async () => {
    delete process.env.USER_JWT_SECRET;
    mocks.findUnique.mockResolvedValue({
      key: "USER_JWT_SECRET",
      isSecret: true,
      valueEncrypted: "db-secret-should-not-be-used",
      valuePlain: null,
      isActive: true,
      source: "DB",
    });

    await expect(getRuntimeConfigValue("USER_JWT_SECRET")).resolves.toBeNull();
  });

  it("returns null when both deployment env and DB are missing", async () => {
    delete process.env.RESEND_API_KEY;
    mocks.findUnique.mockResolvedValue(null);

    await expect(getRuntimeConfigValue("RESEND_API_KEY")).resolves.toBeNull();
  });
});
