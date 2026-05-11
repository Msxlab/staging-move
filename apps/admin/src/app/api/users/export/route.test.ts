import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  userFindMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => {
  const prisma = {
    user: {
      findMany: (...args: unknown[]) => mocks.userFindMany(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  };
  return { prisma, prismaUnsafe: prisma };
});

import { POST } from "./route";

function request(body: Record<string, unknown> = {}) {
  return new NextRequest("https://admin.locateflow.com/api/users/export", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

describe("admin users CSV export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.userFindMany.mockResolvedValue([
      {
        id: "user_1",
        email: "person@example.com",
        firstName: "=Formula",
        lastName: "+Injection",
        createdAt: new Date("2026-05-01T00:00:00Z"),
        deletedAt: null,
        subscription: { plan: "INDIVIDUAL", status: "ACTIVE" },
      },
    ]);
    mocks.auditCreate.mockResolvedValue({});
  });

  it("requires ADMIN floor and MFA step-up before exporting", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({ confirmPassword: "pw" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith("users", "canRead", { minimumRole: "ADMIN" });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1", role: "ADMIN" },
      "pw",
      expect.objectContaining({ operation: "users_export", requireMfa: true }),
    );
    expect(mocks.userFindMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "USER_EXPORT_FAILED", entityType: "User", entityId: "bulk" }),
    });
  });

  it("exports only selected safe fields, escapes CSV injection, and audits success", async () => {
    const response = await POST(request({ confirmPassword: "pw", mfaCode: "123456" }));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 50000,
      select: expect.not.objectContaining({
        passwordHash: true,
        mfaSecret: true,
        mfaBackupCodes: true,
        sessions: true,
        passwordResetTokens: true,
      }),
    }));
    expect(csv).toContain("'=Formula");
    expect(csv).toContain("'+Injection");
    expect(csv).not.toContain("passwordHash");
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "USER_EXPORT_CREATED", entityType: "User", entityId: "bulk" }),
    });
  });

  it("blocks lower roles through the route permission gate", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("FORBIDDEN"));

    const response = await POST(request({ confirmPassword: "pw", mfaCode: "123456" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });
});
