import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  sendLoggedEmail: vi.fn(),
  userFindMany: vi.fn(),
  userCount: vi.fn(),
  subscriptionCount: vi.fn(),
  subscriptionFindMany: vi.fn(),
  supportTicketCount: vi.fn(),
  supportTicketFindMany: vi.fn(),
  gdprCount: vi.fn(),
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
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: (...a: unknown[]) => mocks.userFindMany(...a),
      count: (...a: unknown[]) => mocks.userCount(...a),
    },
    subscription: {
      count: (...a: unknown[]) => mocks.subscriptionCount(...a),
      findMany: (...a: unknown[]) => mocks.subscriptionFindMany(...a),
    },
    supportTicket: {
      count: (...a: unknown[]) => mocks.supportTicketCount(...a),
      findMany: (...a: unknown[]) => mocks.supportTicketFindMany(...a),
    },
    gDPRRequest: { count: (...a: unknown[]) => mocks.gdprCount(...a) },
    adminUser: { findMany: (...a: unknown[]) => mocks.adminUserFindMany(...a) },
  },
}));

import { GET } from "./route";

describe("admin-daily-digest cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardCronRequest.mockResolvedValue({ ok: true });
    mocks.getRuntimeConfigValue.mockImplementation((key: string) =>
      Promise.resolve(
        key === "ADMIN_ALERT_EMAIL"
          ? "ops@locateflow.com"
          : key === "NEXT_PUBLIC_ADMIN_URL"
            ? "https://admin.locateflow.com"
            : null,
      ),
    );
    mocks.sendLoggedEmail.mockResolvedValue({ success: true, skipped: false });

    mocks.userFindMany.mockResolvedValue([]);
    // newUserCount (no `lt`) vs priorNewUserCount (`lt` present)
    mocks.userCount.mockImplementation((args: any) =>
      Promise.resolve(args?.where?.createdAt?.lt ? 1 : 4),
    );
    // canceledSubscriptions (canceledAt) vs pastDueCount (status PAST_DUE)
    mocks.subscriptionCount.mockImplementation((args: any) =>
      Promise.resolve(args?.where?.status === "PAST_DUE" ? 2 : 1),
    );
    mocks.subscriptionFindMany.mockImplementation((args: any) => {
      const status = args?.where?.status;
      if (status && typeof status === "object" && Array.isArray(status.in)) {
        // activeSubs — one paying Stripe sub so MRR > 0
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
      if (status === "CANCELED") return Promise.resolve([]);
      if (status === "TRIALING") {
        return Promise.resolve([
          {
            id: "sub_trial_1",
            plan: "FAMILY",
            trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            user: { id: "user_9", email: "trial@example.com" },
          },
        ]);
      }
      return Promise.resolve([]);
    });
    mocks.supportTicketCount.mockResolvedValue(0);
    mocks.supportTicketFindMany.mockResolvedValue([]);
    mocks.gdprCount.mockResolvedValue(1);
    mocks.adminUserFindMany.mockResolvedValue([]);
  });

  it("emails a briefing with a revenue band, real past-due signal, and an action queue", async () => {
    const res = await GET(new Request("http://localhost/api/cron/admin-daily-digest"));
    const body = await res.json();

    expect(mocks.sendLoggedEmail).toHaveBeenCalledTimes(1);
    const sent = mocks.sendLoggedEmail.mock.calls[0][0] as { html: string };

    // Revenue band present and MRR is non-zero (priced via shared computeMrr).
    expect(sent.html).toContain("Revenue &amp; growth");
    expect(sent.html).toContain("MRR");
    expect(body.revenue.mrr).toBeGreaterThan(0);

    // Real PAST_DUE signal (not the old emailLog substring) surfaces in the queue.
    expect(sent.html).toContain("Action queue");
    expect(sent.html).toContain("past due");
    expect(sent.html).toContain("pending data-deletion");
    // Trial-expiring action is deep-linked into the admin panel.
    expect(sent.html).toContain("Trial ending in");
    expect(sent.html).toContain("https://admin.locateflow.com/users/user_9");

    // Day-over-day signups delta rendered (4 this window vs 1 prior).
    expect(sent.html).toContain("vs prior 24h");
    expect(body.counts.pastDue).toBe(2);
    expect(body.counts.trialsExpiring).toBe(1);
  });

  it("skips when no alert recipient is configured", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/cron/admin-daily-digest"));
    const body = await res.json();

    expect(body.skipped).toContain("ADMIN_ALERT_EMAIL");
    expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
  });

  it("fans out to every active admin plus the alert address, deduped per recipient", async () => {
    mocks.adminUserFindMany.mockResolvedValue([{ email: "alice@locateflow.com" }, { email: "ops@locateflow.com" }]);

    const res = await GET(new Request("http://localhost/api/cron/admin-daily-digest"));
    const body = await res.json();

    // ops@ is both the alert address and an admin → deduped to 2 recipients.
    expect(body.recipients).toBe(2);
    expect(body.sent).toBe(2);
    const tos = mocks.sendLoggedEmail.mock.calls.map((c) => (c[0] as { to: string }).to).sort();
    expect(tos).toEqual(["alice@locateflow.com", "ops@locateflow.com"]);
  });

  it("honors ADMIN_DIGEST_SKIP_IF_EMPTY on a quiet day", async () => {
    mocks.getRuntimeConfigValue.mockImplementation((key: string) =>
      Promise.resolve(
        key === "ADMIN_ALERT_EMAIL"
          ? "ops@locateflow.com"
          : key === "ADMIN_DIGEST_SKIP_IF_EMPTY"
            ? "true"
            : null,
      ),
    );
    mocks.userCount.mockResolvedValue(0);
    mocks.subscriptionCount.mockResolvedValue(0);
    mocks.gdprCount.mockResolvedValue(0);
    mocks.subscriptionFindMany.mockResolvedValue([]); // no active subs, no trials

    const res = await GET(new Request("http://localhost/api/cron/admin-daily-digest"));
    const body = await res.json();

    expect(body.skipped).toContain("ADMIN_DIGEST_SKIP_IF_EMPTY");
    expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
  });

  it("fires an immediate anomaly alert when net MRR contracts", async () => {
    // A paying sub canceled inside the 24h window makes churned MRR > 0 and
    // new MRR 0 → net MRR negative → anomaly.
    mocks.subscriptionFindMany.mockImplementation((args: any) => {
      const status = args?.where?.status;
      if (status && typeof status === "object" && Array.isArray(status.in)) return Promise.resolve([]);
      if (status === "CANCELED") {
        return Promise.resolve([
          {
            plan: "INDIVIDUAL",
            status: "CANCELED",
            provider: "STRIPE",
            accessType: "FULL",
            billingInterval: "MONTH",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            canceledAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago (in window)
            trialEndsAt: null,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const res = await GET(new Request("http://localhost/api/cron/admin-daily-digest"));
    const body = await res.json();

    expect(body.revenue.netNewMrr).toBeLessThan(0);
    expect(body.anomalyAlerted).toBe(true);
    // Digest send + anomaly email both go out (Slack URL unset → email-only).
    const subjects = mocks.sendLoggedEmail.mock.calls.map((c) => (c[0] as { subject: string }).subject);
    expect(subjects.some((s) => s.includes("Revenue anomaly"))).toBe(true);
  });
});
