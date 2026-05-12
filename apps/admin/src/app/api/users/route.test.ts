import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  transaction: vi.fn(),
  userFindMany: vi.fn(),
  userUpdateMany: vi.fn(),
  userCount: vi.fn(),
  userLoginSessionUpdateMany: vi.fn(),
  userSessionUpdateMany: vi.fn(),
  subscriptionCount: vi.fn(),
  subscriptionGroupBy: vi.fn(),
  gdprFindFirst: vi.fn(),
  gdprCreate: vi.fn(),
  adminAuditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => {
  const userClient = {
    findMany: (...args: unknown[]) => mocks.userFindMany(...args),
    updateMany: (...args: unknown[]) => mocks.userUpdateMany(...args),
    count: (...args: unknown[]) => mocks.userCount(...args),
  };
  const prisma = {
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
    user: userClient,
    userLoginSession: {
      updateMany: (...args: unknown[]) => mocks.userLoginSessionUpdateMany(...args),
    },
    userSession: {
      updateMany: (...args: unknown[]) => mocks.userSessionUpdateMany(...args),
    },
    subscription: {
      count: (...args: unknown[]) => mocks.subscriptionCount(...args),
      groupBy: (...args: unknown[]) => mocks.subscriptionGroupBy(...args),
    },
    gDPRRequest: {
      findFirst: (...args: unknown[]) => mocks.gdprFindFirst(...args),
      create: (...args: unknown[]) => mocks.gdprCreate(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.adminAuditCreate(...args),
    },
  };
  return { prisma, prismaUnsafe: prisma, rawPrisma: prisma };
});

import { DELETE, GET } from "./route";

describe("admin users API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.transaction.mockImplementation((callback) =>
      callback({
        user: { updateMany: mocks.userUpdateMany },
        userLoginSession: { updateMany: mocks.userLoginSessionUpdateMany },
        userSession: { updateMany: mocks.userSessionUpdateMany },
        gDPRRequest: { create: mocks.gdprCreate },
        adminAuditLog: { create: mocks.adminAuditCreate },
      }),
    );
    mocks.userFindMany.mockResolvedValue([
      { id: "user_processing", email: "processing@example.com", subscription: null },
      { id: "user_new", email: "new@example.com", subscription: null },
    ]);
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });
    mocks.userLoginSessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.userSessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.gdprFindFirst
      .mockResolvedValueOnce({ id: "req_processing", status: "PROCESSING" })
      .mockResolvedValueOnce(null);
    mocks.gdprCreate.mockResolvedValue({ id: "req_new", status: "PENDING" });
    mocks.adminAuditCreate.mockResolvedValue({});
  });

  it("lists only active users by default", async () => {
    mocks.userFindMany.mockResolvedValue([]);
    mocks.userCount.mockResolvedValue(0);
    mocks.subscriptionCount.mockResolvedValue(0);
    mocks.subscriptionGroupBy.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("https://admin.locateflow.com/api/users", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null }),
    }));
  });

  it("redacts email server-side for viewer and moderator roles", async () => {
    mocks.requirePermission.mockResolvedValue({ adminId: "viewer_1", role: "VIEWER" });
    mocks.userFindMany.mockResolvedValue([
      {
        id: "user_1",
        email: "person@example.com",
        firstName: "Person",
        lastName: "Example",
        createdAt: new Date("2026-05-01T00:00:00Z"),
        deletedAt: null,
        subscription: null,
        profile: null,
        loginSessions: [],
        _count: { addresses: 0, services: 0, movingPlans: 0 },
        services: [],
      },
    ]);
    mocks.userCount.mockResolvedValue(1);
    mocks.subscriptionCount.mockResolvedValue(0);
    mocks.subscriptionGroupBy.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("https://admin.locateflow.com/api/users", { method: "GET" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users[0].email).toBe("pe***@example.com");
  });

  it("returns raw email only to admin and super admin roles", async () => {
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "ADMIN" });
    mocks.userFindMany.mockResolvedValue([
      {
        id: "user_1",
        email: "person@example.com",
        firstName: "Person",
        lastName: "Example",
        createdAt: new Date("2026-05-01T00:00:00Z"),
        deletedAt: null,
        subscription: null,
        profile: null,
        loginSessions: [],
        _count: { addresses: 0, services: 0, movingPlans: 0 },
        services: [],
      },
    ]);
    mocks.userCount.mockResolvedValue(1);
    mocks.subscriptionCount.mockResolvedValue(0);
    mocks.subscriptionGroupBy.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("https://admin.locateflow.com/api/users", { method: "GET" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users[0].email).toBe("person@example.com");
  });

  it("lists deleted users with the deleted account-state filter", async () => {
    mocks.userFindMany.mockResolvedValue([]);
    mocks.userCount.mockResolvedValue(0);
    mocks.subscriptionCount.mockResolvedValue(0);
    mocks.subscriptionGroupBy.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("https://admin.locateflow.com/api/users?status=deleted", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: { not: null } }),
    }));
  });

  it("keeps the legacy includeDeleted query as an all-users view", async () => {
    mocks.userFindMany.mockResolvedValue([]);
    mocks.userCount.mockResolvedValue(0);
    mocks.subscriptionCount.mockResolvedValue(0);
    mocks.subscriptionGroupBy.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("https://admin.locateflow.com/api/users?includeDeleted=true", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
    }));
  });

  it("skips users with PROCESSING deletion requests during bulk delete", async () => {
    const response = await DELETE(
      new NextRequest("https://admin.locateflow.com/api/users", {
        method: "DELETE",
        body: JSON.stringify({
          ids: ["user_processing", "user_new"],
          confirmPassword: "admin-password",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(1);
    expect(body.queued).toBe(1);
    expect(body.skippedProcessing).toBe(1);
    expect(body.skipped).toEqual([
      { id: "user_processing", reason: "DELETE request already processing" },
    ]);
    expect(mocks.gdprCreate).toHaveBeenCalledTimes(1);
    expect(mocks.adminAuditCreate).toHaveBeenCalledTimes(1);
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: "user_new", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("does not audit or mutate when password confirmation fails", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Incorrect password.",
    });

    const response = await DELETE(
      new NextRequest("https://admin.locateflow.com/api/users", {
        method: "DELETE",
        body: JSON.stringify({
          ids: ["user_new"],
          confirmPassword: "wrong-password",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "USER_DELETE_FAILED",
        entityType: "User",
        entityId: "bulk",
      }),
    });
  });
});
