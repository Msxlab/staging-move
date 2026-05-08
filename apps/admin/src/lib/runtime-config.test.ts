import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn().mockResolvedValue([]),
}));

// Mock @/lib/db so importing runtime-config doesn't require a real
// Prisma client instance.
vi.mock("@/lib/db", () => ({
  prisma: {
    runtimeConfigEntry: mocks,
  },
}));

vi.mock("@/lib/shared-encryption", () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.replace(/^enc:/, ""),
}));

import { listRuntimeConfigCatalog, upsertRuntimeConfigEntry } from "@/lib/runtime-config";

describe("upsertRuntimeConfigEntry value validation", () => {
  const baseInput = { adminId: "admin_1", note: null as string | null };

  it("rejects an unknown key", async () => {
    await expect(
      upsertRuntimeConfigEntry({ ...baseInput, key: "NOT_A_REAL_KEY", value: "x" }),
    ).rejects.toThrow(/UNKNOWN_RUNTIME_CONFIG_KEY/);
  });

  it("rejects an empty value", async () => {
    await expect(
      upsertRuntimeConfigEntry({ ...baseInput, key: "STRIPE_SECRET_KEY", value: "" }),
    ).rejects.toThrow(/EMPTY_RUNTIME_CONFIG_VALUE/);
  });

  it("rejects a Stripe secret without sk_test_/sk_live_ prefix", async () => {
    await expect(
      upsertRuntimeConfigEntry({
        ...baseInput,
        key: "STRIPE_SECRET_KEY",
        value: "rk_live_thisisrestricted",
      }),
    ).rejects.toThrow(/INVALID_RUNTIME_CONFIG_VALUE:stripe_secret_prefix/);
  });

  it("rejects a hex key that is not 64 chars", async () => {
    await expect(
      upsertRuntimeConfigEntry({
        ...baseInput,
        key: "FIELD_ENCRYPTION_KEY",
        value: "abcd1234",
      }),
    ).rejects.toThrow(/INVALID_RUNTIME_CONFIG_VALUE:hex_64_required/);
  });

  it("rejects a private/loopback URL for UPSTASH_REDIS_REST_URL", async () => {
    await expect(
      upsertRuntimeConfigEntry({
        ...baseInput,
        key: "UPSTASH_REDIS_REST_URL",
        value: "https://localhost/",
      }),
    ).rejects.toThrow(/INVALID_RUNTIME_CONFIG_VALUE:internal_or_loopback_host/);
  });

  it("rejects a non-https URL for UPSTASH_REDIS_REST_URL", async () => {
    await expect(
      upsertRuntimeConfigEntry({
        ...baseInput,
        key: "UPSTASH_REDIS_REST_URL",
        value: "http://upstash-public.example.com/",
      }),
    ).rejects.toThrow(/INVALID_RUNTIME_CONFIG_VALUE:requires_https/);
  });

  it("rejects a private-IP literal in a URL", async () => {
    // Shared validator collapses loopback + RFC1918 + link-local into a
    // single `internal_or_loopback_host` reason; both private and
    // loopback addresses are rejected through the same code path.
    await expect(
      upsertRuntimeConfigEntry({
        ...baseInput,
        key: "UPSTASH_REDIS_REST_URL",
        value: "https://10.0.0.1/",
      }),
    ).rejects.toThrow(/INVALID_RUNTIME_CONFIG_VALUE:internal_or_loopback_host/);
  });

  it("rejects a Stripe webhook secret without whsec_ prefix", async () => {
    await expect(
      upsertRuntimeConfigEntry({
        ...baseInput,
        key: "STRIPE_WEBHOOK_SECRET",
        value: "not_a_webhook_secret_payload",
      }),
    ).rejects.toThrow(/INVALID_RUNTIME_CONFIG_VALUE:stripe_webhook_prefix/);
  });

  it("accepts a well-formed Stripe webhook secret", async () => {
    // The mock prisma.runtimeConfigEntry.upsert returns undefined; the
    // call should succeed past validation without throwing
    // INVALID_RUNTIME_CONFIG_VALUE.
    await expect(
      upsertRuntimeConfigEntry({
        ...baseInput,
        key: "STRIPE_WEBHOOK_SECRET",
        value: "whsec_abcdef0123456789abcdef0123456789",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects upsert for deployment-only keys (USER_JWT_SECRET)", async () => {
    await expect(
      upsertRuntimeConfigEntry({
        ...baseInput,
        key: "USER_JWT_SECRET",
        value: "X".repeat(48),
      }),
    ).rejects.toThrow(/RUNTIME_CONFIG_NOT_EDITABLE/);
  });

  it("rejects upsert for FIELD_ENCRYPTION_KEY (deployment-only)", async () => {
    await expect(
      upsertRuntimeConfigEntry({
        ...baseInput,
        key: "FIELD_ENCRYPTION_KEY",
        value: "f".repeat(64),
      }),
    ).rejects.toThrow(/RUNTIME_CONFIG_NOT_EDITABLE/);
  });

  it("rejects upsert for UPSTASH_REDIS_REST_TOKEN (deployment-only)", async () => {
    await expect(
      upsertRuntimeConfigEntry({
        ...baseInput,
        key: "UPSTASH_REDIS_REST_TOKEN",
        value: "AbCdEfGhIjKlMnOpQrStUvWxYz",
      }),
    ).rejects.toThrow(/RUNTIME_CONFIG_NOT_EDITABLE/);
  });
});

describe("listRuntimeConfigCatalog status surfacing", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Production-like env so requiredInProduction keys trigger the
    // "Missing" status (the default Vitest env is not production-like).
    process.env = { ...originalEnv, NODE_ENV: "production" };
    delete process.env.STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED;
    delete process.env.RESEND_API_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.USER_JWT_SECRET;
  });

  it("reports 'Verified from ENV' when only deployment env is set", async () => {
    process.env.RESEND_API_KEY = "re_env_only_abcdef";
    mocks.findMany.mockResolvedValue([]);
    const catalog = await listRuntimeConfigCatalog();
    const item = catalog.find((entry) => entry.key === "RESEND_API_KEY");
    expect(item?.status).toBe("Verified from ENV");
    expect(item?.source).toBe("ENV");
    expect(item?.maskedValue).not.toContain("env_only");
  });

  it("reports 'Conflict' and prefers ENV when both ENV and DB are set", async () => {
    process.env.RESEND_API_KEY = "re_env_value_abcdef";
    mocks.findMany.mockResolvedValue([
      {
        key: "RESEND_API_KEY",
        isSecret: true,
        valueEncrypted: "enc:re_db_value_abcdef",
        valuePlain: null,
        isActive: true,
        source: "DB",
        updatedAt: new Date(),
        lastValidatedAt: null,
        lastValidationStatus: null,
      },
    ]);
    const catalog = await listRuntimeConfigCatalog();
    const item = catalog.find((entry) => entry.key === "RESEND_API_KEY");
    expect(item?.status).toBe("Conflict");
    expect(item?.dbOverrideIgnored).toBe(true);
    expect(item?.conflict).toBe(true);
    expect(item?.warning).toMatch(/deployment env/);
  });

  it("reports 'Missing' for required keys when neither ENV nor DB is set", async () => {
    mocks.findMany.mockResolvedValue([]);
    const catalog = await listRuntimeConfigCatalog();
    const item = catalog.find((entry) => entry.key === "RESEND_API_KEY");
    expect(item?.status).toBe("Missing");
    expect(item?.source).toBe("Missing");
    expect(item?.maskedValue).toBeNull();
  });

  it("reports 'Verified from Runtime Config' for runtime-tunable keys when only DB is set", async () => {
    mocks.findMany.mockResolvedValue([
      {
        key: "ALERT_EMAIL_TO",
        isSecret: false,
        valueEncrypted: null,
        valuePlain: "ops@example.com",
        isActive: true,
        source: "DB",
        updatedAt: new Date(),
        lastValidatedAt: null,
        lastValidationStatus: null,
      },
    ]);
    const catalog = await listRuntimeConfigCatalog();
    const item = catalog.find((entry) => entry.key === "ALERT_EMAIL_TO");
    expect(item?.status).toBe("Verified from Runtime Config");
    expect(item?.source).toBe("Runtime Config");
  });

  it("never returns the raw secret value in the catalog payload", async () => {
    process.env.RESEND_API_KEY = "re_super_secret_value_abc123";
    mocks.findMany.mockResolvedValue([]);
    const catalog = await listRuntimeConfigCatalog();
    const blob = JSON.stringify(catalog);
    expect(blob).not.toContain("re_super_secret_value_abc123");
  });

  it("marks deployment-only keys as editable='No'", async () => {
    process.env.USER_JWT_SECRET = "X".repeat(48);
    mocks.findMany.mockResolvedValue([]);
    const catalog = await listRuntimeConfigCatalog();
    const item = catalog.find((entry) => entry.key === "USER_JWT_SECRET");
    expect(item?.editable).toBe("No");
    expect(item?.status).toBe("Verified from ENV");
  });
});
