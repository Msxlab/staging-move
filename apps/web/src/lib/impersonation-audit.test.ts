import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminAuditLogCreate: vi.fn().mockResolvedValue({}) as any,
  getUserSession: vi.fn() as any,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminAuditLog: {
      create: (args: any) => mocks.adminAuditLogCreate(args),
    },
  },
}));
vi.mock("@/lib/user-auth", () => ({ getUserSession: (...a: any[]) => mocks.getUserSession(...a) }));
vi.mock("@/lib/rate-limit", () => ({ resolveClientIP: () => "198.51.100.7" }));

import { recordImpersonatedMutation, auditImpersonatedMutation, blockIfImpersonating } from "./impersonation-audit";

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

describe("auditImpersonatedMutation (route helper)", () => {
  const req = new Request("https://app.locateflow.com/api/account/delete", { method: "POST" });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records, with resolved IP, when the current session is impersonated", async () => {
    mocks.getUserSession.mockResolvedValue({ userId: "user_1", sessionId: "s1", impersonatedByAdminId: "admin_42" });
    await auditImpersonatedMutation(req, { action: "account_delete", entityType: "User", entityId: "user_1", route: "/api/account/delete" });
    expect(mocks.adminAuditLogCreate).toHaveBeenCalledTimes(1);
    expect(mocks.adminAuditLogCreate.mock.calls[0][0].data).toMatchObject({
      adminUserId: "admin_42",
      action: "account_delete",
      ipAddress: "198.51.100.7",
    });
  });

  it("is a no-op when the session is not impersonated", async () => {
    mocks.getUserSession.mockResolvedValue({ userId: "user_1", sessionId: "s1", impersonatedByAdminId: null });
    await auditImpersonatedMutation(req, { action: "account_delete", entityType: "User", entityId: "user_1" });
    expect(mocks.adminAuditLogCreate).not.toHaveBeenCalled();
  });

  it("is a no-op (and never throws) when there is no session", async () => {
    mocks.getUserSession.mockResolvedValue(null);
    await expect(
      auditImpersonatedMutation(req, { action: "account_delete", entityType: "User", entityId: "user_1" }),
    ).resolves.toBeUndefined();
    expect(mocks.adminAuditLogCreate).not.toHaveBeenCalled();
  });
});

describe("blockIfImpersonating", () => {
  const req = new Request("https://locateflow.com/api/auth/password/change", { method: "PATCH" });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 403 IMPERSONATION_FORBIDDEN and records the blocked attempt when impersonating", async () => {
    mocks.getUserSession.mockResolvedValue({ userId: "user_1", sessionId: "s1", impersonatedByAdminId: "admin_9" });
    const res = await blockIfImpersonating(req, { action: "MFA_DISABLE", route: "/api/auth/mfa/disable" });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.code).toBe("IMPERSONATION_FORBIDDEN");
    // the blocked attempt itself is audited
    expect(mocks.adminAuditLogCreate).toHaveBeenCalledTimes(1);
    const data = mocks.adminAuditLogCreate.mock.calls[0][0].data;
    expect(data.adminUserId).toBe("admin_9");
    expect(data.action).toBe("BLOCK_MFA_DISABLE");
  });

  it("returns null (allows the action) for a genuine, non-impersonated session", async () => {
    mocks.getUserSession.mockResolvedValue({ userId: "user_1", sessionId: "s1", impersonatedByAdminId: null });
    const res = await blockIfImpersonating(req, { action: "MFA_DISABLE" });
    expect(res).toBeNull();
    expect(mocks.adminAuditLogCreate).not.toHaveBeenCalled();
  });

  it("returns null (fails open) when there is no session", async () => {
    mocks.getUserSession.mockResolvedValue(null);
    const res = await blockIfImpersonating(req, { action: "MFA_DISABLE" });
    expect(res).toBeNull();
  });
});
