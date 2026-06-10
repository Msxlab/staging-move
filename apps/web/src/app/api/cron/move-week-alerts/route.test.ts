import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  movingPlanFindMany: vi.fn(),
  notificationPreferenceFindMany: vi.fn(),
  lookupMoveDayForecast: vi.fn(),
  createInAppNotification: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: (...a: unknown[]) => mocks.guardCronRequest(...a),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    movingPlan: { findMany: (...a: unknown[]) => mocks.movingPlanFindMany(...a) },
    notificationPreference: { findMany: (...a: unknown[]) => mocks.notificationPreferenceFindMany(...a) },
  },
}));
vi.mock("@/lib/nws-weather", () => ({
  lookupMoveDayForecast: (...a: unknown[]) => mocks.lookupMoveDayForecast(...a),
}));
vi.mock("@/lib/in-app-notifications", () => ({
  createInAppNotification: (...a: unknown[]) => mocks.createInAppNotification(...a),
}));
vi.mock("@/lib/notifications", () => ({
  sendNotification: (...a: unknown[]) => mocks.sendNotification(...a),
}));

import { GET } from "./route";

// Frozen "now": 12:00 UTC on 2026-06-12 is 8am in America/New_York (EDT, the
// route's default reminder timezone) — i.e. exactly the local delivery hour
// the per-zone GHA slot targets.
const NOW_UTC = new Date("2026-06-12T12:00:00.000Z");

const OK_FORECAST = {
  status: "ok" as const,
  forecastDate: "2026-06-14",
  summary: "Mostly Sunny",
  tempHighF: 84,
  tempLowF: 65,
  precipChancePct: 20,
  reason: null,
  source: { name: "National Weather Service", url: "https://www.weather.gov/" },
};

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan_1",
    userId: "user_1",
    // Date-only at UTC midnight, 2 days after the frozen local "today".
    moveDate: new Date("2026-06-14T00:00:00.000Z"),
    user: { id: "user_1", profile: { timezone: null } },
    toAddress: { city: "Austin", state: "TX", latitude: 30.2672, longitude: -97.7431 },
    ...overrides,
  };
}

