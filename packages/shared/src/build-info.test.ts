import { describe, expect, it } from "vitest";

import { readBuildInfo } from "./build-info";

describe("readBuildInfo", () => {
  it("returns only safe deployment metadata", () => {
    const info = readBuildInfo("web", {
      BUILD_COMMIT_SHA: "abc123",
      BUILD_SOURCE_BRANCH: "main",
      BUILD_CREATED_AT: "2026-06-18T17:00:00Z",
      APP_ENV: "production",
      DATABASE_URL: "mysql://user:pass@example.com/db",
      STRIPE_SECRET_KEY: "sk_live_secret",
    });

    expect(info).toEqual({
      service: "web",
      commitSha: "abc123",
      sourceBranch: "main",
      builtAt: "2026-06-18T17:00:00Z",
      environment: "production",
    });
    expect(JSON.stringify(info)).not.toMatch(/DATABASE_URL|STRIPE|secret|mysql/i);
  });

  it("falls back to unknown when build metadata is absent", () => {
    expect(readBuildInfo("admin", {})).toEqual({
      service: "admin",
      commitSha: "unknown",
      sourceBranch: "unknown",
      builtAt: "unknown",
      environment: "unknown",
    });
  });

  it("uses generated build metadata when env values are missing or unknown", () => {
    expect(readBuildInfo(
      "web",
      {
        BUILD_COMMIT_SHA: "unknown",
        BUILD_SOURCE_BRANCH: "",
        BUILD_CREATED_AT: "unknown",
        APP_ENV: "production",
      },
      {
        commitSha: "6aa98b415bde3ce21a665268e1e0b268aa3cb4b0",
        sourceBranch: "main",
        builtAt: "2026-06-18T18:45:00.000Z",
      },
    )).toEqual({
      service: "web",
      commitSha: "6aa98b415bde3ce21a665268e1e0b268aa3cb4b0",
      sourceBranch: "main",
      builtAt: "2026-06-18T18:45:00.000Z",
      environment: "production",
    });
  });
});
