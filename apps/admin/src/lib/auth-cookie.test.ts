import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("./db", () => ({ prisma: {} }));
vi.mock("./security-monitor", () => ({
  trackFailedPasswordConfirm: vi.fn(),
  trackSensitiveOp: vi.fn(),
}));
vi.mock("./session-fingerprint", () => ({
  generateAdminSessionFingerprint: vi.fn(() => Promise.resolve("fingerprint")),
}));

describe("admin auth cookies", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env["ADMIN_JWT_SECRET"] = "x".repeat(40);
    process.env.APP_ENV = "staging";
  });

  it("expires admin_session as Secure and SameSite Strict without a broad locateflow domain", async () => {
    const { expireAdminSessionCookies } = await import("./auth");
    const response = expireAdminSessionCookies(
      NextResponse.json({ success: true }),
      "admin.locateflow.com",
    );
    const setCookie = response.headers.get("set-cookie") || "";

    expect(setCookie).toContain("admin_session=");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=strict");
    expect(setCookie).not.toContain("Domain=.locateflow.com");
  });
});
