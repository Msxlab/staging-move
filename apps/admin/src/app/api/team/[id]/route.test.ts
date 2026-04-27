import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  adminFindUnique: vi.fn(),
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

import { PATCH } from "./route";

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
    expect(mocks.auditCreate).not.toHaveBeenCalled();
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
    );
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { adminUserId: "admin_2", isActive: true },
      data: { isActive: false, lastActivity: expect.any(Date) },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "UPDATE_ADMIN",
        entityType: "AdminUser",
        entityId: "admin_2",
      }),
    });
  });
});
