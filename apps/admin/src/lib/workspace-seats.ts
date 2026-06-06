/**
 * Admin-side workspace seat reconciliation.
 *
 * A minimal mirror of apps/web/src/lib/workspace-ownership.ts
 * `reconcileWorkspaceSeats`, kept local because the admin app is a separate
 * Next build and cannot import from apps/web. The seat ceiling and overflow/
 * restore semantics are identical (single source of truth for the limit is
 * `seatLimitForPlan` in @locateflow/shared); the only thing dropped is the
 * best-effort user-facing in-app notification, which relies on web-only
 * helpers (createInAppNotification) — admin mutations are already surfaced to
 * the user via the AdminAuditLog and out of band, so the seat flip itself is
 * not separately notified from the admin path.
 *
 * Called after an admin removes a member (a freed seat may let an OVERFLOW
 * member back in). Idempotent and best-effort.
 */

import { getEffectiveEntitlement, seatLimitForPlan } from "@locateflow/shared";
import { prisma } from "@/lib/db";

export async function reconcileWorkspaceSeats(
  workspaceId: string,
): Promise<{ overflowed: number; restored: number }> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerUserId: true },
  });
  if (!ws) return { overflowed: 0, restored: 0 };

  const sub = await prisma.subscription.findUnique({ where: { userId: ws.ownerUserId } });
  const eff = getEffectiveEntitlement(sub);
  // Owner is the billing anchor: while they have access the tier seat limit
  // applies; once access lapses the workspace collapses to a single seat.
  const limit = eff.hasAccess ? seatLimitForPlan(String(eff.effectivePlan)) : 1;

  const active = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    select: { id: true, role: true },
  });

  if (active.length > limit) {
    // Over the limit → demote the NEWEST non-owner ACTIVE members to OVERFLOW.
    const demoted = active
      .filter((m) => m.role !== "OWNER")
      .reverse()
      .slice(0, active.length - limit);
    if (demoted.length === 0) return { overflowed: 0, restored: 0 };
    await prisma.workspaceMember.updateMany({
      where: { id: { in: demoted.map((m) => m.id) } },
      data: { status: "OVERFLOW", overflowSince: new Date() },
    });
    return { overflowed: demoted.length, restored: 0 };
  }

  // Under/at the limit → restore the OLDEST OVERFLOW members into free seats.
  const overflow = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: "OVERFLOW" },
    orderBy: { joinedAt: "asc" },
    select: { id: true },
  });
  const freeSeats = limit - active.length;
  const restored = overflow.slice(0, Math.max(0, freeSeats));
  if (restored.length === 0) return { overflowed: 0, restored: 0 };
  await prisma.workspaceMember.updateMany({
    where: { id: { in: restored.map((m) => m.id) } },
    data: { status: "ACTIVE", overflowSince: null },
  });
  return { overflowed: 0, restored: restored.length };
}
