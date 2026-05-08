import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
  return NextResponse.json(
    {
      status: ready ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      ready,
    },
    { status: ready ? 200 : 503 },
  );
}
