/**
 * Prisma extension that auto-filters `deletedAt: null` on read queries for
 * known soft-delete models, and rewrites `delete` / `deleteMany` into
 * `update` / `updateMany` that sets `deletedAt`.
 *
 * **Not applied globally by default.** The singleton `db` in src/index.ts
 * stays raw so admin flows, cron retention, and restore endpoints can see
 * and hard-delete soft-deleted rows. Import `withSoftDelete` and compose
 * where the filter is desired:
 *
 *   const prisma = db.$extends(withSoftDelete);
 *
 * Or scope per-request by extending a request-local client.
 */

import { Prisma } from "@prisma/client";

export const SOFT_DELETE_MODELS = new Set<string>([
  "User",
  "Address",
  "Service",
  "MovingPlan",
  "Task",
  "Budget",
  "ServiceProvider",
  "ProviderReview",
]);

function isSoftDeleteModel(model: string | undefined): boolean {
  return !!model && SOFT_DELETE_MODELS.has(model);
}

function applyDeletedAtFilter(args: any) {
  // If the caller explicitly passed deletedAt (e.g. `deletedAt: { not: null }`
  // to see archived records), respect their intent. Otherwise, default to
  // "only live rows".
  const where = args?.where ?? {};
  if ("deletedAt" in where) return args;
  return { ...args, where: { ...where, deletedAt: null } };
}

export const withSoftDelete = Prisma.defineExtension({
  name: "softDelete",
  query: {
    $allModels: {
      async findMany({ args, query, model }) {
        if (!isSoftDeleteModel(model)) return query(args);
        return query(applyDeletedAtFilter(args));
      },
      async findFirst({ args, query, model }) {
        if (!isSoftDeleteModel(model)) return query(args);
        return query(applyDeletedAtFilter(args));
      },
      async findFirstOrThrow({ args, query, model }) {
        if (!isSoftDeleteModel(model)) return query(args);
        return query(applyDeletedAtFilter(args));
      },
      async findUnique({ args, query, model }) {
        // findUnique can't take a compound filter; we do a post-check instead.
        if (!isSoftDeleteModel(model)) return query(args);
        const row = (await query(args)) as any;
        if (row && row.deletedAt !== null) return null;
        return row;
      },
      async count({ args, query, model }) {
        if (!isSoftDeleteModel(model)) return query(args);
        return query(applyDeletedAtFilter(args));
      },
      async delete({ args, model, operation, query }) {
        if (!isSoftDeleteModel(model)) return query(args);
        // Rewrite to an update that marks the row soft-deleted. The caller
        // wanted "delete"; we return the post-update row, which matches the
        // shape `delete` would have returned.
        return (this as any)[model!].update({
          where: (args as any).where,
          data: { deletedAt: new Date() },
        });
        // Unused bindings satisfy TS's exhaustiveness check.
        void operation;
      },
      async deleteMany({ args, model, query }) {
        if (!isSoftDeleteModel(model)) return query(args);
        return (this as any)[model!].updateMany({
          where: (args as any).where,
          data: { deletedAt: new Date() },
        });
      },
    },
  },
});

/**
 * Helper for admin "restore" flows: the only supported way to resurrect a
 * soft-deleted row. Uses the raw client to bypass the auto-filter.
 */
export async function restoreSoftDeleted(
  rawClient: any,
  model: keyof typeof Prisma.ModelName,
  id: string,
): Promise<void> {
  if (!SOFT_DELETE_MODELS.has(model as string)) {
    throw new Error(`restoreSoftDeleted: ${model} is not a soft-delete model`);
  }
  await rawClient[model as string].update({
    where: { id },
    data: { deletedAt: null },
  });
}
