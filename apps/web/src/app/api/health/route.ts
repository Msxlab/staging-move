import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { evaluateEnvReadiness } from "@/lib/env-catalog";

export const dynamic = "force-dynamic";

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
  // Coarse env-readiness (F-006): expose ONLY whether all REQUIRED env keys are
  // present + a count — never key names or values — so it's safe on this public
  // health endpoint while still surfacing a misconfigured deploy (e.g. in the
  // admin health card). The detailed which-key report is in the startup logs
  // (instrumentation.ts), never over the wire. Informational: it does not change
  // the healthy/unhealthy status (that stays tied to DB reachability).
  let env: { requiredOk: boolean; missingRequiredCount: number } | undefined;
  try {
    const missingRequiredCount = evaluateEnvReadiness().entries.filter((e) => e.missingRequired).length;
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
