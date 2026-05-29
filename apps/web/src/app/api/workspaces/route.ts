import { NextRequest, NextResponse } from "next/server";
import { getEffectiveEntitlement } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { planSummaryForOwner, workspaceFeatureGate, workspacePlanLabel } from "@/lib/workspace-routes";

export const runtime = "nodejs";

/**
 * GET /api/workspaces — the workspaces the caller belongs to.
 * POST /api/workspaces — create a workspace (Family/Pro plan required).
 * Both gated by WORKSPACE_MODEL_ENABLED (404 when off).
 */
export async function GET() {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.userId },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      status: true,
      workspace: { select: { id: true, name: true, ownerUserId: true, deletedAt: true } },
    },
  });

  const workspaces = await Promise.all(
    memberships.map(async (m) => {
      const summary = await planSummaryForOwner(m.workspace.ownerUserId);
      return {
        id: m.workspace.id,
        name: m.workspace.name,
        role: m.role,
        status: m.status,
        planLabel: summary.planLabel,
        seatLimit: summary.seatLimit,
        memberCount: await prisma.workspaceMember.count({ where: { workspaceId: m.workspace.id } }),
        deletedAt: m.workspace.deletedAt,
      };
    }),
  );

  return NextResponse.json({ workspaces }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await prisma.subscription.findUnique({ where: { userId: session.userId } });
  const plan = String(getEffectiveEntitlement(sub).effectivePlan);
  if (plan !== "FAMILY" && plan !== "PRO") {
    return NextResponse.json({ error: "A Family or Pro plan is required to create a workspace." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 422 });

  const workspace = await prisma.workspace.create({
    data: {
      ownerUserId: session.userId,
      name,
      members: { create: { userId: session.userId, role: "OWNER", status: "ACTIVE" } },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ ...workspace, planLabel: workspacePlanLabel(plan) });
}
