/**
 * Cron: per-source integration error-ratio watchdog.
 *
 * Reads IntegrationDailyStat (one statusCounts JSON per source per UTC day)
 * over a short trailing window, collapses it into per-source total / failure
 * counts, and emits a security event when a source's error ratio crosses a
 * threshold — so a degraded upstream connector (FCC, electric, NRI, radon,
 * water, air, NWS, briefing, dossier) surfaces on the security dashboard
 * instead of silently failing every lookup.
 *
 * Read-only: this never writes to IntegrationDailyStat. The only side effect
 * is the best-effort emitSecurityEvent (which never throws).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardCronRequest } from "@/lib/cron-guard";
import { emitSecurityEvent } from "@/lib/security-events";

// Trailing window the ratio is computed over.
const WINDOW_DAYS = 1;
// Minimum attempts before a ratio is meaningful — avoids alerting on a single
// failed call when traffic is near zero.
const MIN_SAMPLE = 20;
// Error-ratio (failures / total) at or above which we raise an event.
const ERROR_RATIO_THRESHOLD = 0.5;

// Status keys are free-form per connector, so failure detection is heuristic:
// any key that NAMES a failure mode is a failure; everything else is success.
// Mirrors summarizeIntegrationHealth in the admin-monthly-report cron.
const FAILURE_KEY = /error|fail|timeout|unavailable|reject/i;

function summarize(
  rows: Array<{ source: string; statusCounts: unknown }>,
): Array<{ source: string; total: number; failures: number }> {
  const bySource = new Map<string, { total: number; failures: number }>();
  for (const row of rows) {
    if (!row.statusCounts || typeof row.statusCounts !== "object" || Array.isArray(row.statusCounts)) {
      continue;
    }
    const agg = bySource.get(row.source) ?? { total: 0, failures: 0 };
    for (const [status, value] of Object.entries(row.statusCounts as Record<string, unknown>)) {
      const n = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
      agg.total += n;
      if (FAILURE_KEY.test(status)) agg.failures += n;
    }
    bySource.set(row.source, agg);
  }
  return [...bySource.entries()].map(([source, agg]) => ({ source, ...agg }));
}

async function runHealthCheck() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await prisma.integrationDailyStat
    .findMany({
      where: { day: { gte: windowStart } },
      select: { source: true, statusCounts: true },
    })
    .catch(() => [] as Array<{ source: string; statusCounts: unknown }>);

  const summaries = summarize(rows);
  const unhealthy = summaries.filter(
    (s) => s.total >= MIN_SAMPLE && s.failures / s.total >= ERROR_RATIO_THRESHOLD,
  );

  for (const s of unhealthy) {
    const errorRatio = Math.round((s.failures / s.total) * 1000) / 1000;
    emitSecurityEvent({
      type: "LIMITER_DEGRADED",
      severity: "error",
      group: "integration",
      key: s.source,
      context: {
        source: s.source,
        total: s.total,
        failures: s.failures,
        errorRatio,
        threshold: ERROR_RATIO_THRESHOLD,
        windowDays: WINDOW_DAYS,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    sources: summaries.length,
    unhealthy: unhealthy.map((s) => ({
      source: s.source,
      total: s.total,
      failures: s.failures,
      errorRatio: Math.round((s.failures / s.total) * 1000) / 1000,
    })),
    timestamp: now.toISOString(),
  });
}

export async function GET(req: NextRequest) {
  const guard = await guardCronRequest(req, "integration-health");
  if (!guard.ok) return guard.response;
  return runHealthCheck();
}

export async function POST(req: NextRequest) {
  const guard = await guardCronRequest(req, "integration-health");
  if (!guard.ok) return guard.response;
  return runHealthCheck();
}
