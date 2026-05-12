import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  ipRuleCreate: vi.fn(),
  ipRuleFindMany: vi.fn(),
  ipRuleFindUnique: vi.fn(),
  ipRuleUpdate: vi.fn(),
  ipRuleDelete: vi.fn(),
  gdprFindMany: vi.fn(),
  gdprFindUnique: vi.fn(),
  gdprUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    iPRule: {
      create: (...args: unknown[]) => mocks.ipRuleCreate(...args),
      findMany: (...args: unknown[]) => mocks.ipRuleFindMany(...args),
      findUnique: (...args: unknown[]) => mocks.ipRuleFindUnique(...args),
      update: (...args: unknown[]) => mocks.ipRuleUpdate(...args),
      delete: (...args: unknown[]) => mocks.ipRuleDelete(...args),
    },
    rateLimitLog: { findMany: vi.fn(), count: vi.fn() },
    gDPRRequest: {
      findMany: (...args: unknown[]) => mocks.gdprFindMany(...args),
      findUnique: (...args: unknown[]) => mocks.gdprFindUnique(...args),
      update: (...args: unknown[]) => mocks.gdprUpdate(...args),
    },
    adminAuditLog: { create: (...args: unknown[]) => mocks.auditCreate(...args) },
  },
}));

vi.mock("@/lib/security-readiness", () => ({
  getSecurityReadinessSnapshot: vi.fn(() => Promise.resolve({})),
}));

import { POST } from "./route";

const SESSION = {
  adminId: "admin-1",
  email: "admin@example.com",
  role: "SUPER_ADMIN",
  sessionId: "session-1",
};

function request(body: unknown) {
  return new Request("https://admin.locateflow.com/api/security", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "vitest",
    },
    body: JSON.stringify(body),
  }) as any;
}

function auditActions() {
  return mocks.auditCreate.mock.calls.map((call) => call[0]?.data?.action);
}

