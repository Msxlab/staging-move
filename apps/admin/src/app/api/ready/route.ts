import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROBE_TIMEOUT_MS = 2_500;

function productionLike(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = (env.APP_ENV || env.VERCEL_ENV || "").toLowerCase();
  return ["production", "staging", "preview"].includes(explicit) || (!explicit && env.NODE_ENV === "production");
}

function hasMinSecret(value: string | undefined, minLength = 32): boolean {
  if (!value || value.length < minLength) return false;
  if (/^(test|dev|dummy|changeme)/i.test(value)) return false;
  return !value.includes("REPLACE");
}

function isHexKey(value: string | undefined, expectedLength = 64): boolean {
  return Boolean(value && new RegExp(`^[0-9a-fA-F]{${expectedLength}}$`).test(value));
}

function checkRequiredEnv(): number {
  let failures = 0;
  if (!process.env.DATABASE_URL) failures += 1;
  if (!hasMinSecret(process.env.ADMIN_JWT_SECRET)) failures += 1;
  if (!isHexKey(process.env.FIELD_ENCRYPTION_KEY)) failures += 1;

  if (productionLike()) {
    if (!process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL.includes("REPLACE")) failures += 1;
    if (!process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN.includes("REPLACE")) failures += 1;
  }

  return failures;
}

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

export async function GET() {
  const missingRequiredCount = checkRequiredEnv();
  const dbReady = (await withTimeout(probeDatabase(), PROBE_TIMEOUT_MS)) === true;
  const ready = missingRequiredCount === 0 && dbReady;

  return NextResponse.json(
    {
      ready,
      service: "admin",
      productionLike: productionLike(),
      requiredOk: missingRequiredCount === 0,
      missingRequiredCount,
      database: dbReady ? "ready" : "unavailable",
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
