import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminAuditLogCreate: vi.fn().mockResolvedValue({}) as any,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminAuditLog: {
      create: (args: any) => mocks.adminAuditLogCreate(args),
    },
  },
}));

import { recordImpersonatedMutation } from "./impersonation-audit";

describe("recordImpersonatedMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes one AdminAuditLog row for an impersonated mutation", async () => {
    await recordImpersonatedMutation({
      session: {
        userId: "user_1",
        sessionId: "session_1",
        impersonatedByAdminId: "admin_42",
      },
      action: "DELETE_ADDRESS",
      entityType: "Address",
      entityId: "address_99",
      route: "/api/addresses/address_99",
      ipAddress: "203.0.113.5",
      details: { reason: "user-requested" },
    });

    expect(mocks.adminAuditLogCreate).toHaveBeenCalledTimes(1);
    const call = mocks.adminAuditLogCreate.mock.calls[0][0] as unknown as { data: any };
    expect(call.data).toMatchObject({
      adminUserId: "admin_42",
      action: "DELETE_ADDRESS",
      entityType: "Address",
      entityId: "address_99",
      ipAddress: "203.0.113.5",
    });
    expect(JSON.parse(call.data.changes)).toMatchObject({
      actor: "impersonation",
      targetUserId: "user_1",
      sessionId: "[REDACTED]",
      route: "/api/addresses/address_99",
      reason: "user-requested",
    });
  });

  it("is a no-op for non-impersonated sessions", async () => {
    await recordImpersonatedMutation({
      session: {
        userId: "user_1",
        sessionId: "session_1",
        impersonatedByAdminId: null,
      },
      action: "DELETE_ADDRESS",
      entityType: "Address",
      entityId: "address_99",
    });

    expect(mocks.adminAuditLogCreate).not.toHaveBeenCalled();
  });

  it("truncates oversized fields to fit the schema column widths", async () => {
    await recordImpersonatedMutation({
      session: {
        userId: "user_1",
        sessionId: "session_1",
        impersonatedByAdminId: "admin_42",
      },
      action: "X".repeat(50),
      entityType: "Y".repeat(200),
      entityId: "Z".repeat(100),
    });

    const call = mocks.adminAuditLogCreate.mock.calls[0][0] as unknown as { data: any };
    expect(call.data.action.length).toBe(20);
    expect(call.data.entityType.length).toBe(50);
    expect(call.data.entityId.length).toBe(30);
  });
});
