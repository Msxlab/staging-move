import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  adminFindUnique: vi.fn(),
  adminCreate: vi.fn(),
  permissionCreateMany: vi.fn(),
  auditCreate: vi.fn(),
  issueSetPasswordToken: vi.fn(),
  sendAdminInviteEmail: vi.fn(),
  getAdminRuntimeConfigValues: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: (...args: unknown[]) => mocks.adminFindUnique(...args),
      create: (...args: unknown[]) => mocks.adminCreate(...args),
    },
    adminPermission: {
      createMany: (...args: unknown[]) => mocks.permissionCreateMany(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(() => Promise.resolve("hashed-admin-password")) },
}));

vi.mock("@/lib/admin-invite", () => ({
  issueSetPasswordToken: (...args: unknown[]) => mocks.issueSetPasswordToken(...args),
}));

vi.mock("@/lib/email", () => ({
  sendAdminInviteEmail: (...args: unknown[]) => mocks.sendAdminInviteEmail(...args),
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValues: (...args: unknown[]) => mocks.getAdminRuntimeConfigValues(...args),
}));

import { POST } from "./route";

function request(body: Record<string, unknown>, url = "https://admin.locateflow.com/api/team") {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: "new-admin@example.com",
  password: "StrongPassword2026",
  firstName: "New",
  lastName: "Admin",
  role: "ADMIN",
};

describe("admin team create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.adminFindUnique.mockResolvedValue(null);
    mocks.adminCreate.mockResolvedValue({
      id: "admin_2",
      email: "new-admin@example.com",
      firstName: "New",
      lastName: "Admin",
      role: "ADMIN",
    });
    mocks.permissionCreateMany.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
    mocks.issueSetPasswordToken.mockResolvedValue({
      token: "invite-token",
      expiresAt: new Date("2026-06-22T12:00:00.000Z"),
    });
    mocks.sendAdminInviteEmail.mockResolvedValue(true);
    mocks.getAdminRuntimeConfigValues.mockResolvedValue({});
  });

  it("requires password confirmation before creating an admin", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Password confirmation required for this operation.",
    });

    const response = await POST(request(validBody));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresPassword).toBe(true);
    expect(mocks.adminCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ADMIN_CREATE_FAILED",
        entityType: "AdminUser",
        entityId: "new",
      }),
    });
  });

  it("blocks non-SUPER_ADMIN callers through the permission gate", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("FORBIDDEN"));

    const response = await POST(request({ ...validBody, confirmPassword: "admin-password", mfaCode: "123456" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("FORBIDDEN");
    expect(mocks.adminCreate).not.toHaveBeenCalled();
  });

  it("creates and audits a new admin after password confirmation", async () => {
    const response = await POST(request({ ...validBody, confirmPassword: "admin-password" }));

    expect(response.status).toBe(201);
    // Step-up grace cache is keyed by `(adminId, sessionScope, operation)`,
    // so the route passes an `operation` string. The test matches against
    // that (lib/auth.ts:requirePasswordConfirm).
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1" },
      "admin-password",
      expect.objectContaining({ operation: "admin_user_create", requireMfa: true }),
    );
    expect(mocks.adminCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new-admin@example.com",
        password: "hashed-admin-password",
        createdBy: "admin_1",
      }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ADMIN_CREATED",
        entityType: "AdminUser",
        entityId: "admin_2",
      }),
    });
  });

  it("builds invite set-password links from the current admin origin when no admin URL is configured", async () => {
    const response = await POST(request(
      {
        email: "new-admin@example.com",
        firstName: "New",
        lastName: "Admin",
        role: "ADMIN",
        confirmPassword: "admin-password",
      },
      "https://admin-staging.example.com/api/team",
    ));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.issueSetPasswordToken).toHaveBeenCalledWith({
      adminUserId: "admin_2",
      purpose: "INVITE",
      createdBy: "admin_1",
    });
    expect(mocks.sendAdminInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        setPasswordUrl: "https://admin-staging.example.com/set-password?token=invite-token",
      }),
    );
    expect(body.setPasswordUrl).toBe("https://admin-staging.example.com/set-password?token=invite-token");
  });
});
