import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  userFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  notifyUserOfAdminChange: vi.fn(),
  getAdminRuntimeConfigValue: vi.fn(),
  getInternalCallerSecret: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => mocks.userFindFirst(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));

vi.mock("@/lib/user-notify", () => ({
  notifyUserOfAdminChange: (...args: unknown[]) => mocks.notifyUserOfAdminChange(...args),
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValue: (...args: unknown[]) => mocks.getAdminRuntimeConfigValue(...args),
}));

vi.mock("@/lib/internal-secrets", () => ({
  getInternalCallerSecret: (...args: unknown[]) => mocks.getInternalCallerSecret(...args),
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/users/user_1/impersonate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

describe("admin user impersonation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "SUPER_ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.userFindFirst.mockResolvedValue({ id: "user_1", email: "person@example.com", firstName: "Person" });
    mocks.getAdminRuntimeConfigValue.mockResolvedValue("https://app.locateflow.com");
    mocks.getInternalCallerSecret.mockReturnValue("handoff-secret");
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      token: "handoff-token",
      handoffUrl: "https://app.locateflow.com/impersonate",
      expiresAt: "2026-05-11T18:00:00.000Z",
    }), { status: 200 }));
    mocks.auditCreate.mockResolvedValue({});
  });

  it("requires SUPER_ADMIN permission and MFA step-up", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({ confirmPassword: "pw" }), {
      params: Promise.resolve({ id: "user_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith("users", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1", role: "SUPER_ADMIN" },
      "pw",
      expect.objectContaining({ operation: "user_impersonation", requireMfa: true }),
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "USER_IMPERSONATION_FAILED", entityType: "User", entityId: "user_1" }),
    });
  });

  it("rejects deleted or missing targets and audits the failure", async () => {
    mocks.userFindFirst.mockResolvedValue(null);

    const response = await POST(request({ confirmPassword: "pw", mfaCode: "123456" }), {
      params: Promise.resolve({ id: "user_1" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.userFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "user_1", deletedAt: null },
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "USER_IMPERSONATION_FAILED", entityType: "User", entityId: "user_1" }),
    });
  });

  it("starts a short-lived handoff and does not audit raw email or reason", async () => {
    const response = await POST(
      request({ confirmPassword: "pw", mfaCode: "123456", reason: "Investigate billing for person@example.com" }),
      { params: Promise.resolve({ id: "user_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.handoffMethod).toBe("POST");
    expect(body.handoffToken).toBe("handoff-token");
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://app.locateflow.com/api/internal/impersonate",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"ttlMinutes":15'),
      }),
    );
    const auditCall = mocks.auditCreate.mock.calls.find(([arg]) => arg.data.action === "USER_IMPERSONATION_STARTED");
    expect(auditCall).toBeTruthy();
    expect(auditCall?.[0].data.changes).not.toContain("person@example.com");
    expect(auditCall?.[0].data.changes).not.toContain("Investigate billing");
  });
});
