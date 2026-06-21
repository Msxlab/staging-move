import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mocks.queryRaw(...args),
  },
}));

import { GET } from "./route";

const validEnv = {
  NODE_ENV: "production" as const,
  APP_ENV: "staging",
  DATABASE_URL: "mysql://user:pass@mysql:3306/locateflow",
  ADMIN_JWT_SECRET: "a".repeat(48),
  FIELD_ENCRYPTION_KEY: "f".repeat(64),
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "r".repeat(32),
};

describe("admin /api/ready", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ...validEnv };
    mocks.queryRaw.mockResolvedValue([{ ok: 1 }]);
  });

  it("passes when staging admin runtime dependencies are configured", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ready).toBe(true);
    expect(body.database).toBe("ready");
    expect(JSON.stringify(body)).not.toContain(validEnv.ADMIN_JWT_SECRET);
  });

  it("fails without shared Redis in staging without leaking key names", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.requiredOk).toBe(false);
    expect(body.missingRequiredCount).toBe(2);
    expect(JSON.stringify(body)).not.toContain("UPSTASH_REDIS_REST_URL");
    expect(JSON.stringify(body)).not.toContain("UPSTASH_REDIS_REST_TOKEN");
  });
});
