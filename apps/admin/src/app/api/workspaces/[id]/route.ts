import { NextRequest, NextResponse } from "next/server";
import { getEffectiveEntitlement, seatLimitForPlan } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { maskEmail } from "@/lib/privacy";

export const dynamic = "force-dynamic";

function planLabel(plan: string): string {
  if (plan === "FAMILY") return "Household";
  if (plan === "PRO") return "Workspace";
  return "Solo";
}

/**
 * Admin detail of a single household: owner, full member roster (role, status,
 * joined/last-active) and, for each member, how many records they entered in
 * the workspace (addresses / services / budgets) — the "who entered what, by
 * role" view. Pending invitations included. users:canRead (VIEWER floor).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("users", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;

    const ws = await prisma.workspace.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      createdAt: true,
      deletedAt: true,
      ownerUserId: true,
      owner: { select: { id: true, email: true, firstName: true, lastName: true, deletedAt: true } },
      members: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          userId: true,
          role: true,
          status: true,
          managedSyncEnabled: true,
          joinedAt: true,
          lastActiveAt: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, deletedAt: true } },
        },
      },
      invitations: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true, invitedEmail: true, role: true, status: true, expiresAt: true, createdAt: true },
      },
    },
  });

  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const ownerSub = await prisma.subscription.findUnique({ where: { userId: ws.ownerUserId } });
  const plan = String(getEffectiveEntitlement(ownerSub).effectivePlan);

  // Per-member authorship: count records each member entered IN this workspace.
  const [addrCounts, svcCounts, budgetCounts] = await Promise.all([
    prisma.address.groupBy({ by: ["userId"], where: { workspaceId: id }, _count: { _all: true } }),
    prisma.service.groupBy({ by: ["userId"], where: { workspaceId: id }, _count: { _all: true } }),
    prisma.budget.groupBy({ by: ["userId"], where: { workspaceId: id }, _count: { _all: true } }),
  ]);
  const toMap = (arr: Array<{ userId: string; _count: { _all: number } }>) =>
    new Map(arr.map((r) => [r.userId, r._count._all]));
  const aMap = toMap(addrCounts);
  const sMap = toMap(svcCounts);
  const bMap = toMap(budgetCounts);

  const members = ws.members.map((m) => {
    const u = m.user;
    return {
      id: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      managedSyncEnabled: m.managedSyncEnabled,
      joinedAt: m.joinedAt,
      lastActiveAt: m.lastActiveAt,
      name: u?.deletedAt ? null : [u?.firstName, u?.lastName].filter(Boolean).join(" ") || null,
      email: u?.deletedAt ? null : u?.email ? maskEmail(u.email) : null,
      deleted: Boolean(u?.deletedAt),
      entered: {
        addresses: aMap.get(m.userId) ?? 0,
        services: sMap.get(m.userId) ?? 0,
        budgets: bMap.get(m.userId) ?? 0,
      },
    };
  });

  const activeSeats = members.filter((m) => m.status !== "SUSPENDED").length;

  return NextResponse.json(
    {
      workspace: {
        id: ws.id,
        name: ws.name,
        createdAt: ws.createdAt,
        deletedAt: ws.deletedAt,
        plan,
        planLabel: planLabel(plan),
        seatLimit: seatLimitForPlan(plan),
        activeSeats,
        owner: ws.owner?.deletedAt
          ? { id: ws.owner.id, email: null, name: null, deleted: true }
          : {
              id: ws.owner?.id ?? null,
              email: ws.owner?.email ? maskEmail(ws.owner.email) : null,
              name: [ws.owner?.firstName, ws.owner?.lastName].filter(Boolean).join(" ") || null,
            },
        members,
        invitations: ws.invitations.map((inv) => ({
          id: inv.id,
          email: maskEmail(inv.invitedEmail),
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
        })),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to load workspace detail:", error);
    return NextResponse.json({ error: "Failed to load workspace" }, { status: 500 });
  }
}
