import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdateMany: vi.fn(),
  userLoginSessionUpdateMany: vi.fn(),
  userSessionUpdateMany: vi.fn(),
  gdprFindFirst: vi.fn(),
  gdprCreate: vi.fn(),
  gdprUpdate: vi.fn(),
  adminAuditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
      updateMany: (...args: unknown[]) => mocks.userUpdateMany(...args),
    },
    userLoginSession: {
      updateMany: (...args: unknown[]) => mocks.userLoginSessionUpdateMany(...args),
    },
    userSession: {
      updateMany: (...args: unknown[]) => mocks.userSessionUpdateMany(...args),
    },
    gDPRRequest: {
      findFirst: (...args: unknown[]) => mocks.gdprFindFirst(...args),
      create: (...args: unknown[]) => mocks.gdprCreate(...args),
      update: (...args: unknown[]) => mocks.gdprUpdate(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.adminAuditCreate(...args),
    },
  },
}));

vi.mock("@/lib/user-notify", () => ({
  notifyUserOfAdminChange: vi.fn(),
}));

import { DELETE, POST } from "./route";

function request(confirmPassword = "admin-password") {
  return new NextRequest("https://admin.locateflow.com/api/users/user_1", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmPassword }),
  });
}

describe("admin user detail delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      deletedAt: null,
      subscription: null,
    });
    mocks.gdprFindFirst.mockResolvedValue(null);
    mocks.gdprCreate.mockResolvedValue({ id: "gdpr_1", status: "PENDING" });
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });
    mocks.userLoginSessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.userSessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.adminAuditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback) =>
      callback({
        user: { updateMany: mocks.userUpdateMany },
        userLoginSession: { updateMany: mocks.userLoginSessionUpdateMany },
        userSession: { updateMany: mocks.userSessionUpdateMany },
        gDPRRequest: { create: mocks.gdprCreate, update: mocks.gdprUpdate },
        adminAuditLog: { create: mocks.adminAuditCreate },
      }),
    );
  });

  it("soft-deletes the user, revokes sessions, and audits after the mutation", async () => {
    const response = await DELETE(request(), { params: Promise.resolve({ id: "user_1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: "user_1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mocks.userLoginSessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", isActive: true },
      data: { isActive: false, lastActivity: expect.any(Date) },
    });
    expect(mocks.userSessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", isActive: true },
      data: { isActive: false, sessionEnd: expect.any(Date), lastActivity: expect.any(Date) },
    });
    expect(mocks.gdprCreate).toHaveBeenCalledTimes(1);
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE_USER",
        entityType: "User",
        entityId: "user_1",
      }),
    });
    expect(mocks.adminAuditCreate.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.userUpdateMany.mock.invocationCallOrder[0],
    );
  });

  it("does not audit or mutate when password confirmation fails", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Incorrect password.",
    });

    const response = await DELETE(request("wrong"), { params: Promise.resolve({ id: "user_1" }) });

    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });

  it("skips users with a processing GDPR delete request", async () => {
    mocks.gdprFindFirst.mockResolvedValue({ id: "gdpr_processing", status: "PROCESSING" });

    const response = await DELETE(request(), { params: Promise.resolve({ id: "user_1" }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.skippedReason).toBe("processing_gdpr_request");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });

  it("skips already deleted users without writing an audit log", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      deletedAt: new Date("2026-04-26T12:00:00Z"),
      subscription: null,
    });

    const response = await DELETE(request(), { params: Promise.resolve({ id: "user_1" }) });

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });

  it("restores a soft-deleted user, cancels pending admin cleanup, and writes an audit log", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      deletedAt: new Date("2026-04-26T12:00:00Z"),
    });
    mocks.gdprFindFirst.mockResolvedValue({
      id: "gdpr_pending",
      status: "PENDING",
      requestData: JSON.stringify({ source: "admin", cleanup: { userDeleted: false } }),
    });
    mocks.gdprUpdate.mockResolvedValue({ id: "gdpr_pending", status: "REJECTED" });

    const response = await POST(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore_user", confirmPassword: "admin-password" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.restored).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith("users", "canDelete", { minimumRole: "SUPER_ADMIN" });
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: "user_1", deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    expect(mocks.gdprUpdate).toHaveBeenCalledWith({
      where: { id: "gdpr_pending" },
      data: expect.objectContaining({
        status: "REJECTED",
        completedAt: expect.any(Date),
      }),
    });
    expect(mocks.userLoginSessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.userSessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "RESTORE_USER",
        entityType: "User",
        entityId: "user_1",
      }),
    });
  });

  it("does not restore when password confirmation fails", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Incorrect password.",
    });

    const response = await POST(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore_user", confirmPassword: "wrong" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });

  it("does not restore when GDPR deletion cleanup is already processing", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      deletedAt: new Date("2026-04-26T12:00:00Z"),
    });
    mocks.gdprFindFirst.mockResolvedValue({ id: "gdpr_processing", status: "PROCESSING" });

    const response = await POST(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore_user", confirmPassword: "admin-password" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.skippedReason).toBe("processing_gdpr_request");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });
});
