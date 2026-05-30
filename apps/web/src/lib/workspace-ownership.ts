/**
 * Workspace ownership transfer. Used by the owner-initiated transfer endpoint
 * and by account deletion (auto-transfer a shared workspace to an heir before
 * the owner's user row is removed). Also emits best-effort in-app seat-change
 * notices when reconcile demotes a member to read-only OVERFLOW or restores them.
 *
 * NOTE: Workspace.ownerUserId is also the billing/entitlement anchor, so a
 * transfer moves which subscription resolves the workspace's plan/seat limits.
 */

import { getEffectiveEntitlement, seatLimitForPlan } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { createInAppNotification } from "@/lib/in-app-notifications";

/** Best-effort in-app notice when a member's seat status flips (read-only ↔ full). */
async function notifySeatChange(userIds: Array<string | null | undefined>, demoted: boolean, workspaceName: string): Promise<void> {
  for (const userId of userIds) {
    if (!userId) continue;
    await createInAppNotification({
      userId,
      type: "WORKSPACE_MEMBERSHIP",
      title: demoted ? "Workspace access is now read-only" : "Full workspace access restored",
      body: demoted
        ? `${workspaceName} reached its plan's seat limit, so your access is read-only for now. Your data is safe — full access returns when a seat frees up or the plan is upgraded.`
        : `A seat opened up in ${workspaceName}, so your full access is back.`,
      href: "/settings/workspace",
    }).catch(() => {});
  }
}

/**
 * Transfer ownership from the current owner to another ACTIVE member in one
 * transaction: demote owner→ADMIN, promote target→OWNER, repoint ownerUserId.
 */
export async function transferWorkspaceOwnership(
  workspaceId: string,
  fromUserId: string,
  toUserId: string,
  options: { allowAnyRole?: boolean } = {},
): Promise<{ ok: boolean; error?: string }> {
  if (fromUserId === toUserId) return { ok: false, error: "That member is already the owner." };
  const result = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { ownerUserId: true } });
    if (!ws || ws.ownerUserId !== fromUserId) return { ok: false, error: "Only the current owner can transfer ownership." };

    const target = await tx.workspaceMember.findFirst({
      where: { workspaceId, userId: toUserId, status: "ACTIVE" },
      select: { id: true, role: true },
    });
    if (!target) return { ok: false, error: "Choose an active member to receive ownership." };
    // A user-initiated transfer can only hand ownership to a MEMBER/ADMIN.
    // allowAnyRole is the forced auto-transfer (owner account deletion): it may
    // promote a CHILD/VIEW_ONLY so the workspace + everyone's data survives
    // instead of being deleted.
    if (!options.allowAnyRole && (target.role === "CHILD" || target.role === "VIEW_ONLY")) {
      return { ok: false, error: "Ownership can only go to a member or admin." };
    }

    const current = await tx.workspaceMember.findFirst({
      where: { workspaceId, userId: fromUserId },
      select: { id: true },
    });
    if (current) {
      await tx.workspaceMember.update({ where: { id: current.id }, data: { role: "ADMIN" } });
    }
    await tx.workspaceMember.update({ where: { id: target.id }, data: { role: "OWNER" } });
    await tx.workspace.update({ where: { id: workspaceId }, data: { ownerUserId: toUserId } });
    return { ok: true as const };
  });

  // Ownership is the billing/entitlement anchor, so the workspace's seat limit
  // is now governed by the NEW owner's plan (which may be smaller). Reconcile
  // so over-limit members are demoted to OVERFLOW (or restored if larger).
  if (result.ok) await reconcileWorkspaceSeats(workspaceId).catch(() => {});
  return result;
}

