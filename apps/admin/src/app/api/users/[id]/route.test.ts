import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  subscriptionUpdate: vi.fn(),
  subscriptionCreate: vi.fn(),
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

vi.mock("@/lib/db", () => {
  const prisma = {
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
      update: (...args: unknown[]) => mocks.userUpdate(...args),
      updateMany: (...args: unknown[]) => mocks.userUpdateMany(...args),
    },
    subscription: {
      update: (...args: unknown[]) => mocks.subscriptionUpdate(...args),
      create: (...args: unknown[]) => mocks.subscriptionCreate(...args),
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
  };
  // Soft-delete-aware default + raw escape hatch share the same mock
  // surface in tests.
  return { prisma, prismaUnsafe: prisma, rawPrisma: prisma };
});

vi.mock("@/lib/user-notify", () => ({
  notifyUserOfAdminChange: vi.fn(),
}));

import { DELETE, PATCH, POST } from "./route";

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
    mocks.userUpdate.mockResolvedValue({});
    mocks.subscriptionUpdate.mockResolvedValue({});
    mocks.subscriptionCreate.mockResolvedValue({});
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

describe("admin user detail billing updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.userFindUnique.mockResolvedValue({
      id: "user_1",
      firstName: "Person",
      lastName: "Example",
      subscription: {
        plan: "FREE_TRIAL",
        status: "TRIALING",
        premiumUntil: null,
        trialEndsAt: null,
      },
    });
    mocks.subscriptionUpdate.mockResolvedValue({});
    mocks.subscriptionCreate.mockResolvedValue({});
    mocks.adminAuditCreate.mockResolvedValue({});
  });

  it("requires password confirmation before admin subscription and premium edits", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Password confirmation required for this operation.",
    });

    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "INDIVIDUAL" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresPassword).toBe(true);
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });

  it("audits admin subscription and premium edits after password confirmation", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({
          plan: "INDIVIDUAL",
          subscriptionStatus: "ACTIVE",
          premiumUntil: "2026-05-27",
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1" },
      "admin-password",
      { operation: "billing_subscription_update" },
    );
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        premiumUntil: expect.any(Date),
        premiumGrantedBy: "admin_1",
        premiumGrantedAt: expect.any(Date),
      }),
    });
    expect(mocks.adminAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "admin_1",
        action: "UPDATE_USER",
        entityType: "User",
        entityId: "user_1",
        ipAddress: "203.0.113.10",
      }),
    });
  });

  it("rejects unsupported plan values", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: "FAMILY",
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });

  it("accepts FREE_ACCESS as a valid status (round-trips the dropdown)", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriptionStatus: "FREE_ACCESS",
          freeAccessEndsAt: "2026-12-01",
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.subscriptionUpdate).toHaveBeenCalled();
  });

  it("rejects accessType=PAID against provider=ADMIN", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accessType: "PAID",
          provider: "ADMIN",
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_BILLING_COMBINATION");
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });

  it("rejects status=ACTIVE on provider=ADMIN without premiumUntil", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriptionStatus: "ACTIVE",
          provider: "ADMIN",
          premiumUntil: null,
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_BILLING_COMBINATION");
  });

  it("rejects autoRenew=true and cancelAtPeriodEnd=true together", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          autoRenew: true,
          cancelAtPeriodEnd: true,
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_BILLING_COMBINATION");
  });

  it("derives autoRenew when admin sets cancelAtPeriodEnd alone", async () => {
    const response = await PATCH(
      new NextRequest("https://admin.locateflow.com/api/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cancelAtPeriodEnd: true,
          confirmPassword: "admin-password",
        }),
      }),
      { params: Promise.resolve({ id: "user_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: expect.objectContaining({
        cancelAtPeriodEnd: true,
        autoRenew: false,
      }),
    });
  });
});
