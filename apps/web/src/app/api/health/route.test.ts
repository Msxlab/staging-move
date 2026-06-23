import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  getRequiredRuntimeConfigValues: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mocks.queryRaw(...args),
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getRequiredRuntimeConfigValues: (...args: unknown[]) =>
    mocks.getRequiredRuntimeConfigValues(...args),
}));

import { GET } from "./route";

const validEnv: Record<string, string> = {
  NODE_ENV: "production",
  APP_ENV: "production",
  USER_JWT_SECRET: "u".repeat(48),
  ADMIN_JWT_SECRET: "a".repeat(48),
  FIELD_ENCRYPTION_KEY: "f".repeat(64),
  CRON_SECRET: "c".repeat(48),
  INTERNAL_WEBHOOK_SECRET: "i".repeat(48),
  IMPERSONATION_HANDOFF_SECRET: "h".repeat(48),
  DATABASE_URL: "mysql://user:pass@db.example.com/locateflow",
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "r".repeat(32),
  APP_URL: "https://app.example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  NEXT_PUBLIC_ADMIN_URL: "https://admin.example.com",
  RESEND_API_KEY: "re_abcdefghijklmnopqrstuvwxyz",
  EMAIL_FROM: "LocateFlow <noreply@example.com>",
  SUPPORT_EMAIL: "support@example.com",
  STRIPE_SECRET_KEY: "sk_live_abcdefghijklmnopqrstuvwxyz",
  STRIPE_WEBHOOK_SECRET: "whsec_abcdefghijklmnopqrstuvwxyz",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_abcdefghijklmnopqrstuvwxyz",
  STRIPE_PRICE_INDIVIDUAL_MONTHLY: "price_individualmonthly123",
  STRIPE_PRICE_INDIVIDUAL_YEARLY: "price_individualyearly123",
  STRIPE_PRICE_FAMILY_MONTHLY: "price_familymonthly123",
  STRIPE_PRICE_FAMILY_YEARLY: "price_familyyearly123",
  STRIPE_PRICE_PRO_MONTHLY: "price_promonthly123",
  STRIPE_PRICE_PRO_YEARLY: "price_proyearly123",
  GOOGLE_MAPS_API_KEY: "AIzaSyProductionMapsKey",
  GOOGLE_PLAY_PACKAGE_NAME: "com.locateflow.mobile",
  GOOGLE_PLAY_RTDN_AUDIENCE: "https://locateflow.com/api/webhooks/playstore",
  TRUSTED_PROXY_HEADERS: "cloudflare",
  // Legal-entity boot guard (audit S3.3/1.6): a valid prod config declares these.
  NEXT_PUBLIC_LEGAL_ENTITY_NAME: "LocateFlow Inc.",
  NEXT_PUBLIC_COMPANY_ADDRESS: "123 Example St, Austin, TX 78701",
};

describe("/api/health", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ...validEnv };
    mocks.queryRaw.mockResolvedValue([{ ok: 1 }]);
    mocks.getRequiredRuntimeConfigValues.mockImplementation(async (keys: string[]) => ({
      ...Object.fromEntries(keys.map((key) => [key, process.env[key] || null])),
      GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: null,
      GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: null,
      GOOGLE_PLAY_OAUTH_CLIENT_ID: "play-oauth-client-id",
      GOOGLE_PLAY_OAUTH_REFRESH_TOKEN: "play-oauth-refresh-token",
    }));
  });

  it("reports env readiness from production readiness rules", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.ready).toBe(true);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof body.uptimeSec).toBe("number");
    expect(body.env).toEqual({ requiredOk: true, missingRequiredCount: 0 });
    expect(JSON.stringify(body)).not.toContain("play-oauth-refresh-token");
    expect(JSON.stringify(body)).not.toMatch(
      /DATABASE_URL|UPSTASH|STRIPE|GOOGLE_PLAY|NEXT_PUBLIC|memory|seo|checks|config|commit/i,
    );
  });

  it("keeps liveness status tied to the database", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("db unavailable"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.env).toEqual({ requiredOk: true, missingRequiredCount: 0 });
  });
});