function makeRequest() {
  return new NextRequest("http://localhost/api/cron/move-week-alerts", {
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("move-week-alerts cron", () => {
  let originalPushEnabled: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW_UTC);
    originalPushEnabled = process.env.NOTIFICATION_PUSH_ENABLED;
    process.env.NOTIFICATION_PUSH_ENABLED = "true";

    mocks.guardCronRequest.mockResolvedValue({ ok: true });
    mocks.movingPlanFindMany.mockResolvedValue([makePlan()]);
    mocks.notificationPreferenceFindMany.mockResolvedValue([]);
    mocks.lookupMoveDayForecast.mockResolvedValue(OK_FORECAST);
    mocks.createInAppNotification.mockResolvedValue(true);
    mocks.sendNotification.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalPushEnabled === undefined) {
      delete process.env.NOTIFICATION_PUSH_ENABLED;
    } else {
      process.env.NOTIFICATION_PUSH_ENABLED = originalPushEnabled;
    }
  });

  it("rejects unauthenticated requests via the cron guard", async () => {
    mocks.guardCronRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(mocks.guardCronRequest).toHaveBeenCalledWith(expect.anything(), "move-week-alerts");
    expect(mocks.movingPlanFindMany).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("is a complete no-op when NOTIFICATION_PUSH_ENABLED is not true (master kill switch)", async () => {
    process.env.NOTIFICATION_PUSH_ENABLED = "false";

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.skipped).toContain("NOTIFICATION_PUSH_ENABLED");
    // No DB reads, no NWS calls, and — critically — no dedupe keys consumed.
    expect(mocks.movingPlanFindMany).not.toHaveBeenCalled();
    expect(mocks.lookupMoveDayForecast).not.toHaveBeenCalled();
    expect(mocks.createInAppNotification).not.toHaveBeenCalled();
  });

  it("sends one forecast push per qualifying plan with the move-day copy", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, alerted: 1, pushSent: 1 });

    // Forecast fetched for the DESTINATION coordinates at the move date.
    expect(mocks.lookupMoveDayForecast).toHaveBeenCalledWith({
      latitude: 30.2672,
      longitude: -97.7431,
      targetDate: "2026-06-14",
    });

    // In-app row written first (it is the dedupe), then the push.
    const inApp = mocks.createInAppNotification.mock.calls[0][0] as Record<string, unknown>;
    expect(inApp.type).toBe("MOVE_WEATHER");
    expect(inApp.title).toBe("Moving day forecast for Austin");
    expect(inApp.body).toContain("Mostly Sunny, high 84°F.");
    expect(inApp.body).toContain("National Weather Service");
    expect(inApp.href).toBe("/moving/plan/plan_1");
    // ONE per plan per (user-local) day: key carries plan id + local date.
    expect(inApp.dedupeKey).toBe("cron:move-week-alert:plan_1:2026-06-12");

    const push = mocks.sendNotification.mock.calls[0][0] as Record<string, unknown>;
    expect(push.type).toBe("PUSH");
    expect(push.subject).toBe("Moving day forecast for Austin");
    expect(push.body).toBe("Mostly Sunny, high 84°F.");
    expect(push.body).not.toContain("Rain likely");
    expect(push.dedupeKey).toBe("cron:move-week-alert:plan_1:2026-06-12:push");
    expect((push.metadata as Record<string, unknown>).kind).toBe("move-week-alert");
  });

  it("appends the rain warning when precipitation chance exceeds 50%", async () => {
    mocks.lookupMoveDayForecast.mockResolvedValue({
      ...OK_FORECAST,
      summary: "Showers And Thunderstorms",
      precipChancePct: 70,
    });

    await GET(makeRequest());

    const push = mocks.sendNotification.mock.calls[0][0] as Record<string, unknown>;
    expect(push.body).toBe("Showers And Thunderstorms, high 84°F. Rain likely — protect boxes.");
  });

  it("only alerts plans whose move is 0-3 days out in the user's timezone (windowing)", async () => {
    mocks.movingPlanFindMany.mockResolvedValue([
      makePlan({ id: "plan_past", moveDate: new Date("2026-06-11T00:00:00.000Z") }), // yesterday
      makePlan({ id: "plan_today", moveDate: new Date("2026-06-12T00:00:00.000Z") }), // day 0
      makePlan({ id: "plan_edge", moveDate: new Date("2026-06-15T00:00:00.000Z") }), // day 3
      makePlan({ id: "plan_far", moveDate: new Date("2026-06-17T00:00:00.000Z") }), // day 5
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.alerted).toBe(2);
    const alertedPlans = mocks.createInAppNotification.mock.calls.map(
      (c) => (c[0] as { metadata: { movingPlanId: string } }).metadata.movingPlanId,
    );
    expect(alertedPlans).toEqual(["plan_today", "plan_edge"]);
    // Out-of-window plans never cost an NWS request.
    expect(mocks.lookupMoveDayForecast).toHaveBeenCalledTimes(2);
  });

  it("skips users outside their ~8am local delivery hour", async () => {
    // 15:00 UTC is 11am in America/New_York — this run is not their slot.
    vi.setSystemTime(new Date("2026-06-12T15:00:00.000Z"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.alerted).toBe(0);
    expect(mocks.lookupMoveDayForecast).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("does not push again when the per-day dedupe row already exists", async () => {
    mocks.createInAppNotification.mockResolvedValue(false); // unique-key hit

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.alerted).toBe(0);
    expect(body.pushSent).toBe(0);
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("skips plans whose destination has no coordinates without calling NWS", async () => {
    mocks.movingPlanFindMany.mockResolvedValue([
      makePlan({ toAddress: { city: "Austin", state: "TX", latitude: null, longitude: null } }),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.skippedNoCoords).toBe(1);
    expect(body.alerted).toBe(0);
    expect(mocks.lookupMoveDayForecast).not.toHaveBeenCalled();
    expect(mocks.createInAppNotification).not.toHaveBeenCalled();
  });

  it("sends nothing (and burns no dedupe key) when the forecast degrades", async () => {
    mocks.lookupMoveDayForecast.mockResolvedValue({
      ...OK_FORECAST,
      status: "error",
      summary: null,
      tempHighF: null,
      reason: "nws_request_failed",
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.skippedNoForecast).toBe(1);
    expect(body.alerted).toBe(0);
    expect(mocks.createInAppNotification).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("honors a muted MOVE_ALERT push preference", async () => {
    mocks.notificationPreferenceFindMany.mockResolvedValue([
      { userId: "user_1", channel: "PUSH", type: "MOVE_ALERT", enabled: false, frequency: null },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.alerted).toBe(0);
    expect(mocks.lookupMoveDayForecast).not.toHaveBeenCalled();
    expect(mocks.createInAppNotification).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});
