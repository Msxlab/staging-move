import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyInternalAuth: vi.fn(),
  trackBlockedIPAttempt: vi.fn(),
  trackSessionHijackAttempt: vi.fn(),
  trackBreakGlassBypass: vi.fn(),
}));

vi.mock("@/lib/internal-secrets", () => ({
  verifyInternalAuth: (...args: unknown[]) => mocks.verifyInternalAuth(...args),
}));

vi.mock("@/lib/security-monitor", () => ({
  trackBlockedIPAttempt: (...args: unknown[]) => mocks.trackBlockedIPAttempt(...args),
  trackSessionHijackAttempt: (...args: unknown[]) => mocks.trackSessionHijackAttempt(...args),
  trackBreakGlassBypass: (...args: unknown[]) => mocks.trackBreakGlassBypass(...args),
}));

import { POST } from "./route";

function request(body: unknown, authorized = true) {
  return new NextRequest("https://admin.locateflow.com/api/internal/security-event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorized ? { authorization: "Bearer internal-secret" } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("internal security-event API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyInternalAuth.mockReturnValue(true);
  });

  it("rejects callers without a valid internal secret", async () => {
    mocks.verifyInternalAuth.mockReturnValue(false);
    const res = await POST(request({ type: "IP_RULE_BYPASSED_FOR_BREAK_GLASS", ip: "203.0.113.7", pathname: "/login" }, false));
    expect(res.status).toBe(401);
    expect(mocks.trackBreakGlassBypass).not.toHaveBeenCalled();
  });

  it("accepts, records, and alerts on break-glass IP-rule bypass events", async () => {
    const res = await POST(
      request({
        type: "IP_RULE_BYPASSED_FOR_BREAK_GLASS",
        ip: "203.0.113.7",
        pathname: "/api/auth/login",
        adminId: "admin-9",
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    // The route hands the event to the security monitor, which writes the
    // audit row and (HIGH severity) dispatches the real-time admin alert.
    expect(mocks.trackBreakGlassBypass).toHaveBeenCalledWith("203.0.113.7", "/api/auth/login", "admin-9");
    expect(mocks.trackBlockedIPAttempt).not.toHaveBeenCalled();
    expect(mocks.trackSessionHijackAttempt).not.toHaveBeenCalled();
  });

  it("accepts a break-glass bypass event with no adminId (unauthenticated login surface)", async () => {
    const res = await POST(
      request({ type: "IP_RULE_BYPASSED_FOR_BREAK_GLASS", ip: "203.0.113.7", pathname: "/login" }),
    );

    expect(res.status).toBe(200);
    expect(mocks.trackBreakGlassBypass).toHaveBeenCalledWith("203.0.113.7", "/login", undefined);
  });

  it("still routes blocked-IP and session-hijack events to their trackers", async () => {
    const blocked = await POST(request({ type: "BLOCKED_IP_ATTEMPT", ip: "198.51.100.1", pathname: "/dashboard" }));
    expect(blocked.status).toBe(200);
    expect(mocks.trackBlockedIPAttempt).toHaveBeenCalledWith("198.51.100.1", "/dashboard");

    const hijack = await POST(request({ type: "SESSION_HIJACK_ATTEMPT", ip: "198.51.100.2", adminId: "admin-3" }));
    expect(hijack.status).toBe(200);
    expect(mocks.trackSessionHijackAttempt).toHaveBeenCalledWith("198.51.100.2", "admin-3");
  });

  it("rejects unknown event types with 400", async () => {
    const res = await POST(request({ type: "NOT_A_REAL_EVENT", ip: "203.0.113.9", pathname: "/login" }));
    expect(res.status).toBe(400);
    expect(mocks.trackBreakGlassBypass).not.toHaveBeenCalled();
  });
});
