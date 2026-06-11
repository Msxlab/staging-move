import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  sendLoggedEmail: vi.fn(),
  generatePdf: vi.fn(),
  userCount: vi.fn(),
  subscriptionFindMany: vi.fn(),
  supportTicketCount: vi.fn(),
  serviceGroupBy: vi.fn(),
  integrationStatFindMany: vi.fn(),
  adminUserFindMany: vi.fn(),
}));

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: (...a: unknown[]) => mocks.guardCronRequest(...a),
}));
vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...a: unknown[]) => mocks.getRuntimeConfigValue(...a),
}));
vi.mock("@/lib/email-service", () => ({
  sendLoggedEmail: (...a: unknown[]) => mocks.sendLoggedEmail(...a),
}));
// Keep the HTML composition observable: identity escape + passthrough text.
vi.mock("@/lib/email", () => ({
  escapeHtml: (s: unknown) => String(s),
  htmlToPlainText: (s: unknown) => String(s),
}));
// The pdfkit generator is unit-tested separately (lib/pdf); here we only
// assert the route assembles the data and attaches the bytes.
vi.mock("@/lib/pdf/monthly-business-report", () => ({
  generateMonthlyBusinessReportPdf: (...a: unknown[]) => mocks.generatePdf(...a),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { count: (...a: unknown[]) => mocks.userCount(...a) },
    subscription: { findMany: (...a: unknown[]) => mocks.subscriptionFindMany(...a) },
    supportTicket: { count: (...a: unknown[]) => mocks.supportTicketCount(...a) },
    service: { groupBy: (...a: unknown[]) => mocks.serviceGroupBy(...a) },
    integrationDailyStat: { findMany: (...a: unknown[]) => mocks.integrationStatFindMany(...a) },
    adminUser: { findMany: (...a: unknown[]) => mocks.adminUserFindMany(...a) },
  },
}));

import { GET } from "./route";

