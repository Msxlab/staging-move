import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  userFindUnique: vi.fn(),
  auditLogFindMany: vi.fn(),
  userSessionFindMany: vi.fn(),
  userEventFindMany: vi.fn(),
  userEventGroupBy: vi.fn(),
  pushDeviceFindMany: vi.fn(),
  userLoginSessionFindMany: vi.fn(),
  gdprRequestFindMany: vi.fn(),
  adminAuditLogFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: vi.fn(),
}));

vi.mock("@/lib/user-notify", () => ({
  notifyUserOfAdminChange: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mocks.userFindUnique(...args) },
    auditLog: { findMany: (...args: unknown[]) => mocks.auditLogFindMany(...args) },
    userSession: { findMany: (...args: unknown[]) => mocks.userSessionFindMany(...args) },
    userEvent: {
      findMany: (...args: unknown[]) => mocks.userEventFindMany(...args),
      groupBy: (...args: unknown[]) => mocks.userEventGroupBy(...args),
    },
    pushDevice: { findMany: (...args: unknown[]) => mocks.pushDeviceFindMany(...args) },
    userLoginSession: { findMany: (...args: unknown[]) => mocks.userLoginSessionFindMany(...args) },
    gDPRRequest: { findMany: (...args: unknown[]) => mocks.gdprRequestFindMany(...args) },
    adminAuditLog: { findMany: (...args: unknown[]) => mocks.adminAuditLogFindMany(...args) },
  },
}));

import { GET } from "./route";

describe("admin user detail API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Admin",
      passwordHash: "hash_should_not_escape",
      oauthAccounts: [
        {
          id: "oauth_1",
          provider: "google",
          providerId: "google-subject-value-1234567890",
          createdAt: new Date("2026-04-26T12:00:00Z"),
        },
      ],
      emailVerificationTokens: [],
      passwordResetTokens: [],
    });
    mocks.auditLogFindMany.mockResolvedValue([]);
    mocks.userSessionFindMany.mockResolvedValue([]);
    mocks.userEventFindMany.mockResolvedValue([]);
    mocks.userEventGroupBy.mockResolvedValue([]);
    mocks.pushDeviceFindMany.mockResolvedValue([]);
    mocks.userLoginSessionFindMany.mockResolvedValue([]);
    mocks.gdprRequestFindMany.mockResolvedValue([]);
    mocks.adminAuditLogFindMany.mockResolvedValue([]);
  });

  it("does not return password hashes or token identifiers", async () => {
    const response = await GET(
      new NextRequest("https://admin.locateflow.com/api/users/user_1"),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();
    const select = mocks.userFindUnique.mock.calls[0][0].select;

    expect(response.status).toBe(200);
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.user.hasPasswordLogin).toBe(true);
    expect(body.user.oauthAccounts[0]).toMatchObject({
      id: "oauth_1",
      provider: "google",
      providerIdHint: "goog****7890",
    });
    expect(select.emailVerificationTokens.select.id).toBeUndefined();
    expect(select.passwordResetTokens.select.id).toBeUndefined();
  });
});
