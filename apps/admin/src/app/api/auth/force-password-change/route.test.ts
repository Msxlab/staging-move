import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(() => Promise.resolve(false)),
    hash: vi.fn(() => Promise.resolve("new-admin-hash")),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => Promise.resolve({
    adminId: "admin_1",
    email: "admin@example.com",
    role: "ADMIN",
    mustChangePassword: false,
  })),
  refreshSessionCookie: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: vi.fn(() => ({ ipAddress: "127.0.0.1", userAgent: "vitest" })),
  writeAdminAudit: vi.fn(() => Promise.resolve()),
}));

import { prisma } from "@/lib/db";
import { refreshSessionCookie } from "@/lib/auth";
import { writeAdminAudit } from "@/lib/audit";
import { POST } from "./route";

const adminUserMock = prisma.adminUser as unknown as { findUnique: Mock; update: Mock };
const refreshSessionCookieMock = refreshSessionCookie as unknown as Mock;
const writeAdminAuditMock = writeAdminAudit as unknown as Mock;

function makeRequest() {
  return new NextRequest("https://admin.locateflow.com/api/auth/force-password-change", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newPassword: "New-Password-2026!" }),
  });
}

describe("admin force-password-change route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminUserMock.findUnique.mockResolvedValue({
      id: "admin_1",
      email: "admin@example.com",
      role: "ADMIN",
      isActive: true,
      mustChangePassword: true,
      password: "old-hash",
    });
    adminUserMock.update.mockResolvedValue({});
  });

  it("rejects normal admin sessions that are not flagged for forced rotation", async () => {
    adminUserMock.findUnique.mockResolvedValueOnce({
      id: "admin_1",
      email: "admin@example.com",
      role: "ADMIN",
      isActive: true,
      mustChangePassword: false,
      password: "old-hash",
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Forced password rotation is not required for this account.",
    });
    expect(adminUserMock.update).not.toHaveBeenCalled();
    expect(refreshSessionCookieMock).not.toHaveBeenCalled();
    expect(writeAdminAuditMock).toHaveBeenCalledWith(
      { adminId: "admin_1", email: "admin@example.com", role: "ADMIN" },
      expect.objectContaining({
        action: "ADMIN_FORCED_PASSWORD_ROTATION_REJECTED",
        metadata: expect.objectContaining({ reason: "not_flagged_for_forced_rotation" }),
      }),
    );
  });

  it("rotates the password for flagged admins and clears the session gate", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(adminUserMock.update).toHaveBeenCalledWith({
      where: { id: "admin_1" },
      data: { mustChangePassword: false, password: "new-admin-hash" },
    });
    expect(refreshSessionCookieMock).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      { mustChangePassword: false },
    );
  });
});
