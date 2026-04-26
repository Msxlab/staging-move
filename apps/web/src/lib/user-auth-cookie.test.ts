import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/user-jwt-secret", () => ({
  getUserJwtSecretKey: vi.fn(() => new TextEncoder().encode("test-user-jwt-secret-32-characters")),
}));

import { expireUserSessionCookies } from "./user-auth";

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
});