describe("admin-monthly-report cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardCronRequest.mockResolvedValue({ ok: true });
    mocks.getRuntimeConfigValue.mockImplementation((key: string) =>
      Promise.resolve(key === "ADMIN_ALERT_EMAIL" ? "ops@locateflow.com" : null),
    );
    mocks.sendLoggedEmail.mockResolvedValue({ success: true, skipped: false });
    mocks.generatePdf.mockResolvedValue(Buffer.from("%PDF-fake"));

    mocks.userCount.mockResolvedValue(3);
    mocks.subscriptionFindMany.mockImplementation((args: any) => {
      const status = args?.where?.status;
      if (status && typeof status === "object" && Array.isArray(status.in)) {
        // activeSubs — one paying Stripe sub so MRR > 0.
        return Promise.resolve([
          {
            plan: "INDIVIDUAL",
            status: "ACTIVE",
            provider: "STRIPE",
            accessType: "FULL",
            billingInterval: "MONTH",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            canceledAt: null,
            trialEndsAt: null,
          },
        ]);
      }
      return Promise.resolve([]);
    });
    mocks.supportTicketCount.mockResolvedValue(2);
    mocks.serviceGroupBy.mockResolvedValue([
      { category: "UTILITY_ELECTRIC", _count: { _all: 7 }, _sum: { monthlyCost: 840 } },
      { category: "INTERNET", _count: { _all: 4 }, _sum: { monthlyCost: 260 } },
    ]);
    mocks.integrationStatFindMany.mockResolvedValue([
      { source: "fcc", statusCounts: { ok: 90, error: 10 } },
      { source: "fcc", statusCounts: { ok: 100 } },
      { source: "nws", statusCounts: { ok: 40, timeout: 2 } },
    ]);
    mocks.adminUserFindMany.mockResolvedValue([]);
  });

  it("renders last month's PDF and emails it with the audited dedupe namespace", async () => {
    const res = await GET(new Request("http://localhost/api/cron/admin-monthly-report"));
    const body = await res.json();

    // PDF assembled from the shared revenue helpers + month aggregates.
    expect(mocks.generatePdf).toHaveBeenCalledTimes(1);
    const reportData = mocks.generatePdf.mock.calls[0][0];
    expect(reportData.kpis.mrr).toBeGreaterThan(0);
    expect(reportData.kpis.supportTickets).toBe(2);
    expect(reportData.topCategories[0]).toEqual({
      category: "UTILITY_ELECTRIC",
      services: 7,
      monthlyCost: 840,
    });
    // IntegrationDailyStat rows collapse per source; error/timeout = failures.
    expect(reportData.integrationHealth).toEqual([
      { source: "fcc", total: 200, failures: 10 },
      { source: "nws", total: 42, failures: 2 },
    ]);
    expect(reportData.mrrTrend).toHaveLength(6);
    expect(reportData.userGrowth).toHaveLength(6);

    expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(1);
    const sent = mocks.sendLoggedEmail.mock.calls[0][0];
    // Subject: 'LocateFlow monthly report — {Month YYYY}' for LAST month.
    const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1));
    const monthLabel = lastMonth.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    const monthKey = `${lastMonth.getUTCFullYear()}-${String(lastMonth.getUTCMonth() + 1).padStart(2, "0")}`;
    expect(sent.subject).toBe(`LocateFlow monthly report — ${monthLabel}`);
    expect(sent.dedupeKey).toBe(`admin-monthly-report:${monthKey}:ops@locateflow.com`);
    expect(sent.attachments).toEqual([
      {
        filename: `locateflow-monthly-report-${monthKey}.pdf`,
        content: Buffer.from("%PDF-fake").toString("base64"),
        contentType: "application/pdf",
      },
    ]);

    expect(body.ok).toBe(true);
    expect(body.pdfAttached).toBe(true);
    expect(body.month).toBe(monthKey);
    expect(body.kpis.mrr).toBeGreaterThan(0);
  });

  it("fans out to active admins plus the alert address, minus excludes", async () => {
    mocks.getRuntimeConfigValue.mockImplementation((key: string) =>
      Promise.resolve(
        key === "ADMIN_ALERT_EMAIL"
          ? "ops@locateflow.com"
          : key === "ADMIN_DIGEST_EXCLUDE_EMAILS"
            ? "muted@locateflow.com"
            : null,
      ),
    );
    mocks.adminUserFindMany.mockResolvedValue([
      { email: "alice@locateflow.com" },
      { email: "ops@locateflow.com" }, // dupe of the alert address
      { email: "muted@locateflow.com" }, // opted out
    ]);

    const res = await GET(new Request("http://localhost/api/cron/admin-monthly-report"));
    const body = await res.json();

    expect(body.recipients).toBe(2);
    expect(body.sent).toBe(2);
    const tos = mocks.sendLoggedEmail.mock.calls.map((c) => (c[0] as { to: string }).to).sort();
    expect(tos).toEqual(["alice@locateflow.com", "ops@locateflow.com"]);
  });

  it("skips when no alert recipient is configured and no admins exist", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/cron/admin-monthly-report"));
    const body = await res.json();

    expect(body.skipped).toContain("ADMIN_ALERT_EMAIL");
    expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    expect(mocks.generatePdf).not.toHaveBeenCalled();
  });

  it("still sends the KPI summary when PDF generation fails", async () => {
    mocks.generatePdf.mockRejectedValue(new Error("pdfkit exploded"));

    const res = await GET(new Request("http://localhost/api/cron/admin-monthly-report"));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.pdfAttached).toBe(false);
    const sent = mocks.sendLoggedEmail.mock.calls[0][0];
    expect(sent.attachments).toBeUndefined();
    expect(sent.html).toContain("PDF generation failed");
  });

  it("returns 401 pass-through when the cron guard rejects", async () => {
    const denied = { ok: false, response: new Response(null, { status: 401 }) };
    mocks.guardCronRequest.mockResolvedValue(denied);

    const res = await GET(new Request("http://localhost/api/cron/admin-monthly-report"));

    expect(res.status).toBe(401);
    expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
  });
});
