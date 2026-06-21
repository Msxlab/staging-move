/**
 * Pure aggregation logic for the admin Insights page.
 *
 * Everything in this module is side-effect free and operates on plain rows
 * the server component fetched, so the panel math is unit-testable without a
 * database. The page (page.tsx) owns the prisma queries; the client component
 * (insights-client.tsx) owns the rendering.
 */

/** Days of IntegrationDailyStat history shown in the health + AI panels. */
export const HEALTH_WINDOW_DAYS = 14;

/** Days of RecommendationFeedback history shown in the quality panel. */
export const FEEDBACK_WINDOW_DAYS = 30;

/**
 * k-anonymity floor for the area-preferences panel: a (state × category ×
 * provider) cohort is only shown once at least this many DISTINCT users
 * contribute to it.
 *
 * MIRRORS `PROVIDER_USER_FLOOR` in
 * `apps/web/src/app/api/providers/popular/route.ts` (the community-popularity
 * endpoint, privacy finding F-002). The admin app cannot import from the web
 * app, so the value is duplicated here on purpose — if you change one, change
 * both.
 */
export const PROVIDER_USER_FLOOR = 5;

/**
 * A source is "degraded" when more than this share of its attempts
 * (successes + errors) errored inside the window.
 */
export const DEGRADED_ERROR_RATIO = 0.1;

/**
 * The integration sources telemetry is expected to write. Kept in the shared
 * data-contract order so the health panel always lists every known source —
 * a source that never wrote a row still shows up as "off" instead of
 * silently disappearing. Unknown sources found in the data are appended.
 */
export const KNOWN_SOURCES = [
  "fcc",
  "electric",
  "nri",
  "radon",
  "water",
  "air",
  "nws",
  "briefing",
  "dossier",
] as const;

export type SourceStatus = "healthy" | "degraded" | "off";

/** Raw IntegrationDailyStat row shape the page passes in. */
export interface DailyStatRow {
  day: Date;
  source: string;
  /** Prisma Json — parsed defensively, malformed payloads count as empty. */
  statusCounts: unknown;
}

export interface SourceDayBucket {
  /** YYYY-MM-DD (UTC). */
  day: string;
  /** Successful outcomes: ok + cached + generated. */
  ok: number;
  error: number;
  notConfigured: number;
  /** Open-ended remainder (gated, future outcome keys, ...). */
  other: number;
}

export interface SourceHealth {
  source: string;
  /** One bucket per window day, zero-filled, oldest first. */
  days: SourceDayBucket[];
  totals: { ok: number; error: number; notConfigured: number; other: number };
  status: SourceStatus;
}

export interface BriefingTrend {
  /** YYYY-MM-DD keys, oldest first — x axis shared by the three series. */
  days: string[];
  generated: number[];
  cached: number[];
  gated: number[];
  totals: { generated: number; cached: number; gated: number };
}

export interface FeedbackRow {
  /** DISMISS | NOT_RELEVANT | SNOOZE (open-ended — unknowns are ignored). */
  action: string;
  /** Provider category; null when the provider row is unreachable. */
  category: string | null;
}

export interface FeedbackByCategory {
  category: string | null;
  dismissed: number;
  notRelevant: number;
  snoozed: number;
  total: number;
}

export interface AreaServiceRow {
  userId: string;
  providerId: string;
  providerName: string;
  category: string;
  state: string;
}

export interface AreaPreferenceRow {
  state: string;
  category: string;
  providerId: string;
  providerName: string;
  /** DISTINCT contributing users — what the k-anonymity floor is measured on. */
  userCount: number;
  serviceCount: number;
}

/** UTC calendar-day key (YYYY-MM-DD) for a Date. */
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The last `n` UTC day keys ending at `today`, oldest first. */
export function lastNDayKeys(n: number, today: Date = new Date()): string[] {
  const end = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(utcDayKey(new Date(end - i * 86_400_000)));
  }
  return keys;
}

/**
 * Defensive reader for the statusCounts Json column. Telemetry writers own
 * the shape, but a malformed row must never break the admin page — anything
 * that isn't a flat object of non-negative finite numbers is dropped.
 */
