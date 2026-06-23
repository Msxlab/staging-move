/**
 * New-user workspace provisioning.
 *
 * The one-time backfill (packages/db/prisma/migrate-to-workspaces.ts) only
 * covers users that existed when it ran. This gives every NEW signup a personal
 * Workspace + OWNER membership so workspace-scoped features work for them once
 * WORKSPACE_MODEL_ENABLED flips on.
 *
 * Kept in its own module (imports only prisma + runtime config) to avoid an
 * import cycle with user-auth, which calls this on the OAuth path.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@locateflow/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

async function workspaceModelEnabled(): Promise<boolean> {
  const v = (await getRuntimeConfigValue("WORKSPACE_MODEL_ENABLED")) ?? process.env.WORKSPACE_MODEL_ENABLED ?? "";
  return v === "true" || v === "1";
}

/**
 * Idempotently provision a user's personal Workspace + OWNER membership.
 * Inert when the workspace model is off; best-effort (never throws) so it can
 * sit on the signup / OAuth path without risking auth. Safe to call repeatedly.
 */
export async function ensureWorkspaceDefaults(
  userId: string,
  // Accepts either the full app client (default) or an interactive
  // transaction client, so a caller wrapping signup in prisma.$transaction
  // can provision the workspace inside the same atomic unit.
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  try {
    if (!(await workspaceModelEnabled())) return;
    const existing = await tx.workspaceMember.findFirst({ where: { userId }, select: { id: true } });
    if (existing) return;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    const name = user?.firstName ? `${user.firstName}'s Workspace` : "My Workspace";
    await tx.workspace.create({
      data: {
        ownerUserId: userId,
        name,
        members: { create: { userId, role: "OWNER", status: "ACTIVE" } },
      },
    });
  } catch {
    // Best-effort: provisioning must never break auth. A user who slips through
    // is recovered by re-running the idempotent backfill before launch.
  }
}
