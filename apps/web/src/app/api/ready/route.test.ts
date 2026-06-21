import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

function request(url = "https://locateflow.com/api/ready") {
  return new NextRequest(url);
}

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
};

describe("/api/ready", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ...validEnv };
    mocks.queryRaw.mockResolvedValue([{ ok: 1 }]);
    mocks.getRequiredRuntimeConfigValues.mockImplementation(async (keys: string[]) =>
      Object.fromEntries(keys.map((key) => [key, process.env[key] || null])),
    );
  });

  it("passes with valid ENV-backed effective config and empty Runtime Config DB", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ready).toBe(true);
    expect(body.database).toBe("ready");
    expect(JSON.stringify(body)).not.toContain(validEnv.USER_JWT_SECRET);
  });

  it("fails with 503 when a required production env value is missing", async () => {
    delete process.env.USER_JWT_SECRET;

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.requiredOk).toBe(false);
    expect(body.missingRequiredCount).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain("USER_JWT_SECRET");
  });

  it("fails with 503 when Upstash is missing in production", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.requiredOk).toBe(false);
    expect(body.missingRequiredCount).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain("UPSTASH_REDIS");
  });

  it("can return a 200 diagnostic body without changing readiness status semantics", async () => {
    delete process.env.USER_JWT_SECRET;

    const response = await GET(request("https://locateflow.com/api/ready?soft=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.soft).toBe(true);
    expect(body.ready).toBe(false);
    expect(body.readinessStatus).toBe(503);
    expect(body.missingRequiredCount).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain("USER_JWT_SECRET");
  });
});