function readCounts(statusCounts: unknown): Record<string, number> {
  if (
    !statusCounts ||
    typeof statusCounts !== "object" ||
    Array.isArray(statusCounts)
  ) {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(
    statusCounts as Record<string, unknown>,
  )) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

type Buckets = Omit<SourceDayBucket, "day">;

const ZERO_BUCKETS: Buckets = { ok: 0, error: 0, notConfigured: 0, other: 0 };

/** Fold an open-ended counter map into the four health-panel buckets. */
function bucketize(counts: Record<string, number>): Buckets {
  const b: Buckets = { ...ZERO_BUCKETS };
  for (const [key, n] of Object.entries(counts)) {
    // cached + generated are successful user-path outcomes (a cache hit or a
    // fresh generation both served the user), so they count toward "ok".
    if (key === "ok" || key === "cached" || key === "generated") b.ok += n;
    else if (key === "error") b.error += n;
    else if (key === "not_configured") b.notConfigured += n;
    else b.other += n; // gated + any future outcome keys
  }
  return b;
}

/**
 * Panel 1 — per-source health over the window. Every known source is always
 * present (zero-filled → "off"); unknown sources found in the rows are
 * appended alphabetically so new telemetry never hides.
 */
export function buildSourceHealth(
  rows: DailyStatRow[],
  dayKeys: string[],
): SourceHealth[] {
  const daySet = new Set(dayKeys);
  const bySource = new Map<string, Map<string, Buckets>>();

  for (const row of rows) {
    const dk = utcDayKey(row.day);
    if (!daySet.has(dk)) continue;
    const buckets = bucketize(readCounts(row.statusCounts));
    let dayMap = bySource.get(row.source);
    if (!dayMap) {
      dayMap = new Map();
      bySource.set(row.source, dayMap);
    }
    // [day, source] is unique in the DB, but merge defensively anyway.
    const prev = dayMap.get(dk) ?? ZERO_BUCKETS;
    dayMap.set(dk, {
      ok: prev.ok + buckets.ok,
      error: prev.error + buckets.error,
      notConfigured: prev.notConfigured + buckets.notConfigured,
      other: prev.other + buckets.other,
    });
  }

  const known: readonly string[] = KNOWN_SOURCES;
  const extra = [...bySource.keys()].filter((s) => !known.includes(s)).sort();
  const ordered = [...known, ...extra];

  return ordered.map((source) => {
    const dayMap = bySource.get(source);
    const days: SourceDayBucket[] = dayKeys.map((day) => ({
      day,
      ...(dayMap?.get(day) ?? ZERO_BUCKETS),
    }));
    const totals = days.reduce(
      (acc, d) => ({
        ok: acc.ok + d.ok,
        error: acc.error + d.error,
        notConfigured: acc.notConfigured + d.notConfigured,
        other: acc.other + d.other,
      }),
      { ...ZERO_BUCKETS },
    );
    // "off" = no real attempts in the window (nothing or only
    // not_configured/gated noise). Otherwise classify on the error share.
    const attempts = totals.ok + totals.error;
    const status: SourceStatus =
      attempts === 0
        ? "off"
        : totals.error / attempts > DEGRADED_ERROR_RATIO
          ? "degraded"
          : "healthy";
    return { source, days, totals, status };
  });
}

/**
 * Panel 2 — generated / cached / gated daily series for one AI source
 * (briefing by default), zero-filled over the same window as the health
 * panel. Reads the raw counter keys (NOT the health buckets) because the
 * generated-vs-cached split is exactly what this panel is about.
 */
export function buildBriefingTrend(
  rows: DailyStatRow[],
  dayKeys: string[],
  source = "briefing",
): BriefingTrend {
  const byDay = new Map<string, Record<string, number>>();
  const daySet = new Set(dayKeys);
  for (const row of rows) {
    if (row.source !== source) continue;
    const dk = utcDayKey(row.day);
    if (!daySet.has(dk)) continue;
    const counts = readCounts(row.statusCounts);
    const prev = byDay.get(dk);
    if (prev) {
      for (const [k, n] of Object.entries(counts)) prev[k] = (prev[k] ?? 0) + n;
    } else {
      byDay.set(dk, { ...counts });
    }
  }

  const series = (key: string) =>
    dayKeys.map((day) => byDay.get(day)?.[key] ?? 0);
  const generated = series("generated");
  const cached = series("cached");
  const gated = series("gated");
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  return {
    days: [...dayKeys],
    generated,
    cached,
    gated,
    totals: {
      generated: sum(generated),
      cached: sum(cached),
      gated: sum(gated),
    },
  };
}

/**
 * Panel 3 — feedback action counts per provider category, busiest categories
 * first. Unknown action strings are ignored (the column is open-ended).
 */
export function aggregateFeedback(rows: FeedbackRow[]): FeedbackByCategory[] {
  const byCategory = new Map<string | null, FeedbackByCategory>();
  for (const row of rows) {
    const key = row.category ?? null;
    let agg = byCategory.get(key);
    if (!agg) {
      agg = { category: key, dismissed: 0, notRelevant: 0, snoozed: 0, total: 0 };
      byCategory.set(key, agg);
    }
    if (row.action === "DISMISS") agg.dismissed++;
    else if (row.action === "NOT_RELEVANT") agg.notRelevant++;
    else if (row.action === "SNOOZE") agg.snoozed++;
    else continue; // unknown action — don't count it anywhere
    agg.total++;
  }
  return [...byCategory.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    // Tie-break alphabetically; the uncategorized bucket sorts last.
    if (a.category === null) return b.category === null ? 0 : 1;
    if (b.category === null) return -1;
    return a.category.localeCompare(b.category);
  });
}

/**
 * Panel 4 — top providers per (state × category) from active Service rows,
 * with the k-anonymity floor applied on DISTINCT users per cohort (a single
 * power user with many services must never clear the floor — same rule as
 * the community-popularity endpoint).
 */
export function buildAreaPreferences(
  rows: AreaServiceRow[],
): AreaPreferenceRow[] {
  const groups = new Map<
    string,
    {
      state: string;
      category: string;
      providerId: string;
      providerName: string;
      users: Set<string>;
      serviceCount: number;
    }
  >();

  for (const row of rows) {
    if (!row.state || !row.providerId) continue;
    const state = row.state.toUpperCase();
    const key = `${state}\u0000${row.category}\u0000${row.providerId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        state,
        category: row.category,
        providerId: row.providerId,
        providerName: row.providerName,
        users: new Set(),
        serviceCount: 0,
      };
      groups.set(key, group);
    }
    group.users.add(row.userId);
    group.serviceCount++;
  }

  return [...groups.values()]
    .filter((g) => g.users.size >= PROVIDER_USER_FLOOR)
    .map((g) => ({
      state: g.state,
      category: g.category,
      providerId: g.providerId,
      providerName: g.providerName,
      userCount: g.users.size,
      serviceCount: g.serviceCount,
    }))
    .sort(
      (a, b) =>
        a.state.localeCompare(b.state) ||
        a.category.localeCompare(b.category) ||
        b.userCount - a.userCount ||
        b.serviceCount - a.serviceCount ||
        a.providerName.localeCompare(b.providerName),
    );
}
