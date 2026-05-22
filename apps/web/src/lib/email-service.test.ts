import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emailTemplateFindUnique: vi.fn(),
  emailLogCreate: vi.fn(),
  emailLogFindFirst: vi.fn(),
  emailLogUpdateMany: vi.fn(),
  emailLogUpdate: vi.fn(),
  sendEmailWithResult: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    emailTemplate: {
      findUnique: (...args: unknown[]) => mocks.emailTemplateFindUnique(...args),
    },
    emailLog: {
      create: (...args: unknown[]) => mocks.emailLogCreate(...args),
      findFirst: (...args: unknown[]) => mocks.emailLogFindFirst(...args),
      updateMany: (...args: unknown[]) => mocks.emailLogUpdateMany(...args),
      update: (...args: unknown[]) => mocks.emailLogUpdate(...args),
    },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => mocks.getRuntimeConfigValue(...args),
}));

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...actual,
    sendEmailWithResult: (...args: unknown[]) => mocks.sendEmailWithResult(...args),
  };
});

import {
  sendEmailVerificationEmail,
  sendLoggedEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "./email-service";

describe("email-service logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRuntimeConfigValue.mockResolvedValue("https://locateflow.com");
    mocks.emailTemplateFindUnique.mockImplementation(({ where }: any) => {
      if (where.slug === "welcome") {
        return Promise.resolve({
          id: "tpl_welcome",
          slug: "welcome",
          subject: "Welcome to LocateFlow",
          body: '<p>Hi <strong>{{firstName}}</strong></p><a href="{{dashboardLink}}">Open Dashboard</a>',
          isActive: true,
        });
      }
      if (where.slug === "email-verify") return Promise.resolve({ id: "tpl_verify" });
      if (where.slug === "password-reset") return Promise.resolve({ id: "tpl_reset" });
      return Promise.resolve(null);
    });
    mocks.emailLogCreate.mockResolvedValue({ id: "log_1" });
    mocks.emailLogUpdate.mockResolvedValue({});
    mocks.sendEmailWithResult.mockResolvedValue({
      success: true,
      providerMessageId: "resend_123",
      error: null,
      fromEmail: "LocateFlow <notifications@locateflow.com>",
    });
  });

  it("links email verification sends to the Email Verification template", async () => {
    const result = await sendEmailVerificationEmail({
      userEmail: "new@example.com",
      userName: "New",
      verifyToken: "verify-token",
      dedupeKey: "verify:user:token",
    });

    expect(result).toBe(true);
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "tpl_verify",
        to: "new@example.com",
        subject: "Verify your LocateFlow email",
        status: "PENDING",
      }),
    });
    expect(JSON.parse(mocks.emailLogCreate.mock.calls[0][0].data.metadata)).toEqual(
      expect.objectContaining({
        kind: "email-verification",
        templateSlug: "email-verify",
      }),
    );
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Verify Email: https://locateflow.com/verify-email/verify-token"),
      }),
    );
    expect(mocks.emailLogUpdate).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({
        status: "SENT",
        providerMessageId: "resend_123",
        sentAt: expect.any(Date),
      }),
    });
  });

  it("links password reset sends to the Password Reset template", async () => {
    const result = await sendPasswordResetEmail({
      userEmail: "alice@example.com",
      userName: "Alice",
      resetToken: "reset-token",
      dedupeKey: "pwreset:user:token",
    });

    expect(result).toBe(true);
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "tpl_reset",
        to: "alice@example.com",
        subject: "Reset your LocateFlow password",
      }),
    });
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Reset Password: https://locateflow.com/reset-password/reset-token"),
      }),
    );
  });

  it("does not couple password reset delivery to the DB template row", async () => {
    mocks.emailTemplateFindUnique.mockResolvedValue(null);
    mocks.sendEmailWithResult.mockResolvedValue({
      success: false,
      providerMessageId: null,
      error: "EMAIL_FROM domain is not verified",
      configError: true,
      fromEmail: "LocateFlow <notifications@locateflow.com>",
    });

    const result = await sendPasswordResetEmail({
      userEmail: "alice@example.com",
      userName: "Alice",
      resetToken: "reset-token",
      dedupeKey: "pwreset:user:provider-failed",
    });

    expect(result).toBe(false);
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Reset your LocateFlow password",
        text: expect.stringContaining("Reset Password: https://locateflow.com/reset-password/reset-token"),
      }),
    );
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: null,
        status: "PENDING",
        subject: "Reset your LocateFlow password",
      }),
    });
    expect(mocks.emailLogUpdate).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({
        status: "FAILED",
        error: "EMAIL_FROM domain is not verified",
      }),
    });
    expect(JSON.parse(mocks.emailLogUpdate.mock.calls[0][0].data.metadata)).toEqual(
      expect.objectContaining({
        configError: true,
        retryAvailable: true,
        templateSlug: "password-reset",
      }),
    );
  });

  it("links welcome sends to the Welcome template with a text fallback", async () => {
    const result = await sendWelcomeEmail({
      email: "new@example.com",
      firstName: "New",
      dedupeKey: "welcome:user-new",
    });

    expect(result).toBe(true);
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "tpl_welcome",
        to: "new@example.com",
        subject: "Welcome to LocateFlow",
        status: "PENDING",
      }),
    });
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Open Dashboard: https://locateflow.com/dashboard"),
      }),
    );
  });

  it("records failed sends with safe error details", async () => {
    mocks.emailTemplateFindUnique.mockResolvedValue({ id: "tpl_reset" });
    mocks.sendEmailWithResult.mockResolvedValue({
      success: false,
      providerMessageId: null,
      error: "Resend rejected the message [redacted]",
      fromEmail: "LocateFlow <notifications@locateflow.com>",
    });

    const result = await sendLoggedEmail({
      to: "alice@example.com",
      subject: "Reset your LocateFlow password",
      html: "<p>Reset</p>",
      text: "Reset",
      templateSlug: "password-reset",
      dedupeKey: "pwreset:user:failed",
    });

    expect(result).toEqual({ success: false, skipped: false });
    expect(mocks.emailLogUpdate).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({
        status: "FAILED",
        error: "Resend rejected the message [redacted]",
        providerMessageId: null,
        sentAt: null,
      }),
    });
    expect(JSON.parse(mocks.emailLogUpdate.mock.calls[0][0].data.metadata)).toEqual(
      expect.objectContaining({
        fromAddress: "LocateFlow <notifications@locateflow.com>",
        resendApiError: true,
        retryAvailable: true,
      }),
    );
  });

  it("falls back to inline welcome content when the Welcome template is unavailable", async () => {
    mocks.emailTemplateFindUnique.mockResolvedValue(null);

    const result = await sendWelcomeEmail({
      email: "new@example.com",
      firstName: "New",
      dedupeKey: "welcome:user-missing-template",
    });

    expect(result).toBe(true);
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: null,
        dedupeKey: "welcome:user-missing-template",
        to: "new@example.com",
        subject: "Welcome to LocateFlow",
        status: "PENDING",
      }),
    });
    expect(JSON.parse(mocks.emailLogCreate.mock.calls[0][0].data.metadata)).toEqual(
      expect.objectContaining({
        kind: "welcome",
        templateSlug: "welcome",
        templateUnavailable: true,
      }),
    );
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Welcome to LocateFlow"),
        text: expect.stringContaining("Open Dashboard: https://locateflow.com/dashboard"),
      }),
    );
  });

  it("allowlists EmailLog metadata and strips sensitive keys", async () => {
    await sendLoggedEmail({
      to: "alice@example.com",
      subject: "Reset your LocateFlow password",
      html: "<p>Reset</p>",
      text: "Reset",
      templateSlug: "password-reset",
      metadata: {
        kind: "password-reset",
        userId: "user_1",
        serviceId: "svc_1",
        resetToken: "secret-reset-token",
        cookie: "session-cookie",
        arbitrary: "drop-me",
      },
    });

    const metadata = JSON.parse(mocks.emailLogCreate.mock.calls[0][0].data.metadata);
    expect(metadata).toEqual({
      kind: "password-reset",
      userId: "user_1",
      serviceId: "svc_1",
      templateSlug: "password-reset",
    });
  });
});
