import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/user-auth", () => ({
  destroyUserSession: vi.fn(() => Promise.resolve()),
  getUserSession: vi.fn(() => Promise.resolve(null)),
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

vi.mock("@/lib/qa-account", () => ({
  resetAllowlistedQaAccountOnLogout: vi.fn(() => Promise.resolve({ reset: false, reason: "config_disabled" })),
}));

vi.mock("@/lib/user-security-audit", () => ({
  recordUserSecurityAudit: vi.fn(),
}));

import { destroyUserSession, expireUserSessionCookies, getUserSession } from "@/lib/user-auth";
import { resetAllowlistedQaAccountOnLogout } from "@/lib/qa-account";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";
import { POST } from "./route";

const destroyUserSessionMock = destroyUserSession as unknown as Mock;
const expireUserSessionCookiesMock = expireUserSessionCookies as unknown as Mock;
const getUserSessionMock = getUserSession as unknown as Mock;
const resetAllowlistedQaAccountOnLogoutMock = resetAllowlistedQaAccountOnLogout as unknown as Mock;
const recordUserSecurityAuditMock = recordUserSecurityAudit as unknown as Mock;

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
    getUserSessionMock.mockResolvedValue(null);
    destroyUserSessionMock.mockResolvedValue(undefined);
    resetAllowlistedQaAccountOnLogoutMock.mockResolvedValue({ reset: false, reason: "config_disabled" });
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

  it("records a normal logout audit when the session is not a resettable QA account", async () => {
    getUserSessionMock.mockResolvedValue({ userId: "user-1", email: "user@example.com" });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(resetAllowlistedQaAccountOnLogoutMock).toHaveBeenCalledWith({
      userId: "user-1",
      sessionEmail: "user@example.com",
    });
    expect(recordUserSecurityAuditMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      action: "LOGOUT",
      entityId: "user-1",
      changes: { status: "success" },
    }));
  });

  it("skips logout audit when the resettable QA account was hard-reset", async () => {
    getUserSessionMock.mockResolvedValue({ userId: "qa-user", email: "qa@example.com" });
    resetAllowlistedQaAccountOnLogoutMock.mockResolvedValue({ reset: true });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(resetAllowlistedQaAccountOnLogoutMock).toHaveBeenCalledWith({
      userId: "qa-user",
      sessionEmail: "qa@example.com",
    });
    expect(recordUserSecurityAuditMock).not.toHaveBeenCalled();
  });
});
