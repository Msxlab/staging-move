import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("/api/build-info", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("returns public deployment metadata without sensitive env values", async () => {
    vi.stubEnv("BUILD_COMMIT_SHA", "abc123");
    vi.stubEnv("BUILD_SOURCE_BRANCH", "main");
    vi.stubEnv("BUILD_CREATED_AT", "2026-06-18T17:00:00Z");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@example.com/db");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      service: "web",
      commitSha: "abc123",
      sourceBranch: "main",
      builtAt: "2026-06-18T17:00:00Z",
      environment: "production",
    });
    expect(JSON.stringify(body)).not.toMatch(/DATABASE_URL|mysql|pass|STRIPE|SECRET/i);
  });
});
