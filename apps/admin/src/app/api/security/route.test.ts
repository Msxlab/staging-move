import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  ipRuleCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    iPRule: {
      create: (...args: unknown[]) => mocks.ipRuleCreate(...args),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    rateLimitLog: { findMany: vi.fn(), count: vi.fn() },
    gDPRRequest: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    adminAuditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/security-readiness", () => ({
  getSecurityReadinessSnapshot: vi.fn(() => Promise.resolve({})),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("https://admin.locateflow.com/api/security", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("security admin mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin-1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.ipRuleCreate.mockResolvedValue({ id: "rule-1" });
  });

  it("requires password confirmation before mutating IP rules", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Confirm your password before changing security rules.",
    });

    const response = await POST(request({
      action: "add_ip_rule",
      ipAddress: "203.0.113.10",
      type: "BLACKLIST",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ requiresPassword: true });
    expect(mocks.ipRuleCreate).not.toHaveBeenCalled();
  });
});
