import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/user-jwt-secret", () => ({
  getUserJwtSecretKey: vi.fn(() => new TextEncoder().encode("test-user-jwt-secret-32-characters")),
}));

import { expireUserSessionCookies, shouldUseSecureSessionCookies } from "./user-auth";

afterEach(() => {
  delete process.env.APP_ENV;
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("user auth session cookies", () => {
  it("expires host-only and locateflow domain session cookies", () => {
    const response = expireUserSessionCookies(
      NextResponse.json({ success: true }),
      "locateflow.com",
    );
    const setCookie = response.headers.get("set-cookie") || "";

    expect(setCookie).toContain("user_session=");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("Domain=.locateflow.com");
  });

  it("uses secure cookies for staging and HTTPS app URLs outside NODE_ENV production", () => {
    process.env.APP_ENV = "staging";
    expect(shouldUseSecureSessionCookies()).toBe(true);

    delete process.env.APP_ENV;
    process.env.NEXT_PUBLIC_APP_URL = "https://locateflow.com";
    expect(shouldUseSecureSessionCookies()).toBe(true);
  });
});
