import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveConsumerEntitlement } from "@/lib/consumer-entitlement";
import { getUserSession } from "@/lib/user-auth";
import { planSummaryForOwner, workspaceFeatureGate, workspacePlanLabel } from "@/lib/workspace-routes";

export const runtime = "nodejs";

/**
 * GET /api/workspaces — the workspaces the caller belongs to.
 * POST /api/workspaces — create a workspace (Family/Pro plan required).
 * POST stays gated by WORKSPACE_MODEL_ENABLED (404 when off). GET returns an
 * empty list when the feature is off so passive dashboard/settings probes do
 * not create browser console errors.
 */
export async function GET() {
  const off = await workspaceFeatureGate();
  if (off) {
    return NextResponse.json(
      { workspaces: [], workspaceModelEnabled: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
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
      // Count seats actually occupied — exclude SUSPENDED so the displayed
      // "x / limit" matches what invite-accept enforcement allows (it caps on
      // non-SUSPENDED members), instead of inflating the count with suspended rows.
      const memberCount = await prisma.workspaceMember.count({
        where: { workspaceId: m.workspace.id, status: { not: "SUSPENDED" } },
      });
      return {
        id: m.workspace.id,
        name: m.workspace.name,
        role: m.role,
        status: m.status,
        planLabel: summary.planLabel,
        seatLimit: summary.seatLimit,
        memberCount,
        // Every user auto-owns a personal workspace. When the caller is its sole
        // OWNER and the plan grants no extra seats, it's a solo data container —
        // not a household they manage. UIs use this to relabel it "Personal" and
        // de-emphasize the invite affordance (inviting is already seat-gated to 1).
        isPersonalSolo: m.role === "OWNER" && memberCount === 1 && summary.seatLimit <= 1,
        deletedAt: m.workspace.deletedAt,
      };
    }),
  );

  // A Family/Pro member keeps their auto-provisioned personal-solo workspace
  // alongside the shared household one, which reads as a confusing "second
  // workspace." Suppress that redundant personal-solo ONLY when it is safe to:
  //  - the user is an active member of >= 1 OTHER multi-seat workspace
  //    (the shared household/workspace they actually use), AND
  //  - the personal-solo holds NO scoped data (Address/Service/MovingPlan/Budget
  //    rows for that workspaceId all count 0).
  // DATA-SAFE: if the personal-solo has ANY scoped data, it is kept (relabeled
  // "Personal" via isPersonalSolo) so the user never loses access to it. We never
  // delete or mutate a workspace here — emptiness is purely about visibility.
  const activeMultiSeatCount = workspaces.filter(
    (w) => !w.isPersonalSolo && !w.deletedAt && w.status === "ACTIVE" && w.seatLimit > 1,
  ).length;

  const visibleWorkspaces = await Promise.all(
    workspaces.map(async (w) => {
      const isRedundantPersonalCandidate =
        w.isPersonalSolo && !w.deletedAt && activeMultiSeatCount >= 1;
      if (!isRedundantPersonalCandidate) return { workspace: w, hidden: false };

      // Count any scoped data this personal-solo holds. We include soft-deleted
      // rows so a workspace with recoverable data is never hidden out from under
      // the user. If anything exists, keep the workspace visible.
      const [addresses, services, movingPlans, budgets] = await Promise.all([
        prisma.address.count({ where: { workspaceId: w.id } }),
        prisma.service.count({ where: { workspaceId: w.id } }),
        prisma.movingPlan.count({ where: { workspaceId: w.id } }),
        prisma.budget.count({ where: { workspaceId: w.id } }),
      ]);
      const isEmpty = addresses + services + movingPlans + budgets === 0;
      return { workspace: w, hidden: isEmpty };
    }),
  );

  // Exclude the empty, redundant personal-solo entirely so it disappears from
  // both the list and the switcher; everything else (including any personal-solo
  // that DID have data) passes through unchanged.
  const filtered = visibleWorkspaces.filter((entry) => !entry.hidden).map((entry) => entry.workspace);

  return NextResponse.json({ workspaces: filtered }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await prisma.subscription.findUnique({ where: { userId: session.userId } });
  // Consumer create-workspace gate → consumer-free override (audit P1-2).
  const plan = String((await resolveConsumerEntitlement(sub)).entitlement.effectivePlan);
  if (plan !== "FAMILY" && plan !== "PRO") {
    return NextResponse.json({ error: "A Family or Pro plan is required to create a workspace." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 422 });

  // Cap workspaces per owner. The seat limit is per-workspace, so without a cap
  // an owner could create many workspaces and multiply their seats — bypassing
  // the plan's seat limit. The auto-provisioned personal workspace counts as 1.
  // (Product-tunable constant.)
  const MAX_OWNED_WORKSPACES = 3;
  const ownedCount = await prisma.workspace.count({ where: { ownerUserId: session.userId } });
  if (ownedCount >= MAX_OWNED_WORKSPACES) {
    return NextResponse.json(
      { error: `You can own at most ${MAX_OWNED_WORKSPACES} workspaces.` },
      { status: 409 },
    );
  }

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        ownerUserId: session.userId,
        name,
        members: { create: { userId: session.userId, role: "OWNER", status: "ACTIVE" } },
      },
      select: { id: true, name: true },
    });
    // Stamp the owner's existing personal rows into the new workspace so they
    // stay visible AND count toward the pooled workspace limit once workspace
    // mode is enabled (otherwise null-workspace rows vanish from scoped reads
    // and under-count the pool).
    const where = { userId: session.userId, workspaceId: null };
    await Promise.all([
      tx.address.updateMany({ where, data: { workspaceId: ws.id } }),
      tx.service.updateMany({ where, data: { workspaceId: ws.id } }),
      tx.movingPlan.updateMany({ where, data: { workspaceId: ws.id } }),
      tx.budget.updateMany({ where, data: { workspaceId: ws.id } }),
    ]);
    return ws;
  });

  const response = NextResponse.json({ ...workspace, planLabel: workspacePlanLabel(plan) });
  response.cookies.set("lf_workspace_id", workspace.id, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
