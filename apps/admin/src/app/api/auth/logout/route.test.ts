import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  destroySession: vi.fn(() => Promise.resolve()),
  expireAdminSessionCookies: vi.fn((response) => {
    response.cookies.set("admin_session", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  }),
}));

import { destroySession, expireAdminSessionCookies } from "@/lib/auth";
import { POST } from "./route";

const destroySessionMock = destroySession as unknown as Mock;
const expireAdminSessionCookiesMock = expireAdminSessionCookies as unknown as Mock;

describe("admin logout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    destroySessionMock.mockResolvedValue(undefined);
  });

  it("invalidates the admin session and expires the admin session cookie", async () => {
    const request = new NextRequest("https://admin.locateflow.com/api/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json", host: "admin.locateflow.com" },
      body: "{}",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(destroySessionMock).toHaveBeenCalledTimes(1);
    expect(expireAdminSessionCookiesMock).toHaveBeenCalledWith(response, "admin.locateflow.com");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("admin_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
