/**
 * Existing-user → personal Workspace backfill (Family/Pro migration, Phase 2).
 *
 * For every User: ensure a personal Workspace (they become OWNER) and stamp
 * workspaceId onto their Address/Service/MovingPlan/Budget rows. Idempotent and
 * resumable — re-running creates no duplicate workspaces and only fills rows
 * where workspaceId IS NULL. Uses the raw PrismaClient (no soft-delete filter)
 * so every row, including archived ones, gets a consistent workspaceId.
 *
 * Run: set DATABASE_URL, then
 *   pnpm --filter @locateflow/db exec tsx prisma/migrate-to-workspaces.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface BackfillStats {
  users: number;
  workspacesCreated: number;
  addresses: number;
  services: number;
  movingPlans: number;
  budgets: number;
}

/** Default workspace name from the user's name; "My Move" when none. */
export function deriveName(firstName: string | null, lastName: string | null): string {
  const first = (firstName ?? "").trim();
  if (first) return `${first}'s Workspace`;
  const last = (lastName ?? "").trim();
  if (last) return `${last}'s Workspace`;
  return "My Move";
}

export async function migrateToWorkspaces(client: PrismaClient = prisma): Promise<BackfillStats> {
  const batchSize = 200;
  let cursor: string | null = null;
  const stats: BackfillStats = { users: 0, workspacesCreated: 0, addresses: 0, services: 0, movingPlans: 0, budgets: 0 };

  for (;;) {
    const users = await client.user.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, firstName: true, lastName: true },
    });
    if (users.length === 0) break;

    // One transaction per user — bounds lock scope and avoids timeouts on
    // users with very large service/address counts.
    for (const user of users) {
      await client.$transaction(
        async (tx) => {
          const existing = await tx.workspace.findFirst({
            where: { ownerUserId: user.id },
            select: { id: true },
          });
          const workspaceId =
            existing?.id ??
            (
              await tx.workspace.create({
                data: { ownerUserId: user.id, name: deriveName(user.firstName, user.lastName) },
                select: { id: true },
              })
            ).id;
          if (!existing) stats.workspacesCreated += 1;

          await tx.workspaceMember.upsert({
            where: { workspaceId_userId: { workspaceId, userId: user.id } },
            create: { workspaceId, userId: user.id, role: "OWNER", status: "ACTIVE" },
            update: {},
          });

          const a = await tx.address.updateMany({ where: { userId: user.id, workspaceId: null }, data: { workspaceId } });
          const s = await tx.service.updateMany({ where: { userId: user.id, workspaceId: null }, data: { workspaceId } });
          const m = await tx.movingPlan.updateMany({ where: { userId: user.id, workspaceId: null }, data: { workspaceId } });
          const b = await tx.budget.updateMany({ where: { userId: user.id, workspaceId: null }, data: { workspaceId } });
          stats.addresses += a.count;
          stats.services += s.count;
          stats.movingPlans += m.count;
          stats.budgets += b.count;
        },
        { timeout: 60_000 },
      );
      stats.users += 1;
    }

    cursor = users[users.length - 1]!.id;
    console.log(`[migrate] batch done, cursor=${cursor}, stats=${JSON.stringify(stats)}`);
  }

  console.log(`[migrate] complete: ${JSON.stringify(stats)}`);
  return stats;
}

// Auto-run only when invoked directly (not when imported by the smoke).
const entry = (process.argv[1] ?? "").replace(/\\/g, "/");
if (/migrate-to-workspaces\.ts$/.test(entry)) {
  migrateToWorkspaces()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    });
}
