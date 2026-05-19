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
  appendUnsubscribeFooter,
  billReminderHtml,
  buildUnsubscribeHeaders,
  contractReminderHtml,
  emailVerificationContent,
  paymentFailedContent,
  resolveEmailLocale,
  securityNoticeContent,
  sendEmailWithResult,
  subscriptionActivatedContent,
  subscriptionCanceledContent,
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

describe("resolveEmailLocale", () => {
  it("returns 'es' for any locale starting with 'es'", () => {
    expect(resolveEmailLocale("es")).toBe("es");
    expect(resolveEmailLocale("es-US")).toBe("es");
    expect(resolveEmailLocale("ES")).toBe("es");
    expect(resolveEmailLocale("es-MX")).toBe("es");
  });

  it("returns 'en' for null, undefined, empty, or non-Spanish locales", () => {
    expect(resolveEmailLocale(null)).toBe("en");
    expect(resolveEmailLocale(undefined)).toBe("en");
    expect(resolveEmailLocale("")).toBe("en");
    expect(resolveEmailLocale("en")).toBe("en");
    expect(resolveEmailLocale("en-US")).toBe("en");
    expect(resolveEmailLocale("fr")).toBe("en");
    expect(resolveEmailLocale("tr")).toBe("en");
  });
});

describe("Spanish (es) inline content", () => {
  it("subscription activated uses Spanish copy when locale is es", () => {
    const content = subscriptionActivatedContent({
      userName: "Ana",
      planLabel: "Pro",
      amountFormatted: "$9.99",
      manageLink: "https://locateflow.com/settings/subscription",
      locale: "es",
    });
    expect(content.subject).toBe("Bienvenido a LocateFlow Pro");
    expect(content.html).toContain("Tu suscripción está activa");
    expect(content.html).toContain("Administrar suscripción");
    expect(content.html).toContain('lang="es"');
    expect(content.text).toContain("Hola Ana,");
  });

  it("subscription canceled uses Spanish copy when locale is es", () => {
    const content = subscriptionCanceledContent({
      userName: "Ana",
      planLabel: "Pro",
      accessEndsOn: "2026-05-15",
      reactivateLink: "https://locateflow.com/settings/subscription",
      locale: "es",
    });
    expect(content.subject).toBe("Tu suscripción de LocateFlow fue cancelada");
    expect(content.html).toContain("Cancelamos tu suscripción");
    expect(content.html).toContain("Mantendrás el acceso hasta");
    expect(content.html).toContain("Reactivar");
  });

  it("payment failed uses Spanish copy when locale is es", () => {
    const content = paymentFailedContent({
      userName: "Ana",
      amountFormatted: "$9.99",
      retryLink: "https://locateflow.com/settings/subscription",
      nextAttemptOn: "2026-05-01",
      locale: "es",
    });
    expect(content.subject).toBe("Falló el pago de tu suscripción de LocateFlow");
    expect(content.html).toContain("No pudimos cobrar");
    expect(content.html).toContain("Actualizar método de pago");
  });

  it("security notice translates each kind to Spanish", () => {
    const kinds = [
      { kind: "password-changed" as const, expected: "Contraseña cambiada" },
      { kind: "mfa-enabled" as const, expected: "Verificación en dos pasos activada" },
      { kind: "mfa-disabled" as const, expected: "Verificación en dos pasos desactivada" },
      { kind: "oauth-linked" as const, expected: "Método de inicio de sesión vinculado" },
      { kind: "account-deletion-requested" as const, expected: "Eliminación de cuenta solicitada" },
    ];
    for (const { kind, expected } of kinds) {
      const content = securityNoticeContent({
        userName: "Ana",
        kind,
        manageLink: "https://locateflow.com/settings/security",
        locale: "es",
      });
      expect(content.html).toContain(expected);
    }
  });

  it("password-changed body uses provided detail when present (set_password case)", () => {
    const content = securityNoticeContent({
      userName: "Ana",
      kind: "password-changed",
      detail: "Se agregó una contraseña a tu cuenta.",
      manageLink: "https://locateflow.com/settings/security",
      locale: "es",
    });
    expect(content.html).toContain("Se agregó una contraseña a tu cuenta.");
    expect(content.html).toContain("Si no fuiste tú, asegura tu cuenta de inmediato.");
  });
});

describe("unsubscribe footer + headers", () => {
  const baseContent = {
    subject: "Test",
    html: "<html><body><p>Hello</p></body></html>",
    text: "Hello",
  };

  it("appends a footer line + plain-text URL to a marketing email body", () => {
    const url = "https://locateflow.com/unsubscribe?t=tok.abc";
    const result = appendUnsubscribeFooter(baseContent, url);
    expect(result.html).toContain("Unsubscribe");
    expect(result.html).toContain(url);
    // Footer goes inside </body>, not after it.
    expect(result.html.indexOf(url)).toBeLessThan(result.html.indexOf("</body>"));
    expect(result.text).toContain(url);
  });

  it("translates the footer to Spanish for es locale", () => {
    const url = "https://locateflow.com/unsubscribe?t=tok.abc";
    const result = appendUnsubscribeFooter(baseContent, url, "es");
    expect(result.html).toContain("Cancelar suscripción");
    expect(result.text).toContain("Cancelar suscripción");
  });

  it("builds RFC 2369 + RFC 8058 List-Unsubscribe headers", () => {
    const url = "https://locateflow.com/unsubscribe?t=tok.abc";
    const headers = buildUnsubscribeHeaders(url);
    expect(headers["List-Unsubscribe"]).toContain(`<${url}>`);
    expect(headers["List-Unsubscribe"]).toContain("<mailto:");
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
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

  it("fails before Resend when both HTML and text bodies are empty", async () => {
    const result = await sendEmailWithResult({
      to: "alice@example.com",
      subject: "Test",
      html: "   ",
      text: "",
    });

    expect(result).toEqual({
      success: false,
      providerMessageId: null,
      error: "EMAIL_BODY_MISSING: html or text content is required",
      fromEmail: "LocateFlow <noreply@locateflow.com>",
    });
    expect(mocks.resendSend).not.toHaveBeenCalled();
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

  it("translates the shell footer + security note to Spanish for es locale", () => {
    const content = securityNoticeContent({
      userName: "Ana",
      kind: "password-changed",
      manageLink: "https://locateflow.com/settings/security",
      locale: "es",
    });
    expect(content.html).toContain('lang="es"');
    expect(content.html).toContain("Recibes este correo porque usaste LocateFlow.");
    expect(content.html).toContain("Si no fuiste tú, ignora este correo o contacta con soporte.");
    expect(content.text).toContain("Recibes este correo porque usaste LocateFlow.");
  });

  it("falls back to English when locale is null, undefined, or unknown", () => {
    for (const locale of [null, undefined, "fr", "tr"] as const) {
      const content = securityNoticeContent({
        userName: "Alex",
        kind: "password-changed",
        manageLink: "https://locateflow.com/settings/security",
        locale: locale as never,
      });
      expect(content.html).toContain('lang="en"');
      expect(content.html).toContain("You're receiving this email because you used LocateFlow.");
    }
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
