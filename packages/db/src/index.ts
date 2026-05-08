import { PrismaClient } from "@prisma/client";
import { withSoftDelete } from "./soft-delete";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Raw, un-extended Prisma client.
 *
 * Use this ONLY for intentional admin/maintenance flows that need to see
 * or hard-delete soft-deleted rows:
 *   - admin restore/undelete endpoints
 *   - GDPR retention purge jobs (final hard-delete after grace window)
 *   - backup export (must include soft-deleted rows for completeness)
 *
 * Application code that touches user-facing data must NOT use `dbUnsafe` —
 * import `db` (below) instead. `db` ships with the soft-delete extension
 * applied so a forgotten filter does not leak deleted rows.
 */
export const dbUnsafe =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = dbUnsafe;

// Graceful shutdown: disconnect Prisma on process exit. The extended `db`
// client shares the underlying connection with `dbUnsafe`, so we only
// disconnect once.
if (typeof process !== "undefined") {
  const shutdown = async () => {
    await dbUnsafe.$disconnect();
  };
  process.on("beforeExit", shutdown);
  process.on("SIGINT", async () => { await shutdown(); process.exit(0); });
  process.on("SIGTERM", async () => { await shutdown(); process.exit(0); });
}

/**
 * Default app DB client. Soft-delete extension applied: read queries
 * exclude `deletedAt != null` rows for known soft-delete models, and
 * `delete`/`deleteMany` are rewritten to set `deletedAt = now`.
 *
 * If a caller needs to see/restore deleted rows, import `dbUnsafe` from
 * the same module and document why.
 *
 * Type cast: Prisma's `$extends` returns a structurally-different
 * (Omit<PrismaClient, '$extends'>) type. Callers throughout the codebase
 * use `db.<model>.<method>()` shapes that exist identically on the
 * extended client, so we narrow back to PrismaClient via `unknown` to
 * avoid forcing every caller to import a new client type.
 */
export const db = dbUnsafe.$extends(withSoftDelete) as unknown as PrismaClient;

export * from "@prisma/client";
export {
  withSoftDelete,
  SOFT_DELETE_MODELS,
  restoreSoftDeleted,
} from "./soft-delete";
export {
  OptimisticLockError,
  updateWithVersion,
  isOptimisticLockError,
} from "./optimistic-locking";
export { rebuildProviderCoverage, type RebuildCoverageInput } from "./provider-coverage";
export {
  getProviderCoverageMetadata,
  getProviderCoverageMetadataMap,
  type ProviderCoverageMetadata,
  type ProviderCoverageModel,
  type ProviderCoveragePoint,
  type ProviderCoveragePolygon,
} from "./provider-coverage-metadata";
export default db;
