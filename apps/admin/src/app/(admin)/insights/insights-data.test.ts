import { describe, it, expect } from "vitest";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import {
  KNOWN_SOURCES,
  PROVIDER_USER_FLOOR,
  aggregateFeedback,
  buildAreaPreferences,
  buildBriefingTrend,
  buildSourceHealth,
  lastNDayKeys,
  utcDayKey,
  type AreaServiceRow,
  type DailyStatRow,
} from "./insights-data";

const TODAY = new Date("2026-06-10T15:30:00.000Z");
const DAY_KEYS = lastNDayKeys(14, TODAY);
const SOURCE_LABEL_CATALOGS = [enMessages, esMessages] as const;

function stat(
  day: string,
  source: string,
  statusCounts: unknown,
): DailyStatRow {
  return { day: new Date(`${day}T00:00:00.000Z`), source, statusCounts };
}

describe("lastNDayKeys / utcDayKey", () => {
  it("returns N UTC day keys ending today, oldest first", () => {
    expect(DAY_KEYS).toHaveLength(14);
    expect(DAY_KEYS[0]).toBe("2026-05-28");
    expect(DAY_KEYS[13]).toBe("2026-06-10");
  });

  it("uses the UTC calendar day regardless of clock time", () => {
    expect(utcDayKey(new Date("2026-06-10T23:59:59.000Z"))).toBe("2026-06-10");
    const keys = lastNDayKeys(2, new Date("2026-06-01T00:00:01.000Z"));
    expect(keys).toEqual(["2026-05-31", "2026-06-01"]);
  });
});

describe("buildSourceHealth", () => {
  it("has locale labels for every known health source", () => {
    for (const messages of SOURCE_LABEL_CATALOGS) {
      for (const source of KNOWN_SOURCES) {
        expect(messages.insights.health.sources).toHaveProperty(source);
      }
    }
  });

  it("lists every known source as 'off' with zero-filled days when there are no rows", () => {
    const health = buildSourceHealth([], DAY_KEYS);
    expect(health.map((h) => h.source)).toEqual([...KNOWN_SOURCES]);
    for (const h of health) {
      expect(h.status).toBe("off");
      expect(h.days).toHaveLength(14);
      expect(h.days[0]?.day).toBe("2026-05-28");
      expect(h.totals).toEqual({ ok: 0, error: 0, notConfigured: 0, other: 0 });
    }
  });

  it("classifies healthy vs degraded on the error share of attempts", () => {
    const health = buildSourceHealth(
      [
        stat("2026-06-09", "fcc", { ok: 95, error: 5 }), // 5% — healthy
        stat("2026-06-09", "nws", { ok: 80, error: 20 }), // 20% — degraded
      ],
      DAY_KEYS,
    );
    const byName = new Map(health.map((h) => [h.source, h]));
    expect(byName.get("fcc")?.status).toBe("healthy");
    expect(byName.get("nws")?.status).toBe("degraded");
  });

  it("counts cached + generated as successful outcomes", () => {
    const health = buildSourceHealth(
      [stat("2026-06-08", "briefing", { generated: 3, cached: 7, gated: 2 })],
      DAY_KEYS,
    );
    const briefing = health.find((h) => h.source === "briefing");
    expect(briefing?.totals).toEqual({
      ok: 10,
      error: 0,
      notConfigured: 0,
      other: 2,
    });
    expect(briefing?.status).toBe("healthy");
  });

  it("treats a source with only not_configured counts as 'off'", () => {
    const health = buildSourceHealth(
      [stat("2026-06-08", "fcc", { not_configured: 40 })],
      DAY_KEYS,
    );
    const fcc = health.find((h) => h.source === "fcc");
    expect(fcc?.status).toBe("off");
    expect(fcc?.totals.notConfigured).toBe(40);
  });

  it("survives malformed statusCounts payloads", () => {
    const health = buildSourceHealth(
      [
        stat("2026-06-08", "water", null),
        stat("2026-06-07", "water", "broken"),
        stat("2026-06-06", "water", [1, 2]),
        stat("2026-06-05", "water", { ok: "12", error: Number.NaN, bad: -3 }),
      ],
      DAY_KEYS,
    );
    const water = health.find((h) => h.source === "water");
    // Only the coercible "12" survives; NaN and negatives are dropped.
    expect(water?.totals).toEqual({ ok: 12, error: 0, notConfigured: 0, other: 0 });
    expect(water?.status).toBe("healthy");
  });

  it("appends unknown sources after the known ones and ignores out-of-window rows", () => {
    const health = buildSourceHealth(
      [
        stat("2026-06-09", "zeta-new", { ok: 1 }),
        stat("2026-01-01", "fcc", { error: 999 }), // outside window
      ],
      DAY_KEYS,
    );
    expect(health.map((h) => h.source)).toEqual([...KNOWN_SOURCES, "zeta-new"]);
    expect(health.find((h) => h.source === "fcc")?.totals.error).toBe(0);
    expect(health.find((h) => h.source === "zeta-new")?.status).toBe("healthy");
  });
});

