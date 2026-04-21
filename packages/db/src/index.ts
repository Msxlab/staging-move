import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Graceful shutdown: disconnect Prisma on process exit
if (typeof process !== "undefined") {
  const shutdown = async () => {
    await db.$disconnect();
  };
  process.on("beforeExit", shutdown);
  process.on("SIGINT", async () => { await shutdown(); process.exit(0); });
  process.on("SIGTERM", async () => { await shutdown(); process.exit(0); });
}

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
