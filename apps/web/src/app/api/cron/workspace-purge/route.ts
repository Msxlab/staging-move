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
  // Collect the workspaces whose grace has elapsed, then delete their MovingPlans
  // BEFORE the workspace delete. Address.workspaceId / MovingPlan.workspaceId are
  // ON DELETE CASCADE, but MovingPlan.fromAddress/toAddress are ON DELETE RESTRICT —
  // so cascading a workspace's Addresses while its MovingPlans still reference them
  // would abort the entire purge with an FK error. Deleting the plans first mirrors
  // the account-deletion ordering. Inert until workspaceId stamping is enabled, but
  // correct in advance.
  const now = new Date();
  const targets = await rawPrisma.workspace.findMany({
    where: { deletedAt: { not: null }, deletionGraceUntil: { lt: now } },
    select: { id: true },
  });
  const ids = targets.map((w) => w.id);
  if (ids.length === 0) return NextResponse.json({ purged: 0 });
  await rawPrisma.movingPlan.deleteMany({ where: { workspaceId: { in: ids } } });
  const result = await rawPrisma.workspace.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ purged: result.count });
}

// Vercel Cron invokes via GET; POST kept for manual/system invocation.
export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
