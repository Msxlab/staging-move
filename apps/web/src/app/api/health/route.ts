import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Check {
  status: "ok" | "fail" | "skip";
  durationMs?: number;
  detail?: string;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; err?: unknown }> {
  const t0 = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, err };
  }
}

export async function GET() {
  const checks: Record<string, Check> = {};
  let healthy = true;

  const db = await timed(() => prisma.$queryRaw`SELECT 1`);
  checks.database = { status: db.ok ? "ok" : "fail", durationMs: db.ms };
  if (!db.ok) healthy = false;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = await timed(async () => {
      const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
    checks.redis = { status: redis.ok ? "ok" : "fail", durationMs: redis.ms };
  } else {
    checks.redis = { status: "skip", detail: "Not configured (in-memory fallback)" };
  }

  checks.stripe = {
    status: process.env.STRIPE_SECRET_KEY ? "ok" : "skip",
    detail: process.env.STRIPE_SECRET_KEY ? undefined : "STRIPE_SECRET_KEY not set",
  };

  checks.email = {
    status: process.env.RESEND_API_KEY ? "ok" : "skip",
    detail: process.env.RESEND_API_KEY ? undefined : "RESEND_API_KEY not set (logs only)",
  };

  const encOk = process.env.FIELD_ENCRYPTION_KEY?.length === 64;
  checks.encryption = {
    status: encOk ? "ok" : "fail",
    detail: encOk ? undefined : "FIELD_ENCRYPTION_KEY missing or wrong length",
  };
  if (!encOk) healthy = false;

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
