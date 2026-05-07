import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

const mocks = vi.hoisted(() => ({
  userLoginSessionFindFirst: vi.fn() as any,
  adminAuditLogCreate: vi.fn().mockResolvedValue({}) as any,
  hashSessionToken: vi.fn().mockResolvedValue("token-hash") as any,
  shouldUseSecureSessionCookies: vi.fn().mockReturnValue(false) as any,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    userLoginSession: {
      findFirst: (args: any) => mocks.userLoginSessionFindFirst(args),
    },
    adminAuditLog: {
      create: (args: any) => mocks.adminAuditLogCreate(args),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  hashSessionToken: (token: string) => mocks.hashSessionToken(token),
  shouldUseSecureSessionCookies: () => mocks.shouldUseSecureSessionCookies(),
}));

const TEST_SECRET = "test-user-jwt-secret-32-characters!";

vi.mock("@/lib/user-jwt-secret", () => ({
  getUserJwtSecretKey: () => new TextEncoder().encode(TEST_SECRET),
}));

import { POST } from "./route";

async function makeJwt(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(TEST_SECRET));
}

function makeRequest(body: unknown) {
  return new NextRequest("https://locateflow.com/api/auth/impersonate-handoff", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/auth/impersonate-handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userLoginSessionFindFirst.mockResolvedValue({
      id: "session_1",
      userId: "user_1",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      impersonatedByAdminId: "admin_42",
    });
  });

  it("writes an AdminAuditLog row when a handoff completes successfully", async () => {
    const token = await makeJwt({
      userId: "user_1",
      email: "user@example.com",
      impersonatedByAdminId: "admin_42",
    });

    const response = await POST(makeRequest({ token }));

    expect(response.status).toBe(307); // redirect
    expect(mocks.adminAuditLogCreate).toHaveBeenCalledTimes(1);
    const call = mocks.adminAuditLogCreate.mock.calls[0][0] as unknown as { data: any };
    expect(call.data).toMatchObject({
      adminUserId: "admin_42",
      action: "IMPERSONATE_HANDOFF",
      entityType: "User",
      entityId: "user_1",
      ipAddress: "203.0.113.10",
    });
    const changes = JSON.parse(call.data.changes);
    expect(changes).toMatchObject({ sessionId: "session_1" });
  });

  it("does not write audit when the impersonation session is missing", async () => {
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce(null);
    const token = await makeJwt({
      userId: "user_1",
      email: "user@example.com",
      impersonatedByAdminId: "admin_42",
    });

    const response = await POST(makeRequest({ token }));

    expect(response.status).toBe(307);
    expect(mocks.adminAuditLogCreate).not.toHaveBeenCalled();
  });
});
