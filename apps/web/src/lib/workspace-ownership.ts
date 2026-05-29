/**
 * Workspace ownership transfer. Used by the owner-initiated transfer endpoint
 * and by account deletion (auto-transfer a shared workspace to an heir before
 * the owner's user row is removed). Imports only prisma to stay cycle-free.
 *
 * NOTE: Workspace.ownerUserId is also the billing/entitlement anchor, so a
 * transfer moves which subscription resolves the workspace's plan/seat limits.
 */

import { prisma } from "@/lib/db";

/**
 * Transfer ownership from the current owner to another ACTIVE member in one
 * transaction: demote owner→ADMIN, promote target→OWNER, repoint ownerUserId.
 */
export async function transferWorkspaceOwnership(
  workspaceId: string,
  fromUserId: string,
  toUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (fromUserId === toUserId) return { ok: false, error: "That member is already the owner." };
  return prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { ownerUserId: true } });
    if (!ws || ws.ownerUserId !== fromUserId) return { ok: false, error: "Only the current owner can transfer ownership." };

    const target = await tx.workspaceMember.findFirst({
      where: { workspaceId, userId: toUserId, status: "ACTIVE" },
      select: { id: true, role: true },
    });
    if (!target) return { ok: false, error: "Choose an active member to receive ownership." };
    if (target.role === "CHILD" || target.role === "VIEW_ONLY") {
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
    return { ok: true };
  });
}

/**
 * Best heir for an auto-transfer (owner account deletion): the longest-tenured
 * ACTIVE ADMIN, else the longest-tenured ACTIVE MEMBER. null when the owner is
 * the only eligible member (caller then hard-deletes the workspace instead).
 */
export async function pickOwnershipHeir(workspaceId: string, excludeUserId: string): Promise<string | null> {
  const heir = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      status: "ACTIVE",
      userId: { not: excludeUserId },
      role: { in: ["ADMIN", "MEMBER"] },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }], // ADMIN before MEMBER, oldest first
    select: { userId: true },
  });
  return heir?.userId ?? null;
}
