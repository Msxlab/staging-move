import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveToken: vi.fn(),
  consumeToken: vi.fn(),
  adminFindUnique: vi.fn(),
  adminUpdate: vi.fn(),
  sessionUpdateMany: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/admin-invite", () => ({
  resolveSetPasswordToken: (...a: unknown[]) => mocks.resolveToken(...a),
  consumeSetPasswordToken: (...a: unknown[]) => mocks.consumeToken(...a),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: (...a: unknown[]) => mocks.adminFindUnique(...a),
      update: (...a: unknown[]) => mocks.adminUpdate(...a),
    },
    adminSession: {
      updateMany: (...a: unknown[]) => mocks.sessionUpdateMany(...a),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAdminAudit: (...a: unknown[]) => mocks.audit(...a),
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.1", userAgent: "test" }),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(() => Promise.resolve("hashed")) },
}));

import { GET, POST } from "./route";

function postReq(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/auth/set-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const STRONG = "BrandNewPass99";
const TOKEN = "t".repeat(43);

describe("admin set-password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeToken.mockResolvedValue({ id: "tok1", adminUserId: "admin_2", purpose: "INVITE", expiresAt: new Date() });
    mocks.adminFindUnique.mockResolvedValue({ id: "admin_2", email: "a@b.com", role: "ADMIN", isActive: true });
    mocks.adminUpdate.mockResolvedValue({});
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.audit.mockResolvedValue({});
  });

  it("GET reports invalid for an unknown/expired token", async () => {
    mocks.resolveToken.mockResolvedValue(null);
    const res = await GET(new NextRequest("https://admin.locateflow.com/api/auth/set-password?token=bad"));
    const body = await res.json();
    expect(body.valid).toBe(false);
  });

  it("rejects a weak password before consuming the token", async () => {
    const res = await POST(postReq({ token: TOKEN, newPassword: "short" }));
    expect(res.status).toBe(400);
    expect(mocks.consumeToken).not.toHaveBeenCalled();
  });

  it("rejects a consumed/expired token", async () => {
    mocks.consumeToken.mockResolvedValue(null);
    const res = await POST(postReq({ token: TOKEN, newPassword: STRONG }));
    expect(res.status).toBe(400);
    expect(mocks.adminUpdate).not.toHaveBeenCalled();
  });

  it("sets the password, clears the flag, revokes sessions, and audits", async () => {
    const res = await POST(postReq({ token: TOKEN, newPassword: STRONG }));
    expect(res.status).toBe(200);
    expect(mocks.adminUpdate).toHaveBeenCalledWith({
      where: { id: "admin_2" },
      data: { mustChangePassword: false, password: "hashed" },
    });
    expect(mocks.sessionUpdateMany).toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_2" }),
      expect.objectContaining({ action: "ADMIN_INVITE_COMPLETED" }),
    );
  });
});
