import { beforeEach, describe, expect, it, vi } from "vitest";

// Boundary mocks. notification-preferences is mocked so every test user is
// digest-day-eligible regardless of the wall clock — the focus here is the new
// weatherDigest plan gate. getUserPlanForDefaultWorkspace is mocked (no DB);
// planFeatures stays REAL so the gate exercises the actual @locateflow/shared
// matrix (Individual+).
const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  userFindMany: vi.fn(),
  notificationPreferenceFindMany: vi.fn(),
  serviceFindMany: vi.fn(),
  serviceGroupBy: vi.fn(),
  emailLogFindMany: vi.fn(),
  sendWeeklyDigestEmail: vi.fn(),
  getUserPlan: vi.fn(),
  isFeatureEnabled: vi.fn(),
}));

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: (...a: unknown[]) => mocks.guardCronRequest(...a),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => mocks.userFindMany(...a) },
    notificationPreference: { findMany: (...a: unknown[]) => mocks.notificationPreferenceFindMany(...a) },
    service: {
      findMany: (...a: unknown[]) => mocks.serviceFindMany(...a),
      groupBy: (...a: unknown[]) => mocks.serviceGroupBy(...a),
    },
    emailLog: { findMany: (...a: unknown[]) => mocks.emailLogFindMany(...a) },
  },
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: (...a: unknown[]) => mocks.isFeatureEnabled(...a),
}));

vi.mock("@/lib/email-service", () => ({
  sendWeeklyDigestEmail: (...a: unknown[]) => mocks.sendWeeklyDigestEmail(...a),
}));

vi.mock("@/lib/plan-limits", () => ({
  getUserPlanForDefaultWorkspace: (...a: unknown[]) => mocks.getUserPlan(...a),
}));

// Every user is eligible (email + weekly summary on, digest day = today).
vi.mock("@/lib/notification-preferences", () => ({
  groupNotificationPreferencesByUser: () => new Map(),
  buildWebNotificationSettings: () => ({
    config: { emailEnabled: true, digestDay: "ALWAYS" },
    prefs: { weeklySummary: true },
  }),
  getNextBillingDate: () => new Date("2026-06-15T00:00:00.000Z"),
  getDaysUntilDate: () => 3,
}));

// Force the eligibility weekday comparison to match our stubbed digestDay.
vi.mock("@locateflow/shared", async () => {
  const actual = await vi.importActual<typeof import("@locateflow/shared")>("@locateflow/shared");
  return {
    ...actual,
    formatInUserTimeZone: () => "ALWAYS",
    formatDateOnlyUtc: () => "Jun 15",
  };
});

import { GET } from "./route";

function makeRequest() {
  return new Request("http://localhost/api/cron/weekly-digest", {
    headers: { authorization: "Bearer test-secret" },
  });
}

const USERS = [
  { id: "u_free", email: "free@example.com", firstName: "Free", lastName: "User" },
  { id: "u_paid", email: "paid@example.com", firstName: "Paid", lastName: "User" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guardCronRequest.mockResolvedValue({ ok: true });
  mocks.userFindMany.mockResolvedValue(USERS);
  mocks.notificationPreferenceFindMany.mockResolvedValue([]);
  mocks.serviceFindMany.mockResolvedValue([]);
  mocks.serviceGroupBy.mockResolvedValue([]);
  mocks.emailLogFindMany.mockResolvedValue([]);
  mocks.sendWeeklyDigestEmail.mockResolvedValue(true);
  // CONSUMER_FREE flag OFF by default (today's production state).
  mocks.isFeatureEnabled.mockResolvedValue(false);
  // Default both users entitled.
  mocks.getUserPlan.mockImplementation(async (userId: string) => ({
    plan: userId === "u_free" ? "FREE_TRIAL" : "INDIVIDUAL",
  }));
});

