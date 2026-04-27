import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  emailTemplateFindMany: vi.fn(),
  emailLogGroupBy: vi.fn(),
  emailLogFindMany: vi.fn(),
  emailLogCount: vi.fn(),
  emailTemplateFindUnique: vi.fn(),
  emailTemplateDelete: vi.fn(),
  adminAuditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    emailTemplate: {
      findMany: (...args: unknown[]) => mocks.emailTemplateFindMany(...args),
      findUnique: (...args: unknown[]) => mocks.emailTemplateFindUnique(...args),
      delete: (...args: unknown[]) => mocks.emailTemplateDelete(...args),
    },
    emailLog: {
      groupBy: (...args: unknown[]) => mocks.emailLogGroupBy(...args),
      findMany: (...args: unknown[]) => mocks.emailLogFindMany(...args),
      count: (...args: unknown[]) => mocks.emailLogCount(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.adminAuditCreate(...args),
    },
  },
}));

import { DELETE, GET } from "./route";

describe("email templates admin API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.emailTemplateFindMany.mockResolvedValue([
      {
        id: "tpl_verify",
        slug: "email-verify",
        name: "Email Verification",
        subject: "Verify your LocateFlow email",
        body: "<p>Verify</p>",
        category: "TRANSACTIONAL",
        variables: null,
        isActive: true,
        createdAt: new Date("2026-04-26T12:00:00Z"),
      },
      {
        id: "tpl_reset",
        slug: "password-reset",
        name: "Password Reset",
        subject: "Reset your LocateFlow password",
        body: "<p>Reset</p>",
        category: "TRANSACTIONAL",
        variables: null,
        isActive: true,
        createdAt: new Date("2026-04-26T12:01:00Z"),
      },
      {
        id: "tpl_welcome",
        slug: "welcome",
        name: "Welcome Email",
        subject: "Welcome to LocateFlow",
        body: "<p>Welcome</p>",
        category: "TRANSACTIONAL",
        variables: null,
        isActive: true,
        createdAt: new Date("2026-04-26T12:02:00Z"),
      },
    ]);
    mocks.emailLogGroupBy.mockResolvedValue([
      { templateId: "tpl_verify", status: "SENT", _count: { _all: 1 } },
      { templateId: "tpl_reset", status: "SENT", _count: { _all: 2 } },
      { templateId: "tpl_reset", status: "FAILED", _count: { _all: 1 } },
      { templateId: "tpl_welcome", status: "SENT", _count: { _all: 1 } },
      { templateId: null, status: "SENT", _count: { _all: 1 } },
    ]);
    mocks.emailLogFindMany.mockResolvedValue([
      {
        id: "log_verify",
        templateId: "tpl_verify",
        to: "new@example.com",
        subject: "Verify your LocateFlow email",
        status: "SENT",
        error: null,
        metadata: JSON.stringify({
          fromAddress: "LocateFlow <noreply@locateflow.com>",
          configError: false,
          resendApiError: false,
        }),
        sentAt: new Date("2026-04-26T12:02:00Z"),
        createdAt: new Date("2026-04-26T12:02:00Z"),
        providerMessageId: "resend_verify",
        template: { name: "Email Verification", slug: "email-verify" },
      },
      {
        id: "log_reset",
        templateId: "tpl_reset",
        to: "alice@example.com",
        subject: "Reset your LocateFlow password",
        status: "FAILED",
        error: "RESEND_API_KEY missing",
        metadata: JSON.stringify({
          fromAddress: "LocateFlow <noreply@locateflow.com>",
          configError: true,
          retryAvailable: true,
        }),
        sentAt: null,
        createdAt: new Date("2026-04-26T12:03:00Z"),
        providerMessageId: null,
        template: { name: "Password Reset", slug: "password-reset" },
      },
      {
        id: "log_welcome",
        templateId: "tpl_welcome",
        to: "new@example.com",
        subject: "Welcome to LocateFlow",
        status: "SENT",
        error: null,
        metadata: JSON.stringify({
          fromAddress: "LocateFlow <noreply@locateflow.com>",
        }),
        sentAt: new Date("2026-04-26T12:04:00Z"),
        createdAt: new Date("2026-04-26T12:04:00Z"),
        providerMessageId: "resend_welcome",
        template: { name: "Welcome Email", slug: "welcome" },
      },
    ]);
    mocks.emailLogCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);
    mocks.emailTemplateFindUnique.mockResolvedValue(null);
    mocks.emailTemplateDelete.mockResolvedValue({});
    mocks.adminAuditCreate.mockResolvedValue({});
  });

  it("returns per-template sent counts and templated send log details", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.templates).toEqual([
      expect.objectContaining({
        slug: "email-verify",
        sendCounts: { sent: 1, failed: 0, total: 1 },
        _count: { emailLogs: 1 },
      }),
      expect.objectContaining({
        slug: "password-reset",
        sendCounts: { sent: 2, failed: 1, total: 3 },
        _count: { emailLogs: 2 },
      }),
      expect.objectContaining({
        slug: "welcome",
        sendCounts: { sent: 1, failed: 0, total: 1 },
        _count: { emailLogs: 1 },
      }),
    ]);
    expect(body.logs).toEqual([
      expect.objectContaining({
        to: "ne***@example.com",
        toDomain: "example.com",
        providerMessageId: "resend_verify",
        templateIdPresent: true,
        template: { name: "Email Verification", slug: "email-verify" },
      }),
      expect.objectContaining({
        to: "al***@example.com",
        safeErrorReason: "RESEND_API_KEY missing",
        missingConfig: true,
        retryAvailable: true,
        providerMessageId: null,
        template: { name: "Password Reset", slug: "password-reset" },
      }),
      expect.objectContaining({
        to: "ne***@example.com",
        providerMessageId: "resend_welcome",
        template: { name: "Welcome Email", slug: "welcome" },
      }),
    ]);
    expect(body.stats).toEqual({
      totalTemplates: 3,
      activeTemplates: 3,
      totalSent: 4,
      totalFailed: 1,
    });
  });

  it("blocks hard delete of required default transactional templates", async () => {
    mocks.emailTemplateFindUnique.mockResolvedValue({
      id: "tpl_reset",
      slug: "password-reset",
      name: "Password Reset",
      isDefault: true,
    });

    const response = await DELETE(new Request("http://localhost/api/email-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "tpl_reset" }),
    }) as any);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("REQUIRED_TEMPLATE_DELETE_BLOCKED");
    expect(mocks.emailTemplateDelete).not.toHaveBeenCalled();
    expect(mocks.adminAuditCreate).not.toHaveBeenCalled();
  });

  it("allows hard delete of non-default optional templates", async () => {
    mocks.emailTemplateFindUnique.mockResolvedValue({
      id: "tpl_optional",
      slug: "optional-newsletter",
      name: "Optional Newsletter",
      isDefault: false,
    });

    const response = await DELETE(new Request("http://localhost/api/email-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "tpl_optional" }),
    }) as any);

    expect(response.status).toBe(200);
    expect(mocks.emailTemplateDelete).toHaveBeenCalledWith({ where: { id: "tpl_optional" } });
    expect(mocks.adminAuditCreate).toHaveBeenCalled();
  });
});
