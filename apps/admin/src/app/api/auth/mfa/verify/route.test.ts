import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  refreshSessionCookie: vi.fn(),
  adminFindUnique: vi.fn(),
  adminUpdate: vi.fn(),
  verifyTOTP: vi.fn(),
  decrypt: vi.fn(),
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  refreshSessionCookie: mocks.refreshSessionCookie,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: mocks.adminFindUnique,
      update: mocks.adminUpdate,
    },
  },
}));

vi.mock("@/lib/totp", () => ({ verifyTOTP: mocks.verifyTOTP }));
vi.mock("@/lib/shared-encryption", () => ({ decrypt: mocks.decrypt }));
vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: mocks.writeAdminAudit,
}));

import { POST } from "./route";

const SESSION = {
  adminId: "admin_1",
  email: "admin@example.com",
  role: "SUPER_ADMIN",
  sessionId: "session_1",
};

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/auth/mfa/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "vitest",
    },
    body: JSON.stringify(body),
  });
}

describe("admin MFA verify route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(SESSION);
    mocks.adminFindUnique.mockResolvedValue({ mfaSecret: "encrypted-secret", mfaEnabled: false });
    mocks.adminUpdate.mockResolvedValue({});
    mocks.decrypt.mockReturnValue("totp-secret");
    mocks.verifyTOTP.mockReturnValue(true);
    mocks.refreshSessionCookie.mockResolvedValue("new-session-token");
    mocks.writeAdminAudit.mockResolvedValue(undefined);
  });

  it("enables MFA and returns no-store headers", async () => {
    const response = await POST(request({ code: "123456" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(body).toMatchObject({ success: true });
    expect(mocks.adminUpdate).toHaveBeenCalledWith({
      where: { id: "admin_1" },
      data: { mfaEnabled: true, mfaVerifiedAt: expect.any(Date) },
    });
    expect(mocks.refreshSessionCookie).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      { mfaEnabled: true },
    );
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      expect.objectContaining({ action: "MFA_ENABLED" }),
    );
  });
});
