import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildReadinessReport, getReadinessConfigKeys } from "@/lib/production-readiness";
import { getRequiredRuntimeConfigValues } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEALTH_PROBE_TIMEOUT_MS = 2_500;

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

async function isReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const ready = await isReady();
  // Coarse production readiness: expose only pass/fail and count, never key
  // names or values. Keep status tied to DB liveness; detailed readiness lives
  // at /api/ready where Runtime Config DB and auth fallback rules are included.
  let env: { requiredOk: boolean; missingRequiredCount: number } | undefined;
  try {
    const effectiveConfig =
      (await withTimeout(
        getRequiredRuntimeConfigValues(getReadinessConfigKeys()),
        HEALTH_PROBE_TIMEOUT_MS,
      )) ?? undefined;
    const report = buildReadinessReport(process.env, undefined, effectiveConfig);
    const missingRequiredCount = report.issues.filter((issue) => issue.severity === "fail").length;
    env = { requiredOk: missingRequiredCount === 0, missingRequiredCount };
  } catch {
    env = undefined;
  }
  return NextResponse.json(
    {
      status: ready ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      ready,
      ...(env ? { env } : {}),
    },
    { status: ready ? 200 : 503 },
  );
}
