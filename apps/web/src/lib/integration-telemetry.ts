/**
 * Fire-and-forget integration telemetry.
 *
 * Records the per-request OUTCOME of each external-data integration (fcc,
 * electric, nri, radon, water, air, nws, hud_housing, ev_charging) plus the two composite AI surfaces
 * (briefing, dossier) into `IntegrationDailyStat` — one row per (UTC day,
 * source) whose `statusCounts` JSON is an open-ended counter map, e.g.
 * `{"ok": 41, "error": 2, "not_configured": 7}`.
 *
 * HOUSE RULE — this module may NEVER add latency or failures to a user path:
 *   - `recordIntegrationOutcome` is a synchronous in-process buffer push
 *     (no awaits, no I/O) and is wrapped so it never throws;
 *   - the buffer is flushed in the background every FLUSH_INTERVAL_MS or once
 *     FLUSH_EVENT_THRESHOLD events accumulate, whichever comes first;
 *   - the flush itself is best-effort: any prisma failure is swallowed and the
 *     affected counters are simply dropped (never re-queued, so the buffer
 *     cannot grow unboundedly behind a broken database).
 *
 * Counts live in process memory between flushes, so a crash/redeploy loses at
 * most ~30s of counters — acceptable by design for trend-grade telemetry.
 * The flush timer is unref'd so it never keeps the process alive.
 *
 * Read side: the admin app has its own Prisma client over the same database
 * (`apps/admin/src/lib/db.ts` → `@locateflow/db`), so dashboards query
 * `IntegrationDailyStat` directly — there is deliberately no web API for it.
 */

import { prisma } from "@/lib/db";

/** Known integration sources. Matches the schema comment on `source`. */
export type IntegrationSource =
  | "fcc"
  | "electric"
  | "nri"
  | "radon"
  | "water"
  | "air"
  | "nws"
  | "hud_housing"
  | "ev_charging"
  // Pro "Neighborhood Intelligence" dossier bundle. Each source records its own
  // health: census (US Census ACS area economics), walkability (EPA National
  // Walkability Index), schools (nearby public-school directory). Statuses:
  // "ok" | "error" | "no_location" | "not_configured" | "gated" (non-Pro plan).
  | "census"
  | "walkability"
  | "schools"
  | "briefing"
  | "dossier"
  // Synthetic uptime monitor (api/cron/uptime-check) — "ok" | "error" per
  // probed public surface, charted by the admin Insights health panel.
  | "uptime";

/** Flush at most this often when events trickle in slowly. */
const FLUSH_INTERVAL_MS = 30_000;
/** ...or immediately once this many un-flushed events accumulate. */
const FLUSH_EVENT_THRESHOLD = 100;

/** Buffered counters keyed by `${utcDay}|${source}` → { status: count }. */
const buffer = new Map<string, Record<string, number>>();
let pendingEvents = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** UTC day key, e.g. "2026-06-10" — captured at RECORD time (not flush time)
 *  so events buffered just before UTC midnight land on the correct row. */
function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushIntegrationTelemetry();
  }, FLUSH_INTERVAL_MS);
  // Never keep the process alive just to flush telemetry (absent in some
  // non-Node runtimes, hence the optional call).
  flushTimer.unref?.();
}

/**
 * Record one integration outcome. Synchronous, allocation-light, never throws.
 *
 * `status` is intentionally an open string — each integration lib has its own
 * status union ("ok" | "error" | "not_configured" | "no_location" | ...) and
 * the JSON counter map absorbs new statuses without a migration.
 */
export function recordIntegrationOutcome(source: IntegrationSource, status: string): void {
  try {
    if (!source || !status) return;
    const key = `${utcDayKey()}|${source}`;
    const counts = buffer.get(key) ?? {};
    counts[status] = (counts[status] ?? 0) + 1;
    buffer.set(key, counts);
    pendingEvents += 1;
    if (pendingEvents >= FLUSH_EVENT_THRESHOLD) {
      void flushIntegrationTelemetry();
    } else {
      scheduleFlush();
    }
  } catch {
    // Telemetry must never surface into a user path.
  }
}

/**
 * Convenience for routes that report several sources at one composition
 * point — keeps the route hook to a single statement. Never throws.
 */
export function recordIntegrationOutcomes(
  outcomes: Partial<Record<IntegrationSource, string | null | undefined>>,
): void {
  try {
    for (const [source, status] of Object.entries(outcomes)) {
      if (typeof status === "string" && status) {
        recordIntegrationOutcome(source as IntegrationSource, status);
      }
    }
  } catch {
    // Never throws by contract.
  }
}

/** Sum two counter maps. Non-numeric / negative garbage in a stored JSON row
 *  is ignored rather than poisoning the merge. */
function mergeCounts(
  existing: unknown,
  increments: Record<string, number>,
): Record<string, number> {
  const merged: Record<string, number> = {};
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    for (const [status, count] of Object.entries(existing as Record<string, unknown>)) {
      if (typeof count === "number" && Number.isFinite(count) && count > 0) {
        merged[status] = Math.floor(count);
      }
    }
  }
  for (const [status, count] of Object.entries(increments)) {
    merged[status] = (merged[status] ?? 0) + count;
  }
  return merged;
}

/** Persist one buffered (day, source) entry: read-merge-write on the
 *  UNIQUE(day, source) row, with a create-race retry. Throws to the caller,
 *  which treats every failure as best-effort. */
async function persistEntry(
  dayKey: string,
  source: string,
  increments: Record<string, number>,
): Promise<void> {
  const day = new Date(`${dayKey}T00:00:00.000Z`);
  const where = { day_source: { day, source } } as const;

  const existing = await prisma.integrationDailyStat.findUnique({ where });
  if (existing) {
    await prisma.integrationDailyStat.update({
      where,
      data: { statusCounts: mergeCounts(existing.statusCounts, increments) },
    });
    return;
  }
  try {
    await prisma.integrationDailyStat.create({
      data: { day, source, statusCounts: mergeCounts(null, increments) },
    });
  } catch {
    // Lost the create race to a concurrent instance — merge into its row.
    const raced = await prisma.integrationDailyStat.findUnique({ where });
    if (!raced) return; // Row vanished again; drop (best-effort).
    await prisma.integrationDailyStat.update({
      where,
      data: { statusCounts: mergeCounts(raced.statusCounts, increments) },
    });
  }
}

/**
 * Flush all buffered counters to the database. Best-effort: failed entries are
 * dropped, never re-queued. Resolves (never rejects) — safe to `void`.
 *
 * The buffer is snapshotted and cleared SYNCHRONOUSLY before any await, so
 * outcomes recorded while a flush is in flight land in a fresh buffer and
 * schedule their own flush — no events are double-counted or lost to races
 * within this process.
 */
export async function flushIntegrationTelemetry(): Promise<void> {
  try {
    if (buffer.size === 0) {
      pendingEvents = 0;
      return;
    }
    const entries = [...buffer.entries()];
    buffer.clear();
    pendingEvents = 0;
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    for (const [key, increments] of entries) {
      const sep = key.indexOf("|");
      const dayKey = key.slice(0, sep);
      const source = key.slice(sep + 1);
      try {
        await persistEntry(dayKey, source, increments);
      } catch {
        // Best-effort only — drop this entry's counters.
      }
    }
  } catch {
    // Flush may never throw into a caller.
  }
}

/** Test-only: clear buffer + timer state between cases. */
export function __resetIntegrationTelemetryForTests(): void {
  buffer.clear();
  pendingEvents = 0;
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
