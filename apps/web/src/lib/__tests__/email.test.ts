import { beforeEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resendSend: vi.fn(),
  runtimeConfigValues: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function Resend() {
    return {
      emails: {
        send: (...args: unknown[]) => mocks.resendSend(...args),
      },
    };
  }),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRequiredRuntimeConfigValues: (...args: unknown[]) => mocks.runtimeConfigValues(...args),
}));

import {
  billReminderHtml,
  contractReminderHtml,
  emailVerificationContent,
  sendEmailWithResult,
  weeklyDigestHtml,
} from "../email";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.APP_ENV;
  delete process.env.VERCEL_ENV;
  delete process.env.DIGITALOCEAN_APP_ID;
  process.env.RESEND_API_KEY = "test-resend-api-key-for-redaction";
  mocks.runtimeConfigValues.mockImplementation(async (keys: string[]) => {
    const values: Record<string, string | null> = {
      RESEND_API_KEY: "test-resend-api-key-for-redaction",
      EMAIL_FROM: "LocateFlow <noreply@locateflow.com>",
      NEXT_PUBLIC_APP_URL: "https://locateflow.com",
      SUPPORT_EMAIL: "support@locateflow.com",
      EMAIL_REPLY_TO: null,
    };
    return Object.fromEntries(keys.map((key) => [key, values[key] || null]));
  });
  mocks.resendSend.mockResolvedValue({ data: { id: "resend_123" }, error: null });
});

describe("billReminderHtml", () => {
  const data = {
    userName: "John Doe",
    serviceName: "Austin Energy",
    category: "UTILITY ELECTRIC",
    amount: 125.5,
    dueDate: "Mar 15, 2025",
    daysUntilDue: 3,
  };

  it("should contain the user name", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("John Doe");
  });

  it("should contain the service name", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("Austin Energy");
  });

  it("should contain the formatted amount", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("$125.50");
  });

  it("should contain the due date", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("Mar 15, 2025");
  });

  it("should show 'today' when daysUntilDue is 0", () => {
    const html = billReminderHtml({ ...data, daysUntilDue: 0 });
    expect(html).toContain("today");
  });

  it("should show correct plural for days", () => {
    const html3 = billReminderHtml({ ...data, daysUntilDue: 3 });
    expect(html3).toContain("3 days");

    const html1 = billReminderHtml({ ...data, daysUntilDue: 1 });
    expect(html1).toContain("1 day");
    expect(html1).not.toContain("1 days");
  });

  it("should contain View Services link", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("/services");
  });

  it("should be valid HTML structure", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });
});

describe("weeklyDigestHtml", () => {
  const data = {
    userName: "Jane Smith",
    weekStart: "Mar 1",
    weekEnd: "Mar 7",
    upcomingBills: [
      { name: "Electric", amount: 100, dueDate: "Mar 10" },
      { name: "Internet", amount: 59.99, dueDate: "Mar 12" },
    ],
    totalExpenses: 450.0,
    newServices: 2,
  };

  it("should contain the user name", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("Jane Smith");
  });

  it("should contain the date range", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("Mar 1");
    expect(html).toContain("Mar 7");
  });

  it("should contain monthly expenses", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("450");
    expect(html).toContain(">2<"); // newServices
  });

  it("should contain upcoming bills table", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("Electric");
    expect(html).toContain("$100.00");
    expect(html).toContain("Internet");
    expect(html).toContain("$59.99");
  });

  it("should contain total expenses", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("$450");
  });

  it("should hide bills section when empty", () => {
    const html = weeklyDigestHtml({ ...data, upcomingBills: [] });
    expect(html).not.toContain("Upcoming Bills");
  });

  it("should contain Open Dashboard link", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("/dashboard");
  });
});

describe("contractReminderHtml", () => {
  const data = {
    userName: "Sam Taylor",
    serviceName: "Spectrum Internet",
    contractEndDate: "Apr 10, 2026",
    daysRemaining: 14,
    serviceLink: "http://localhost:3000/services/abc123",
  };

  it("should contain the user and service names", () => {
    const html = contractReminderHtml(data);
    expect(html).toContain("Sam Taylor");
    expect(html).toContain("Spectrum Internet");
  });

  it("should contain the contract end date and days remaining", () => {
    const html = contractReminderHtml(data);
    expect(html).toContain("Apr 10, 2026");
    expect(html).toContain("14 days");
  });

  it("should contain the service review link", () => {
    const html = contractReminderHtml(data);
    expect(html).toContain("/services/abc123");
  });
});

describe("transactional email layout", () => {
  it("includes LocateFlow branding, CTA, support footer, and security copy", () => {
    const content = emailVerificationContent({
      userName: "Alice",
      verifyLink: "https://locateflow.com/verify-email/token",
    });

    expect(content.html).toContain("LocateFlow");
    expect(content.html).toContain("Verify Email");
    expect(content.html).toContain("support@locateflow.com");
    expect(content.html).toContain("You're receiving this email because you used LocateFlow.");
    expect(content.html).toContain("If this wasn't you, ignore this email or contact support.");
    expect(content.text).toContain("Verify Email: https://locateflow.com/verify-email/token");
    expect(content.text).toContain("support@locateflow.com");
  });

  it("sends a plain text fallback and reply-to through Resend", async () => {
    const result = await sendEmailWithResult({
      to: "alice@example.com",
      subject: "Test",
      html: '<p>Hello Alice</p><a href="https://locateflow.com">Open</a>',
    });

    expect(result).toEqual({
      success: true,
      providerMessageId: "resend_123",
      error: null,
      fromEmail: "LocateFlow <noreply@locateflow.com>",
    });
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "LocateFlow <noreply@locateflow.com>",
        to: "alice@example.com",
        replyTo: "support@locateflow.com",
        text: expect.stringContaining("Hello Alice"),
      }),
    );
  });

  it("redacts API-looking secrets from Resend failure details", async () => {
    mocks.resendSend.mockResolvedValue({
      data: null,
      error: { message: "Invalid API key test-resend-api-key-for-redaction abcdefghijklmnopqrstuvwxyz123456" },
    });

    const result = await sendEmailWithResult({
      to: "alice@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("[redacted]");
    expect(result.error).not.toContain("test-resend-api-key-for-redaction");
    expect(result.error).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
  });

  it("fails closed when production-like email config is missing RESEND_API_KEY", async () => {
    process.env.APP_ENV = "staging";
    mocks.runtimeConfigValues.mockImplementation(async (keys: string[]) => {
      const values: Record<string, string | null> = {
        RESEND_API_KEY: null,
        EMAIL_FROM: "LocateFlow <noreply@locateflow.com>",
        NEXT_PUBLIC_APP_URL: "https://locateflow.com",
        SUPPORT_EMAIL: "support@locateflow.com",
        EMAIL_REPLY_TO: null,
      };
      return Object.fromEntries(keys.map((key) => [key, values[key] || null]));
    });

    const result = await sendEmailWithResult({
      to: "alice@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result).toEqual({
      success: false,
      providerMessageId: null,
      error: "RESEND_API_KEY missing",
      fromEmail: "LocateFlow <noreply@locateflow.com>",
      configError: true,
    });
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });
});
