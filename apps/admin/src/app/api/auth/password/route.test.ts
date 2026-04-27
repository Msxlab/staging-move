import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(() => Promise.resolve(true)),
    hash: vi.fn(() => Promise.resolve("new-admin-hash")),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminSession: {
      updateMany: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(() => Promise.resolve({ adminId: "admin_1", email: "admin@example.com", role: "SUPER_ADMIN" })),
  expireAdminSessionCookies: vi.fn((response) => response),
}));

import { prisma } from "@/lib/db";
import { expireAdminSessionCookies } from "@/lib/auth";
import { PATCH } from "./route";

const adminUserMock = prisma.adminUser as unknown as { findUnique: Mock; update: Mock };
const adminSessionMock = prisma.adminSession as unknown as { updateMany: Mock };
const expireAdminSessionCookiesMock = expireAdminSessionCookies as unknown as Mock;

function makeRequest() {
  return new NextRequest("https://admin.locateflow.com/api/auth/password", {
    method: "PATCH",
    headers: { "content-type": "application/json", host: "admin.locateflow.com" },
    body: JSON.stringify({
      currentPassword: "Current-Password-2026!",
      newPassword: "New-Password-2026!",
    }),
  });
}

describe("admin password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminUserMock.findUnique.mockResolvedValue({ id: "admin_1", password: "old-hash" });
    adminUserMock.update.mockResolvedValue({});
    adminSessionMock.updateMany.mockResolvedValue({ count: 2 });
  });

  it("invalidates active admin sessions and expires the cookie after password change", async () => {
    const response = await PATCH(makeRequest());

    expect(response.status).toBe(200);
    expect(adminSessionMock.updateMany).toHaveBeenCalledWith({
      where: { adminUserId: "admin_1", isActive: true },
      data: { isActive: false, lastActivity: expect.any(Date) },
    });
    expect(expireAdminSessionCookiesMock).toHaveBeenCalledWith(response, "admin.locateflow.com");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
