import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  emailTemplateFindMany: vi.fn(),
  emailLogGroupBy: vi.fn(),
  emailLogFindMany: vi.fn(),
  emailLogCount: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    emailTemplate: {
      findMany: (...args: unknown[]) => mocks.emailTemplateFindMany(...args),
    },
    emailLog: {
      groupBy: (...args: unknown[]) => mocks.emailLogGroupBy(...args),
      findMany: (...args: unknown[]) => mocks.emailLogFindMany(...args),
      count: (...args: unknown[]) => mocks.emailLogCount(...args),
    },
  },
}));

import { GET } from "./route";

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
        to: "new@example.com",
        subject: "Verify your LocateFlow email",
        status: "SENT",
        sentAt: new Date("2026-04-26T12:02:00Z"),
        createdAt: new Date("2026-04-26T12:02:00Z"),
        providerMessageId: "resend_verify",
        template: { name: "Email Verification", slug: "email-verify" },
      },
      {
        id: "log_reset",
        to: "alice@example.com",
        subject: "Reset your LocateFlow password",
        status: "SENT",
        sentAt: new Date("2026-04-26T12:03:00Z"),
        createdAt: new Date("2026-04-26T12:03:00Z"),
        providerMessageId: "resend_reset",
        template: { name: "Password Reset", slug: "password-reset" },
      },
      {
        id: "log_welcome",
        to: "new@example.com",
        subject: "Welcome to LocateFlow",
        status: "SENT",
        sentAt: new Date("2026-04-26T12:04:00Z"),
        createdAt: new Date("2026-04-26T12:04:00Z"),
        providerMessageId: "resend_welcome",
        template: { name: "Welcome Email", slug: "welcome" },
      },
    ]);
    mocks.emailLogCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);
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
        to: "new@example.com",
        providerMessageId: "resend_verify",
        template: { name: "Email Verification", slug: "email-verify" },
      }),
      expect.objectContaining({
        to: "alice@example.com",
        providerMessageId: "resend_reset",
        template: { name: "Password Reset", slug: "password-reset" },
      }),
      expect.objectContaining({
        to: "new@example.com",
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
});