describe("weekly-digest cron — weatherDigest gate", () => {
  it("rejects unauthenticated requests via the cron guard", async () => {
    mocks.guardCronRequest.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });

  it("emails only the entitled (Individual+) user and skips the FREE_TRIAL user", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.eligible).toBe(1); // free user dropped by the plan gate
    expect(body.sent).toBe(1);
    expect(mocks.sendWeeklyDigestEmail).toHaveBeenCalledTimes(1);
    const sentTo = (mocks.sendWeeklyDigestEmail.mock.calls[0][0] as { userEmail: string }).userEmail;
    expect(sentTo).toBe("paid@example.com");
  });

  it("sends nothing when every eligible user lacks weatherDigest", async () => {
    mocks.getUserPlan.mockResolvedValue({ plan: "FREE_TRIAL" });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.eligible).toBe(0);
    expect(body.sent).toBe(0);
    expect(mocks.sendWeeklyDigestEmail).not.toHaveBeenCalled();
    // No per-user data fetched once the gate empties the set.
    expect(mocks.serviceFindMany).not.toHaveBeenCalled();
  });

  it("emails all when every eligible user is entitled (FAMILY/PRO included)", async () => {
    mocks.getUserPlan.mockImplementation(async (userId: string) => ({
      plan: userId === "u_free" ? "FAMILY" : "PRO",
    }));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.eligible).toBe(2);
    expect(body.sent).toBe(2);
    expect(mocks.sendWeeklyDigestEmail).toHaveBeenCalledTimes(2);
  });
});

describe("weekly-digest cron — per-run recipient cap (Trap M4)", () => {
  // Build N entitled, digest-day-eligible users.
  function makeUsers(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      id: `u_${String(i).padStart(4, "0")}`,
      email: `user${i}@example.com`,
      firstName: "U",
      lastName: String(i),
    }));
  }

  it("flag OFF: recipient count is UNCHANGED and no cap query/keys appear (byte-identical)", async () => {
    // Large entitled base; flag OFF must NOT cap, NOT query emailLog, NOT add keys.
    const users = makeUsers(750);
    mocks.userFindMany.mockResolvedValue(users);
    mocks.getUserPlan.mockResolvedValue({ plan: "PRO" });
    mocks.isFeatureEnabled.mockResolvedValue(false);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.eligible).toBe(750);
    expect(body.sent).toBe(750);
    expect(mocks.sendWeeklyDigestEmail).toHaveBeenCalledTimes(750);
    // No cap telemetry keys when the flag is OFF.
    expect(body).not.toHaveProperty("remaining");
    expect(body).not.toHaveProperty("capApplied");
    expect(body).not.toHaveProperty("maxPerRun");
    // No emailLog rollover query when the flag is OFF.
    expect(mocks.emailLogFindMany).not.toHaveBeenCalled();
  });

  it("flag ON: per-run recipient count is bounded by the cap; remainder rolls over", async () => {
    const users = makeUsers(750); // > default cap of 500
    mocks.userFindMany.mockResolvedValue(users);
    mocks.getUserPlan.mockResolvedValue({ plan: "PRO" });
    mocks.isFeatureEnabled.mockResolvedValue(true);
    mocks.emailLogFindMany.mockResolvedValue([]); // none sent yet this week

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.eligible).toBe(500);
    expect(body.sent).toBe(500);
    expect(mocks.sendWeeklyDigestEmail).toHaveBeenCalledTimes(500);
    expect(body.capApplied).toBe(true);
    expect(body.maxPerRun).toBe(500);
    expect(body.remaining).toBe(250); // 750 - 500 roll to the next run
  });

  it("flag ON: a second run skips already-sent recipients (rollover advances)", async () => {
    const users = makeUsers(750);
    mocks.userFindMany.mockResolvedValue(users);
    mocks.getUserPlan.mockResolvedValue({ plan: "PRO" });
    mocks.isFeatureEnabled.mockResolvedValue(true);
    // Simulate the first 500 already logged for this week's digest.
    const sorted = [...users].sort((a, b) => (a.id < b.id ? -1 : 1));
    mocks.emailLogFindMany.mockResolvedValue(
      // weekStart/weekEnd both resolve to "ALWAYS" via the mocked
      // formatInUserTimeZone, so dedupeKeys mirror the route's construction.
      sorted.slice(0, 500).map((u) => ({
        dedupeKey: `cron:weekly-digest:${u.id}:ALWAYS:ALWAYS`,
      })),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    // Only the remaining 250 are processed; the slice advanced.
    expect(body.eligible).toBe(250);
    expect(body.sent).toBe(250);
    expect(body.capApplied).toBe(false);
    expect(body.remaining).toBe(0);
    const sentEmails = mocks.sendWeeklyDigestEmail.mock.calls.map(
      (c) => (c[0] as { userEmail: string }).userEmail,
    );
    // None of the first-500 (already-sent) users are re-emailed.
    const firstBatchEmails = new Set(sorted.slice(0, 500).map((u) => u.email));
    expect(sentEmails.some((e) => firstBatchEmails.has(e))).toBe(false);
  });
});
