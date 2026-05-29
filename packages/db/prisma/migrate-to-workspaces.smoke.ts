/**
 * Live smoke for the workspace backfill. Seeds a throwaway user + address with
 * NULL workspaceId, runs the backfill, asserts the workspace/member/backfill,
 * re-runs to prove idempotency, then cleans up. Run:
 *   pnpm --filter @locateflow/db exec tsx prisma/migrate-to-workspaces.smoke.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { deriveName, migrateToWorkspaces } from "./migrate-to-workspaces";

const prisma = new PrismaClient();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  assert(deriveName("Ada", null) === "Ada's Workspace", "deriveName uses first name");
  assert(deriveName(null, null) === "My Move", "deriveName falls back to My Move");

  const email = `backfill-smoke-${Date.now()}@example.test`;
  const user = await prisma.user.create({ data: { email, firstName: "Backfill", lastName: "Smoke" } });
  const addr = await prisma.address.create({
    data: {
      userId: user.id,
      type: "HOME",
      street: "1 Test St",
      city: "Boston",
      state: "MA",
      zip: "02101",
      country: "USA",
      ownership: "OWN",
      startDate: new Date(),
    },
  });
  console.log(`Seeded user ${user.id} + address ${addr.id} (workspaceId null)`);

  await migrateToWorkspaces(prisma);

  const ws = await prisma.workspace.findFirst({ where: { ownerUserId: user.id } });
  const member = await prisma.workspaceMember.findFirst({ where: { userId: user.id } });
  const addrAfter = await prisma.address.findUnique({ where: { id: addr.id } });
  assert(!!ws, "personal workspace created");
  assert(member?.role === "OWNER" && member?.status === "ACTIVE", "OWNER membership created");
  assert(addrAfter?.workspaceId === ws?.id, "address backfilled with workspaceId");

  const before = await prisma.workspace.count();
  await migrateToWorkspaces(prisma);
  const after = await prisma.workspace.count();
  assert(before === after, `idempotent re-run created no new workspaces (${before} → ${after})`);

  // Cleanup — delete children before the OWNER user (Workspace.owner is RESTRICT).
  await prisma.address.deleteMany({ where: { userId: user.id } });
  await prisma.workspaceMember.deleteMany({ where: { userId: user.id } });
  await prisma.workspace.deleteMany({ where: { ownerUserId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("Cleaned up. Backfill smoke passed.");
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
