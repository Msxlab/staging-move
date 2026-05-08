import { db, dbUnsafe } from "../../../../packages/db/src/index";

/**
 * Default admin Prisma client — soft-delete-extended.
 *
 * Read queries on soft-delete models exclude rows with
 * `deletedAt != null`. Most admin pages should use this so they don't
 * accidentally show deleted users / providers / addresses in normal
 * lists.
 *
 * If a route intentionally needs to see soft-deleted rows (the user
 * list with `deletedScope=all|deleted`, the user-restore flow, the
 * data-retention cron, the backup export), import `prismaUnsafe` (a.k.a.
 * `rawPrisma` / `dbUnsafe`) and document the reason.
 */
export { db };
export const prisma = db;

/**
 * Raw, un-extended client. Use intentionally — see comment on `prisma`
 * above. Aliased as both `prismaUnsafe` and `rawPrisma` so callers can
 * pick the name that documents intent best at the call site.
 */
export const prismaUnsafe = dbUnsafe;
export const rawPrisma = dbUnsafe;
