import { beforeEach, describe, expect, it, vi } from "vitest";

// Boundary mocks. notification-preferences is mocked so every test user is
// digest-day-eligible regardless of the wall clock — the focus here is the new
// weatherDigest plan gate. getUserPlan is mocked (no DB); planFeatures stays
// REAL so the gate exercises the actual @locateflow/shared matrix (Individual+).
const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  userFindMany: vi.fn(),
  notificationPreferenceFindMany: vi.fn(),
  serviceFindMany: vi.fn(),
  serviceGroupBy: vi.fn(),
  sendWeeklyDigestEmail: vi.fn(),
  getUserPlan: vi.fn(),
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
  },
}));

vi.mock("@/lib/email-service", () => ({
  sendWeeklyDigestEmail: (...a: unknown[]) => mocks.sendWeeklyDigestEmail(...a),
}));

vi.mock("@/lib/plan-limits", () => ({
  getUserPlan: (...a: unknown[]) => mocks.getUserPlan(...a),
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
  mocks.sendWeeklyDigestEmail.mockResolvedValue(true);
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
