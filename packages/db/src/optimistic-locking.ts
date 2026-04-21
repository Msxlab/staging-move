/**
 * Optimistic locking helpers for models with a `version Int` column.
 *
 * Pattern:
 *   const current = await prisma.serviceProvider.findUnique({ where: { id } });
 *   // ...user modifies fields...
 *   await updateWithVersion(prisma.serviceProvider, { id, version: current.version }, {
 *     name: newName,
 *     // ...other patched fields...
 *   });
 *
 * Throws `OptimisticLockError` if the row was updated by someone else between
 * the read and the write. Callers should surface this as a 409 Conflict.
 */

export class OptimisticLockError extends Error {
  readonly code = "OPTIMISTIC_LOCK_CONFLICT";
  constructor(message = "Record was modified by another user. Refresh and try again.") {
    super(message);
    this.name = "OptimisticLockError";
  }
}

interface VersionedModel {
  updateMany: (args: {
    where: { id: string; version: number } & Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
}

/**
 * Atomic compare-and-swap update. Increments `version` on success and raises
 * OptimisticLockError if zero rows matched (meaning someone else already
 * incremented the version).
 */
export async function updateWithVersion<TData extends Record<string, unknown>>(
  model: VersionedModel,
  key: { id: string; version: number },
  data: TData,
): Promise<void> {
  const result = await model.updateMany({
    where: { id: key.id, version: key.version },
    data: { ...data, version: key.version + 1 },
  });
  if (result.count === 0) {
    throw new OptimisticLockError();
  }
}

/**
 * Wrap any route handler's catch block to turn lock errors into 409 Conflict
 * JSON responses without boilerplate.
 */
export function isOptimisticLockError(err: unknown): err is OptimisticLockError {
  return (
    err instanceof OptimisticLockError ||
    (typeof err === "object" && err !== null && (err as any).code === "OPTIMISTIC_LOCK_CONFLICT")
  );
}
