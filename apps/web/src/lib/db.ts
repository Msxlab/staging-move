import { db, dbUnsafe } from "../../../../packages/db/src/index";

/**
 * User-facing Prisma client.
 *
 * The default `db` exported from `@locateflow/db` ships with the
 * `withSoftDelete` extension applied: read queries
 * (`findMany`, `findUnique`, `findFirst`, `count`, `aggregate`,
 * `groupBy`) on the models listed in `SOFT_DELETE_MODELS` automatically
 * exclude rows with `deletedAt != null`. Write-path `delete` /
 * `deleteMany` calls on those models are rewritten into `update`s that
 * stamp `deletedAt`.
 *
 * Route handlers under `apps/web/src/app/api/*` should import this as
 * the default — user code should never see a soft-deleted row without
 * asking for it. If a specific route needs the raw rows (e.g. the
 * retention cron that hard-deletes after a grace window, or an admin
 * "restore deleted" flow), import `rawPrisma` instead.
 */
export const prisma = db;

/**
 * Raw, un-extended Prisma client — no soft-delete filtering.
 *
 * Use ONLY when you need to see or hard-delete soft-deleted rows.
 * Documented callers: data-retention cron (final purge after grace
 * window), admin-adjacent restore flows that explicitly target
 * `deletedAt: { not: null }` rows, backup export (must include deleted
 * rows for completeness).
 */
export const rawPrisma = dbUnsafe;

export { db };
