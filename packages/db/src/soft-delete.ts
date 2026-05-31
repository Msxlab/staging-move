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

// Models with a `deletedAt DateTime?` column in schema.prisma. Keep this list
// in sync with the schema — see soft-delete.test.ts for the regression guard.
export const SOFT_DELETE_MODELS = new Set<string>([
  "User",
  "Address",
  "Service",
  "MovingPlan",
  "Budget",
  "ServiceProvider",
  "MoveTask",
  "UserCustomProvider",
  "BlogPost",
  "Workspace",
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

function selectNeedsDeletedAt(select: unknown): select is Record<string, unknown> {
  return !!select && typeof select === "object" && (select as any).deletedAt !== true;
}

function withDeletedAtSelected(args: any) {
  if (!selectNeedsDeletedAt(args?.select)) return args;
  return {
    ...args,
    select: {
      ...args.select,
      deletedAt: true,
    },
  };
}

function removeSyntheticDeletedAt<T>(row: T, shouldRemove: boolean): T {
  if (!shouldRemove || !row || typeof row !== "object") return row;
  const copy = { ...(row as Record<string, unknown>) };
  delete copy.deletedAt;
  return copy as T;
}

function isSoftDeletedRow(row: unknown): boolean {
  return !!row &&
    typeof row === "object" &&
    "deletedAt" in row &&
    (row as { deletedAt?: Date | string | null }).deletedAt !== null;
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
        if (!isSoftDeleteModel(model)) return query(args);
        const a = args as any;
        const shouldRemoveDeletedAt = selectNeedsDeletedAt(a?.select);
        const row = (await query(withDeletedAtSelected(a))) as any;
        if (isSoftDeletedRow(row)) return null;
        return removeSyntheticDeletedAt(row, shouldRemoveDeletedAt);
      },
      async findUniqueOrThrow({ args, query, model }) {
        // Same pattern as findUnique — and the symmetric throw if the
        // row is soft-deleted, mirroring Prisma's contract for "or throw"
        // variants.
        if (!isSoftDeleteModel(model)) return query(args);
        const a = args as any;
        const shouldRemoveDeletedAt = selectNeedsDeletedAt(a?.select);
        const row = (await query(withDeletedAtSelected(a))) as any;
        if (isSoftDeletedRow(row)) {
          // Match Prisma's runtime "no result" error shape.
          throw new Error(`No ${model} found`);
        }
        return removeSyntheticDeletedAt(row, shouldRemoveDeletedAt);
      },
      async aggregate({ args, query, model }) {
        if (!isSoftDeleteModel(model)) return query(args);
        return query(applyDeletedAtFilter(args));
      },
      async groupBy({ args, query, model }) {
        if (!isSoftDeleteModel(model)) return query(args);
        return query(applyDeletedAtFilter(args));
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
      async updateMany({ args, query, model }) {
        if (!isSoftDeleteModel(model)) return query(args);
        // updateMany takes a non-unique WhereInput, so (like the read ops) we
        // scope it to live rows — a bare `updateMany({ where: { userId } })`
        // must not silently mutate soft-deleted rows. Callers that intend to
        // touch deleted rows pass an explicit `deletedAt` (respected by
        // applyDeletedAtFilter) or use the raw client.
        //
        // NOTE: `update`/`upsert` are intentionally NOT intercepted —
        // `update` takes a unique where (can't carry a deletedAt filter) and
        // the budget resurrect-on-conflict pattern relies on `upsert` seeing
        // the soft-deleted row. The deleteMany rewrite above re-enters here,
        // which is fine: it just won't re-soft-delete an already-deleted row.
        return query(applyDeletedAtFilter(args));
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
