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

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
    user: {
      findMany: (...args: unknown[]) => mocks.userFindMany(...args),
      updateMany: (...args: unknown[]) => mocks.userUpdateMany(...args),
      count: (...args: unknown[]) => mocks.userCount(...args),
    },
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
  },
}));

import { DELETE } from "./route";

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
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });
});
