import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/user-auth", () => ({
  destroyUserSession: vi.fn(() => Promise.resolve()),
  expireUserSessionCookies: vi.fn((response) => {
    response.cookies.set("user_session", "", {
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

import { destroyUserSession, expireUserSessionCookies } from "@/lib/user-auth";
import { POST } from "./route";

const destroyUserSessionMock = destroyUserSession as unknown as Mock;
const expireUserSessionCookiesMock = expireUserSessionCookies as unknown as Mock;

function makeRequest() {
  return new NextRequest("https://locateflow.com/api/auth/logout", {
    method: "POST",
    headers: { "content-type": "application/json", host: "locateflow.com" },
    body: "{}",
  });
}

describe("logout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    destroyUserSessionMock.mockResolvedValue(undefined);
  });

  it("invalidates the session and expires the user session cookie", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(destroyUserSessionMock).toHaveBeenCalledTimes(1);
    expect(expireUserSessionCookiesMock).toHaveBeenCalledWith(response, "locateflow.com");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("user_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("is idempotent when no current session exists", async () => {
    destroyUserSessionMock.mockResolvedValue(undefined);

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});
