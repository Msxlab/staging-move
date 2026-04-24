import { db, withSoftDelete } from "../../../../packages/db/src/index";

/**
 * User-facing Prisma client.
 *
 * Applies the `withSoftDelete` extension globally so read queries
 * (`findMany`, `findUnique`, `findFirst`, `count`) on the models listed
 * in `SOFT_DELETE_MODELS` — User, Address, Service, MovingPlan,
 * Budget, ServiceProvider — automatically exclude rows
 * with `deletedAt != null`. Write-path `delete` / `deleteMany` calls on
 * those models are rewritten into `update`s that stamp `deletedAt`.
 *
 * Route handlers under `apps/web/src/app/api/*` should import this as
 * the default — user code should never see a soft-deleted row without
 * asking for it. If a specific route needs the raw rows (e.g. the
 * retention cron that hard-deletes after a grace window, or an admin
 * "restore deleted" flow), import `rawPrisma` instead.
 */
export const prisma = db.$extends(withSoftDelete);

/**
 * Raw Prisma client — no extensions. Use ONLY when you need to see or
 * hard-delete soft-deleted rows. Callers: data-retention cron,
 * admin-adjacent restore flows, backup export.
 */
export const rawPrisma = db;

export { db };
