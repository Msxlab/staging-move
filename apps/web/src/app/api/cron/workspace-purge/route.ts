import { NextRequest, NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db";
import { guardCronRequest } from "@/lib/cron-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hard-delete workspaces whose 7-day soft-delete grace has elapsed. rawPrisma
 * bypasses the soft-delete extension (which would otherwise rewrite this into a
 * no-op deletedAt update); the Workspace cascade physically removes its members,
 * invitations, and workspaceId-stamped Address/Service rows. Without this, a
 * soft-deleted workspace is un-restorable yet never purged. Daily.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  // Shared cron guard (constant-time secret + per-route rate limit), replacing
  // a bespoke bearer===secret check with no rate limit.
  const guard = await guardCronRequest(request, "workspace-purge");
  if (!guard.ok) return guard.response;
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