describe("buildBriefingTrend", () => {
  it("zero-fills the window and aligns series to the day keys", () => {
    const trend = buildBriefingTrend(
      [
        stat("2026-05-28", "briefing", { generated: 2, cached: 5 }),
        stat("2026-06-10", "briefing", { generated: 1, gated: 4 }),
        stat("2026-06-10", "dossier", { generated: 99 }), // other source ignored
      ],
      DAY_KEYS,
    );
    expect(trend.days).toEqual(DAY_KEYS);
    expect(trend.generated[0]).toBe(2);
    expect(trend.generated[13]).toBe(1);
    expect(trend.cached[0]).toBe(5);
    expect(trend.gated[13]).toBe(4);
    expect(trend.generated.slice(1, 13).every((v) => v === 0)).toBe(true);
    expect(trend.totals).toEqual({ generated: 3, cached: 5, gated: 4 });
  });

  it("returns all-zero series when the source never wrote a row", () => {
    const trend = buildBriefingTrend([], DAY_KEYS);
    expect(trend.totals).toEqual({ generated: 0, cached: 0, gated: 0 });
    expect(trend.generated).toHaveLength(14);
  });
});

describe("aggregateFeedback", () => {
  it("counts actions per category and sorts busiest first", () => {
    const rows = [
      { action: "DISMISS", category: "internet" },
      { action: "DISMISS", category: "internet" },
      { action: "SNOOZE", category: "internet" },
      { action: "NOT_RELEVANT", category: "electricity" },
      { action: "SOMETHING_NEW", category: "electricity" }, // unknown — ignored
      { action: "SNOOZE", category: null },
    ];
    const agg = aggregateFeedback(rows);
    expect(agg).toEqual([
      { category: "internet", dismissed: 2, notRelevant: 0, snoozed: 1, total: 3 },
      { category: "electricity", dismissed: 0, notRelevant: 1, snoozed: 0, total: 1 },
      { category: null, dismissed: 0, notRelevant: 0, snoozed: 1, total: 1 },
    ]);
  });

  it("returns an empty list for no feedback", () => {
    expect(aggregateFeedback([])).toEqual([]);
  });
});

describe("buildAreaPreferences", () => {
  function svc(
    userId: string,
    state: string,
    category: string,
    providerId: string,
    providerName = providerId,
  ): AreaServiceRow {
    return { userId, state, category, providerId, providerName };
  }

  it("hides cohorts below the k-anonymity floor", () => {
    // 4 distinct users — one below the floor of 5.
    const below = [1, 2, 3, 4].map((i) =>
      svc(`u${i}`, "TX", "internet", "p1", "FiberCo"),
    );
    expect(buildAreaPreferences(below)).toEqual([]);

    const atFloor = [1, 2, 3, 4, 5].map((i) =>
      svc(`u${i}`, "TX", "internet", "p1", "FiberCo"),
    );
    const rows = buildAreaPreferences(atFloor);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      state: "TX",
      category: "internet",
      providerName: "FiberCo",
      userCount: PROVIDER_USER_FLOOR,
      serviceCount: 5,
    });
  });

  it("measures the floor on DISTINCT users, never raw service rows", () => {
    // One power user with 10 services must not clear the floor.
    const rows = buildAreaPreferences(
      Array.from({ length: 10 }, () => svc("u1", "CA", "water", "p9")),
    );
    expect(rows).toEqual([]);
  });

  it("sorts by state, category, then distinct users desc and skips blank states", () => {
    const data = [
      // CA/internet → p2 has 6 users, p3 has 5
      ...[1, 2, 3, 4, 5, 6].map((i) => svc(`a${i}`, "CA", "internet", "p2", "Beta")),
      ...[1, 2, 3, 4, 5].map((i) => svc(`b${i}`, "CA", "internet", "p3", "Alpha")),
      // AZ/electricity → 5 users
      ...[1, 2, 3, 4, 5].map((i) => svc(`c${i}`, "az", "electricity", "p4", "Volt")),
      // blank state rows are skipped
      svc("d1", "", "internet", "p5"),
    ];
    const rows = buildAreaPreferences(data);
    expect(rows.map((r) => `${r.state}/${r.category}/${r.providerName}`)).toEqual([
      "AZ/electricity/Volt", // lowercase state is normalized
      "CA/internet/Beta", // 6 users before 5
      "CA/internet/Alpha",
    ]);
    expect(rows[1]?.userCount).toBe(6);
    expect(rows[2]?.userCount).toBe(5);
  });
});
