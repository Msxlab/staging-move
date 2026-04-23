import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredRuntimeConfigValues } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

interface Check {
  status: "ok" | "fail" | "skip";
  durationMs?: number;
  detail?: string;
}

async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ ok: boolean; ms: number; err?: unknown }> {
  const t0 = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, err };
  }
}

export async function GET() {
  const runtimeValues = await getRequiredRuntimeConfigValues([
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "STRIPE_SECRET_KEY",
    "RESEND_API_KEY",
    "FIELD_ENCRYPTION_KEY",
    "R2_BUCKET",
    "R2_ENDPOINT",
    "NEXT_PUBLIC_IMGPROXY_URL",
    "R2_PUBLIC_BASE_URL",
  ]);

  const checks: Record<string, Check> = {};
  let healthy = true;

  const db = await timed(() => prisma.$queryRaw`SELECT 1`);
  checks.database = { status: db.ok ? "ok" : "fail", durationMs: db.ms };
  if (!db.ok) healthy = false;

  if (
    runtimeValues.UPSTASH_REDIS_REST_URL &&
    runtimeValues.UPSTASH_REDIS_REST_TOKEN
  ) {
    const redis = await timed(async () => {
      const res = await fetch(`${runtimeValues.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: {
          Authorization: `Bearer ${runtimeValues.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
    checks.redis = { status: redis.ok ? "ok" : "fail", durationMs: redis.ms };
  } else {
    checks.redis = {
      status: "skip",
      detail: "Not configured (in-memory fallback)",
    };
  }

  checks.stripe = {
    status: runtimeValues.STRIPE_SECRET_KEY ? "ok" : "skip",
    detail: runtimeValues.STRIPE_SECRET_KEY
      ? undefined
      : "STRIPE_SECRET_KEY not set",
  };

  checks.email = {
    status: runtimeValues.RESEND_API_KEY ? "ok" : "skip",
    detail: runtimeValues.RESEND_API_KEY
      ? undefined
      : "RESEND_API_KEY not set (logs only)",
  };

  const encOk = runtimeValues.FIELD_ENCRYPTION_KEY?.length === 64;
  checks.encryption = {
    status: encOk ? "ok" : "fail",
    detail: encOk ? undefined : "FIELD_ENCRYPTION_KEY missing or wrong length",
  };
  if (!encOk) healthy = false;

  const hasR2 = Boolean(runtimeValues.R2_BUCKET && runtimeValues.R2_ENDPOINT);
  const hasImageDelivery = Boolean(
    runtimeValues.NEXT_PUBLIC_IMGPROXY_URL || runtimeValues.R2_PUBLIC_BASE_URL,
  );
  checks.storage = {
    status: hasR2 ? "ok" : "skip",
    detail: hasR2
      ? hasImageDelivery
        ? "R2 storage configured with public delivery path"
        : "R2 storage configured; image delivery URL not set"
      : "R2 storage not configured",
  };

  const mem = process.memoryUsage();
  const memInfo = {
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
  };

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "unknown",
      uptimeSec: Math.floor(process.uptime()),
      memory: memInfo,
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
