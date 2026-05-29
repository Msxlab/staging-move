import { NextRequest, NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron/system auth: Bearer CRON_SECRET. */
async function isCronAuthorized(request: NextRequest): Promise<boolean> {
  const secret = (await getRuntimeConfigValue("CRON_SECRET")) ?? process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return bearer.length > 0 && bearer === secret;
}

/**
 * Hard-delete workspaces whose 7-day soft-delete grace has elapsed. rawPrisma
 * bypasses the soft-delete extension (which would otherwise rewrite this into a
 * no-op deletedAt update); the Workspace cascade physically removes its members,
 * invitations, and workspaceId-stamped Address/Service rows. Without this, a
 * soft-deleted workspace is un-restorable yet never purged. Daily.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await rawPrisma.workspace.deleteMany({
    where: { deletedAt: { not: null }, deletionGraceUntil: { lt: new Date() } },
  });
  return NextResponse.json({ purged: result.count });
}

// Vercel Cron invokes via GET; POST kept for manual/system invocation.
export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
