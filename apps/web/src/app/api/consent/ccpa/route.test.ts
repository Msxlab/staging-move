import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dataConsentCreate: vi.fn(),
  getUserSession: vi.fn(),
  resolveClientIpFromHeaders: vi.fn(),
  shouldUseSecureSessionCookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    dataConsent: {
      create: mocks.dataConsentCreate,
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getUserSession: mocks.getUserSession,
}));

vi.mock("@/lib/client-ip", () => ({
  resolveClientIpFromHeaders: mocks.resolveClientIpFromHeaders,
}));

vi.mock("@/lib/user-auth", () => ({
  shouldUseSecureSessionCookies: mocks.shouldUseSecureSessionCookies,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://locateflow.com/api/consent/ccpa", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "vitest",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/consent/ccpa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserSession.mockResolvedValue(null);
    mocks.resolveClientIpFromHeaders.mockReturnValue("203.0.113.10");
    mocks.shouldUseSecureSessionCookies.mockReturnValue(true);
    mocks.dataConsentCreate.mockResolvedValue({});
  });

  it("mirrors anonymous opt-out into a secure root-scoped cookie", async () => {
    const response = await POST(request({ optOut: true }));
    const cookie = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("ccpa_opt_out=1");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it("clears the same root-scoped cookie when opt-out is revoked", async () => {
    const response = await POST(request({ optOut: false }));
    const cookie = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("ccpa_opt_out=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toMatch(/SameSite=lax/i);
  });
});
