import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_RESOURCES } from "@/lib/admin-permissions";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  adminFindUnique: vi.fn(),
  adminCount: vi.fn(),
  transaction: vi.fn(),
  adminUpdate: vi.fn(),
  permissionDeleteMany: vi.fn(),
  permissionCreateMany: vi.fn(),
  sessionUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
    adminUser: {
      findUnique: (...args: unknown[]) => mocks.adminFindUnique(...args),
      count: (...args: unknown[]) => mocks.adminCount(...args),
    },
    adminSession: {
      updateMany: (...args: unknown[]) => mocks.sessionUpdateMany(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(() => Promise.resolve("hashed-password")) },
}));

import { DELETE, PATCH } from "./route";

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/team/admin_2", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin team sensitive update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "SUPER_ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.adminFindUnique.mockResolvedValue({
      id: "admin_2",
      email: "admin2@example.com",
      firstName: "Second",
      lastName: "Admin",
      role: "ADMIN",
      isActive: true,
    });
    mocks.adminCount.mockResolvedValue(1);
    mocks.adminUpdate.mockResolvedValue({
      id: "admin_2",
      email: "admin2@example.com",
      firstName: "Second",
      lastName: "Admin",
      role: "MODERATOR",
      isActive: true,
    });
    mocks.transaction.mockImplementation((callback) =>
      callback({
        adminUser: { update: mocks.adminUpdate },
        adminPermission: {
          deleteMany: mocks.permissionDeleteMany,
          createMany: mocks.permissionCreateMany,
        },
      }),
    );
    mocks.sessionUpdateMany.mockResolvedValue({ count: 2 });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("requires password confirmation for role/password/permission/status updates", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Password confirmation required for this operation.",
    });

    const response = await PATCH(
      request({ role: "MODERATOR" }),
      { params: Promise.resolve({ id: "admin_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresPassword).toBe(true);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ADMIN_UPDATE_FAILED",
        entityType: "AdminUser",
        entityId: "admin_2",
      }),
    });
  });

  it("updates and audits a sensitive admin change after password confirmation", async () => {
    const response = await PATCH(
      request({ role: "MODERATOR", confirmPassword: "admin-password" }),
      { params: Promise.resolve({ id: "admin_2" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1", role: "SUPER_ADMIN" },
      "admin-password",
      expect.objectContaining({ operation: "admin_user_sensitive_update", requireMfa: true }),
    );
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { adminUserId: "admin_2", isActive: true },
      data: { isActive: false, lastActivity: expect.any(Date) },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ADMIN_ROLE_CHANGED",
        entityType: "AdminUser",
        entityId: "admin_2",
      }),
    });
  });

  it("rejects duplicate permission resources before createMany", async () => {
    const permissions = ADMIN_RESOURCES.map((resource) => ({
      resource,
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    }));
    permissions[1] = { ...permissions[1], resource: permissions[0].resource };

    const response = await PATCH(
      request({ permissions, confirmPassword: "admin-password", mfaCode: "123456" }),
      { params: Promise.resolve({ id: "admin_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Duplicate permission resource");
    expect(mocks.permissionCreateMany).not.toHaveBeenCalled();
  });

  it("rejects unknown permission actions before createMany", async () => {
    const permissions = ADMIN_RESOURCES.map((resource, index) => ({
      resource,
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      ...(index === 0 ? { canPublish: true } : {}),
    }));

    const response = await PATCH(
      request({ permissions, confirmPassword: "admin-password", mfaCode: "123456" }),
      { params: Promise.resolve({ id: "admin_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Unknown permission action");
    expect(mocks.permissionCreateMany).not.toHaveBeenCalled();
  });

  it("blocks last active SUPER_ADMIN deactivation", async () => {
    mocks.adminFindUnique.mockResolvedValue({
      id: "admin_2",
      email: "root@example.com",
      firstName: "Root",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      isActive: true,
    });
    mocks.adminCount.mockResolvedValue(0);

    const response = await PATCH(
      request({ isActive: false, confirmPassword: "admin-password", mfaCode: "123456" }),
      { params: Promise.resolve({ id: "admin_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("last active SUPER_ADMIN");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks self-demotion", async () => {
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_2", role: "SUPER_ADMIN" });

    const response = await PATCH(
      request({ role: "ADMIN", confirmPassword: "admin-password", mfaCode: "123456" }),
      { params: Promise.resolve({ id: "admin_2" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires MFA step-up before archiving an admin", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await DELETE(
      request({ confirmPassword: "admin-password" }),
      { params: Promise.resolve({ id: "admin_2" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ADMIN_ACTION_FAILED",
        entityType: "AdminUser",
        entityId: "admin_2",
      }),
    });
  });
});
