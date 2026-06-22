/**
 * Production readiness probe.
 *
 * Distinct from /api/health (which is a liveness check — "the process is
 * up and the DB responds"). This endpoint validates that the production
 * environment has the secrets, encryption keys, Redis wiring, and
 * external URLs required to handle real traffic safely. It returns 503
 * if any critical config is missing or weak so orchestrators (Kubernetes
 * readiness probes, DigitalOcean health checks, Cloudflare load
 * balancer) refuse to send traffic until the deployment is fixed.
 *
 * The body never includes secret values OR the failing key names — only
 * boolean/count signals (requiredOk, missingRequiredCount, warningCount) plus a
 * database status. Safe to expose publicly: an orchestrator learns whether the
 * deploy is ready without any recon-useful config detail.
 */

import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildReadinessReport,
  getReadinessConfigKeys,
} from "@/lib/production-readiness";
import { getRequiredRuntimeConfigValues } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const READINESS_PROBE_TIMEOUT_MS = 2_500;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function probeDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const effectiveConfig =
    (await withTimeout(
      getRequiredRuntimeConfigValues(getReadinessConfigKeys()),
      READINESS_PROBE_TIMEOUT_MS,
    )) ?? undefined;
  const report = buildReadinessReport(process.env, undefined, effectiveConfig);
  const dbReady = (await withTimeout(probeDatabase(), READINESS_PROBE_TIMEOUT_MS)) === true;

  const overallReady = report.ready && dbReady;
  const soft = request.nextUrl.searchParams.get("soft") === "1";

  return NextResponse.json(
    {
      ready: overallReady,
      productionLike: report.productionLike,
      requiredOk: report.failCount === 0,
      missingRequiredCount: report.failCount,
      warningCount: report.warnCount,
      database: dbReady ? "ready" : "unavailable",
      ...(soft ? { soft: true, readinessStatus: overallReady ? 200 : 503 } : {}),
      timestamp: new Date().toISOString(),
    },
    {
      status: soft ? 200 : overallReady ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
