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
  sendBillOverdueEmail,
  sendBillReminderEmail,
  sendContractReminderEmail,
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

  // SEC-KILL: KILL_OUTBOUND_EMAIL operator kill switch.
  it("marks the EmailLog row SKIPPED with reason kill_switch when the send is suppressed", async () => {
    mocks.emailTemplateFindUnique.mockResolvedValue({ id: "tpl_reset" });
    mocks.sendEmailWithResult.mockResolvedValue({
      success: false,
      providerMessageId: null,
      error: "kill_switch",
      fromEmail: null,
      killSwitch: true,
    });

    const result = await sendLoggedEmail({
      to: "alice@example.com",
      subject: "Reset your LocateFlow password",
      html: "<p>Reset</p>",
      text: "Reset",
      templateSlug: "password-reset",
      dedupeKey: "pwreset:user:kill-switch",
    });

    expect(result).toEqual({ success: false, skipped: false });
    expect(mocks.emailLogUpdate).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({
        status: "SKIPPED",
        error: "kill_switch",
        providerMessageId: null,
        sentAt: null,
      }),
    });
    expect(JSON.parse(mocks.emailLogUpdate.mock.calls[0][0].data.metadata)).toEqual(
      expect.objectContaining({ retryAvailable: true }),
    );
  });

  it("re-claims a SKIPPED dedupe row so suppressed emails are retryable after the switch is lifted", async () => {
    mocks.emailTemplateFindUnique.mockResolvedValue({ id: "tpl_reset" });
    mocks.emailLogCreate.mockRejectedValue({ code: "P2002" });
    mocks.emailLogFindFirst.mockResolvedValue({ id: "log_skipped", status: "SKIPPED" });
    mocks.emailLogUpdateMany.mockResolvedValue({ count: 1 });

    const result = await sendLoggedEmail({
      to: "alice@example.com",
      subject: "Reset your LocateFlow password",
      html: "<p>Reset</p>",
      text: "Reset",
      templateSlug: "password-reset",
      dedupeKey: "pwreset:user:kill-switch",
    });

    expect(result).toEqual({ success: true, skipped: false });
    expect(mocks.emailLogUpdateMany).toHaveBeenCalledWith({
      where: { id: "log_skipped", status: { in: ["FAILED", "SKIPPED"] } },
      data: expect.objectContaining({ status: "PENDING", error: null }),
    });
    // The re-claimed row goes through the normal send + SENT update.
    expect(mocks.sendEmailWithResult).toHaveBeenCalled();
    expect(mocks.emailLogUpdate).toHaveBeenCalledWith({
      where: { id: "log_skipped" },
      data: expect.objectContaining({ status: "SENT" }),
    });
  });

  it("does not resend a dedupe-key match that already SENT", async () => {
    mocks.emailTemplateFindUnique.mockResolvedValue({ id: "tpl_reset" });
    mocks.emailLogCreate.mockRejectedValue({ code: "P2002" });
    mocks.emailLogFindFirst.mockResolvedValue({ id: "log_sent", status: "SENT" });

    const result = await sendLoggedEmail({
      to: "alice@example.com",
      subject: "Reset your LocateFlow password",
      html: "<p>Reset</p>",
      text: "Reset",
      templateSlug: "password-reset",
      dedupeKey: "pwreset:user:already-sent",
    });

    expect(result).toEqual({ success: true, skipped: true });
    expect(mocks.sendEmailWithResult).not.toHaveBeenCalled();
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

  it("routes bill reminders through the Bill Reminder DB template when present", async () => {
    mocks.emailTemplateFindUnique.mockImplementation(({ where }: any) =>
      where.slug === "bill-reminder"
        ? Promise.resolve({
            id: "tpl_bill",
            slug: "bill-reminder",
            subject: "Bill reminder: {{serviceName}} - ${{amount}} due {{dueText}}",
            body: "<p>BILL_TPL_MARKER Hi <strong>{{firstName}}</strong> bill due {{dueText}}</p>",
            isActive: true,
          })
        : Promise.resolve(null),
    );

    const result = await sendBillReminderEmail({
      userEmail: "sam@example.com",
      userName: "Sam",
      serviceName: "Netflix",
      category: "Streaming",
      amount: 12.34,
      dueDate: "June 5, 2026",
      daysUntilDue: 3,
      dedupeKey: "bill:svc:3",
    });

    expect(result).toBe(true);
    // Admin-editable template row is linked, and its rendered subject (with the
    // {{amount}}/{{dueText}} placeholders filled) is what gets sent.
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "tpl_bill",
        to: "sam@example.com",
        subject: "Bill reminder: Netflix - $12.34 due in 3 days",
        status: "PENDING",
      }),
    });
    // The DB template body — not the inline billReminderHtml builder — produced
    // the email, so admin edits to the template take effect.
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("BILL_TPL_MARKER Hi <strong>Sam</strong> bill due in 3 days"),
      }),
    );
  });

  it("falls back to inline bill reminder content when the template is unavailable", async () => {
    // beforeEach default already resolves the bill-reminder slug to null.
    const result = await sendBillReminderEmail({
      userEmail: "sam@example.com",
      userName: "Sam",
      serviceName: "Netflix",
      category: "Streaming",
      amount: 12.34,
      dueDate: "June 5, 2026",
      daysUntilDue: 1,
      dedupeKey: "bill:svc:1",
    });

    expect(result).toBe(true);
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: null,
        to: "sam@example.com",
        // 1-day case stays grammatical ("due in 1 day", never "in 1 days").
        subject: "Bill reminder: Netflix - $12.34 due in 1 day",
        status: "PENDING",
      }),
    });
    expect(JSON.parse(mocks.emailLogCreate.mock.calls[0][0].data.metadata)).toEqual(
      expect.objectContaining({
        kind: "bill-reminder",
        templateSlug: "bill-reminder",
        templateUnavailable: true,
      }),
    );
    // Inline builder still rendered a complete, sendable email.
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Netflix"),
      }),
    );
  });

  it("routes contract reminders through the Contract Reminder DB template when present", async () => {
    mocks.emailTemplateFindUnique.mockImplementation(({ where }: any) =>
      where.slug === "contract-reminder"
        ? Promise.resolve({
            id: "tpl_contract",
            slug: "contract-reminder",
            subject: "{{serviceName}} contract ends in {{timeRemaining}}",
            body: "<p>CONTRACT_TPL_MARKER Hi <strong>{{firstName}}</strong> ends in {{timeRemaining}}</p>",
            isActive: true,
          })
        : Promise.resolve(null),
    );

    const result = await sendContractReminderEmail({
      userEmail: "sam@example.com",
      userName: "Sam",
      serviceName: "Verizon",
      contractEndDate: "July 1, 2026",
      daysRemaining: 7,
      serviceLink: "https://locateflow.com/services/svc_1",
      dedupeKey: "contract:svc:7",
    });

    expect(result).toBe(true);
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "tpl_contract",
        to: "sam@example.com",
        subject: "Verizon contract ends in 7 days",
        status: "PENDING",
      }),
    });
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("CONTRACT_TPL_MARKER Hi <strong>Sam</strong> ends in 7 days"),
      }),
    );
  });

  it("falls back to inline contract reminder content when the template is unavailable", async () => {
    const result = await sendContractReminderEmail({
      userEmail: "sam@example.com",
      userName: "Sam",
      serviceName: "Verizon",
      contractEndDate: "July 1, 2026",
      daysRemaining: 1,
      serviceLink: "https://locateflow.com/services/svc_1",
      dedupeKey: "contract:svc:1",
    });

    expect(result).toBe(true);
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: null,
        to: "sam@example.com",
        // 1-day case stays grammatical ("in 1 day", never "in 1 days").
        subject: "Verizon contract ends in 1 day",
        status: "PENDING",
      }),
    });
    expect(JSON.parse(mocks.emailLogCreate.mock.calls[0][0].data.metadata)).toEqual(
      expect.objectContaining({
        kind: "contract-reminder",
        templateSlug: "contract-reminder",
        templateUnavailable: true,
      }),
    );
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Verizon"),
      }),
    );
  });

  it("routes overdue-bill notices through the Bill Overdue DB template when present", async () => {
    mocks.emailTemplateFindUnique.mockImplementation(({ where }: any) =>
      where.slug === "bill-overdue"
        ? Promise.resolve({
            id: "tpl_overdue",
            slug: "bill-overdue",
            subject: "Overdue bill: {{serviceName}}",
            body: "<p>OVERDUE_TPL_MARKER {{serviceName}} is {{overdueText}}</p><a href=\"{{reviewLink}}\">Review</a>",
            isActive: true,
          })
        : Promise.resolve(null),
    );

    const result = await sendBillOverdueEmail({
      userEmail: "sam@example.com",
      userName: "Sam",
      serviceName: "Comcast",
      category: "Internet",
      amount: 59.99,
      dueDate: "May 1, 2026",
      daysOverdue: 5,
      serviceId: "svc_42",
      dedupeKey: "overdue:svc:5",
    });

    expect(result).toBe(true);
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "tpl_overdue",
        to: "sam@example.com",
        subject: "Overdue bill: Comcast",
        status: "PENDING",
      }),
    });
    // The DB template rendered, and the conditional CTA href resolved to the
    // specific service (serviceId present).
    expect(mocks.sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("OVERDUE_TPL_MARKER Comcast is 5 days overdue"),
      }),
    );
    expect(mocks.sendEmailWithResult.mock.calls[0][0].html).toContain("https://locateflow.com/services/svc_42");
  });

  it("falls back to inline overdue-bill content when the template is unavailable", async () => {
    const result = await sendBillOverdueEmail({
      userEmail: "sam@example.com",
      userName: "Sam",
      serviceName: "Comcast",
      category: "Internet",
      amount: 59.99,
      dueDate: "May 1, 2026",
      daysOverdue: 1,
      dedupeKey: "overdue:svc:1",
    });

    expect(result).toBe(true);
    expect(mocks.emailLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: null,
        to: "sam@example.com",
        subject: "Overdue bill: Comcast",
        status: "PENDING",
      }),
    });
    expect(JSON.parse(mocks.emailLogCreate.mock.calls[0][0].data.metadata)).toEqual(
      expect.objectContaining({
        kind: "bill-overdue",
        templateSlug: "bill-overdue",
        templateUnavailable: true,
      }),
    );
    // Inline builder rendered the body (grammatical "1 day overdue").
    expect(mocks.sendEmailWithResult.mock.calls[0][0].html).toContain("1 day overdue");
  });
});