describe("security admin mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(SESSION);
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.ipRuleFindMany.mockResolvedValue([]);
    mocks.ipRuleFindUnique.mockResolvedValue(null);
    mocks.ipRuleCreate.mockResolvedValue({
      id: "rule-1",
      ipAddress: "203.0.113.20",
      type: "BLACKLIST",
      reason: null,
      expiresAt: null,
    });
    mocks.gdprFindUnique.mockResolvedValue({
      id: "gdpr-1",
      type: "EXPORT",
      status: "PENDING",
    });
    mocks.gdprUpdate.mockResolvedValue({
      id: "gdpr-1",
      type: "EXPORT",
      status: "COMPLETED",
      resultUrl: null,
    });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("requires password and MFA confirmation before mutating IP rules", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({
      action: "add_ip_rule",
      ipAddress: "203.0.113.20",
      type: "BLACKLIST",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ requiresPassword: true, requiresMfa: true });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin-1" }),
      undefined,
      expect.objectContaining({
        operation: "security_rule_mutation",
        requireMfa: true,
        ipAddress: "203.0.113.10",
        userAgent: "vitest",
      }),
    );
    expect(auditActions()).toContain("SECURITY_ACTION_FAILED");
    expect(mocks.ipRuleCreate).not.toHaveBeenCalled();
  });

  it("rejects malformed IP rule values and writes a failure audit", async () => {
    const response = await POST(request({
      action: "add_ip_rule",
      ipAddress: "not-an-ip",
      type: "BLACKLIST",
      confirmPassword: "pw",
      mfaCode: "123456",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_ip_or_cidr" });
    expect(auditActions()).toContain("IP_RULE_FAILED");
    expect(mocks.ipRuleCreate).not.toHaveBeenCalled();
  });

  it("rejects malformed CIDR values", async () => {
    const response = await POST(request({
      action: "add_ip_rule",
      ipAddress: "203.0.113.0/99",
      type: "BLACKLIST",
      confirmPassword: "pw",
      mfaCode: "123456",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_ip_or_cidr" });
    expect(auditActions()).toContain("IP_RULE_FAILED");
    expect(mocks.ipRuleCreate).not.toHaveBeenCalled();
  });

  it.each(["0.0.0.0/0", "::/0", "10.0.0.0/8", "192.168.0.0/16"])(
    "rejects overly broad IP rule range %s without break-glass",
    async (ipAddress) => {
      const response = await POST(request({
        action: "add_ip_rule",
        ipAddress,
        type: "BLACKLIST",
        confirmPassword: "pw",
        mfaCode: "123456",
      }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: "broad_range_requires_break_glass" });
      expect(auditActions()).toContain("IP_RULE_FAILED");
      expect(mocks.ipRuleCreate).not.toHaveBeenCalled();
    },
  );

  it("requires SUPER_ADMIN break-glass before creating an active whitelist", async () => {
    mocks.requirePermission.mockResolvedValue({ ...SESSION, role: "ADMIN" });

    const response = await POST(request({
      action: "add_ip_rule",
      ipAddress: "203.0.113.10",
      type: "WHITELIST",
      confirmPassword: "pw",
      mfaCode: "123456",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ reasonCode: "whitelist_requires_super_admin_break_glass" });
    expect(auditActions()).toContain("IP_RULE_FAILED");
    expect(mocks.ipRuleCreate).not.toHaveBeenCalled();
  });

  it("rejects a whitelist rule that would lock out the current request IP", async () => {
    const response = await POST(request({
      action: "add_ip_rule",
      ipAddress: "198.51.100.5",
      type: "WHITELIST",
      confirmPassword: "pw",
      mfaCode: "123456",
      breakGlass: true,
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ reasonCode: "self_lockout_prevented" });
    expect(auditActions()).toContain("IP_RULE_FAILED");
    expect(mocks.ipRuleCreate).not.toHaveBeenCalled();
  });

  it("requires MFA for toggling an IP rule", async () => {
    mocks.ipRuleFindMany.mockResolvedValue([
      { id: "rule-1", ipAddress: "203.0.113.20", type: "BLACKLIST", isActive: false, expiresAt: null },
    ]);
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({
      action: "toggle_ip_rule",
      id: "rule-1",
      confirmPassword: "pw",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ requiresMfa: true });
    expect(mocks.ipRuleUpdate).not.toHaveBeenCalled();
  });

  it("requires SUPER_ADMIN break-glass before enabling a whitelist rule", async () => {
    mocks.requirePermission.mockResolvedValue({ ...SESSION, role: "ADMIN" });
    mocks.ipRuleFindMany.mockResolvedValue([
      { id: "rule-1", ipAddress: "203.0.113.10", type: "WHITELIST", isActive: false, expiresAt: null },
    ]);

    const response = await POST(request({
      action: "toggle_ip_rule",
      id: "rule-1",
      confirmPassword: "pw",
      mfaCode: "123456",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ reasonCode: "whitelist_requires_super_admin_break_glass" });
    expect(mocks.ipRuleUpdate).not.toHaveBeenCalled();
    expect(auditActions()).toContain("IP_RULE_FAILED");
  });

  it("requires MFA before deleting an IP rule", async () => {
    mocks.ipRuleFindUnique.mockResolvedValue({
      id: "rule-1",
      ipAddress: "203.0.113.20",
      type: "BLACKLIST",
      reason: null,
    });
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({
      action: "delete_ip_rule",
      id: "rule-1",
      confirmPassword: "pw",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ requiresMfa: true });
    expect(mocks.ipRuleDelete).not.toHaveBeenCalled();
  });

  it("deletes an IP rule with password plus backup-code step-up", async () => {
    // Delete branch now reads the full rule set via findMany so it can
    // simulate the post-delete state and refuse if removing the rule
    // would lock the current request IP out (audit P0-1). For a
    // BLACKLIST rule that doesn't cover the test request IP, deletion
    // is safe and proceeds.
    mocks.ipRuleFindMany.mockResolvedValue([
      {
        id: "rule-1",
        ipAddress: "203.0.113.20",
        type: "BLACKLIST",
        isActive: true,
        expiresAt: null,
      },
    ]);
    mocks.ipRuleDelete.mockResolvedValue({});

    const response = await POST(request({
      action: "delete_ip_rule",
      id: "rule-1",
      confirmPassword: "pw",
      backupCode: "BACKUP12",
    }));

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin-1" }),
      "pw",
      expect.objectContaining({ requireMfa: true, backupCode: "BACKUP12" }),
    );
    expect(mocks.ipRuleDelete).toHaveBeenCalledWith({ where: { id: "rule-1" } });
    expect(auditActions()).toContain("IP_RULE_DELETED");
  });

  it("requires MFA for GDPR status updates", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({
      action: "update_gdpr",
      id: "gdpr-1",
      status: "COMPLETED",
      confirmPassword: "pw",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ requiresMfa: true });
    expect(mocks.gdprUpdate).not.toHaveBeenCalled();
  });
});