/**
 * Best heir for an auto-transfer (owner account deletion): the longest-tenured
 * ACTIVE ADMIN, else the longest-tenured ACTIVE MEMBER. With includeAnyRole, a
 * final fallback returns the longest-tenured ACTIVE member of ANY role
 * (incl. CHILD/VIEW_ONLY) so a parent deleting their account doesn't destroy a
 * child's data. null only when the owner is the workspace's sole member (caller
 * then hard-deletes the now-empty workspace).
 */
export async function pickOwnershipHeir(
  workspaceId: string,
  excludeUserId: string,
  options: { includeAnyRole?: boolean } = {},
): Promise<string | null> {
  const preferred = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      status: "ACTIVE",
      userId: { not: excludeUserId },
      role: { in: ["ADMIN", "MEMBER"] },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }], // ADMIN before MEMBER, oldest first
    select: { userId: true },
  });
  if (preferred) return preferred.userId;
  if (!options.includeAnyRole) return null;
  const anyMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId, status: "ACTIVE", userId: { not: excludeUserId } },
    orderBy: { joinedAt: "asc" },
    select: { userId: true },
  });
  return anyMember?.userId ?? null;
}

/**
 * Reconcile a workspace's members against its (owner-resolved) seat limit after
 * a plan change. Over the limit → demote the NEWEST non-owner ACTIVE members to
 * OVERFLOW (read-only via the permission matrix). Under the limit → restore the
 * OLDEST OVERFLOW members to ACTIVE. The OWNER always keeps a seat. Idempotent.
 */
export async function reconcileWorkspaceSeats(workspaceId: string): Promise<{ overflowed: number; restored: number }> {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerUserId: true, name: true } });
  if (!ws) return { overflowed: 0, restored: 0 };
  const wsName = ws.name || "your workspace";
  const sub = await prisma.subscription.findUnique({ where: { userId: ws.ownerUserId } });
  const eff = getEffectiveEntitlement(sub);
  // The owner is the billing/entitlement anchor. While they have access
  // (active, trial, or grace) the normal tier seat limit applies. Once access
  // has lapsed (canceled / refunded / expired → hasAccess false) the workspace
  // collapses to a single seat, demoting non-owner members to OVERFLOW until
  // the owner is paid again — otherwise members keep write access to a
  // workspace nobody is paying for.
  const limit = eff.hasAccess ? seatLimitForPlan(String(eff.effectivePlan)) : 1;

  const active = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    select: { id: true, role: true, userId: true },
  });

  if (active.length > limit) {
    const demoted = active.filter((m) => m.role !== "OWNER").reverse() // newest first
      .slice(0, active.length - limit);
    if (demoted.length === 0) return { overflowed: 0, restored: 0 };
    await prisma.workspaceMember.updateMany({
      where: { id: { in: demoted.map((m) => m.id) } },
      data: { status: "OVERFLOW", overflowSince: new Date() },
    });
    await notifySeatChange(demoted.map((m) => m.userId), true, wsName);
    return { overflowed: demoted.length, restored: 0 };
  }

  // Under (or at) the limit → restore overflow members into any free seats.
  const overflow = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: "OVERFLOW" },
    orderBy: { joinedAt: "asc" },
    select: { id: true, userId: true },
  });
  const freeSeats = limit - active.length;
  const restored = overflow.slice(0, Math.max(0, freeSeats));
  if (restored.length === 0) return { overflowed: 0, restored: 0 };
  await prisma.workspaceMember.updateMany({
    where: { id: { in: restored.map((m) => m.id) } },
    data: { status: "ACTIVE", overflowSince: null },
  });
  await notifySeatChange(restored.map((m) => m.userId), false, wsName);
  return { overflowed: 0, restored: restored.length };
}

/** Reconcile every workspace a user OWNS (call after their plan changes). */
export async function reconcileSeatsForOwner(ownerUserId: string): Promise<void> {
  const owned = await prisma.workspace.findMany({ where: { ownerUserId }, select: { id: true } });
  for (const ws of owned) {
    await reconcileWorkspaceSeats(ws.id).catch(() => {});
  }
}
