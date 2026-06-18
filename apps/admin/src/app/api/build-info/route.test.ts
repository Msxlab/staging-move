import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("admin /api/build-info route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("returns public deployment metadata without sensitive env values", async () => {
    vi.stubEnv("BUILD_COMMIT_SHA", "def456");
    vi.stubEnv("BUILD_SOURCE_BRANCH", "main");
    vi.stubEnv("BUILD_CREATED_AT", "2026-06-18T17:10:00Z");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("ADMIN_JWT_SECRET", "a".repeat(64));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      service: "admin",
      commitSha: "def456",
      sourceBranch: "main",
      builtAt: "2026-06-18T17:10:00Z",
      environment: "production",
    });
    expect(JSON.stringify(body)).not.toMatch(/ADMIN_JWT_SECRET|secret|jwt/i);
  });
});
