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
        // findUnique can't take a compound filter so we have to handle
        // both "implicit select" and "caller-supplied select" cases.
        //
        // Implicit (no `select`/`include`): the query returns the full
        // row including `deletedAt`, so a post-check works.
        //
        // Explicit `select` that omits `deletedAt`: the post-check sees
        // the row but cannot tell if it was soft-deleted, so the bug was
        // that deleted rows would leak through. Re-fetch via `findFirst`
        // with the same `where` plus `deletedAt: null` to make the gate
        // atomic for that case.
        if (!isSoftDeleteModel(model)) return query(args);

        const a = args as any;
        const callerSelect = a?.select;
        const callerInclude = a?.include;
        const selectOmitsDeletedAt =
          callerSelect && typeof callerSelect === "object" && !callerSelect.deletedAt;

        if (selectOmitsDeletedAt || callerInclude) {
          // Re-issue as `findFirst` with a compound filter so deletedAt
          // is enforced at the SQL boundary. Caller's select/include is
          // preserved unchanged.
          const fallback = await (this as any)[model!].findFirst({
            where: { ...(a?.where || {}), deletedAt: null },
            ...(callerSelect ? { select: callerSelect } : {}),
            ...(callerInclude ? { include: callerInclude } : {}),
          });
          return fallback;
        }

        const row = (await query(args)) as any;
        if (row && row.deletedAt !== null) return null;
        return row;
      },
      async findUniqueOrThrow({ args, query, model }) {
        // Same pattern as findUnique — and the symmetric throw if the
        // row is soft-deleted, mirroring Prisma's contract for "or throw"
        // variants.
        if (!isSoftDeleteModel(model)) return query(args);
        const a = args as any;
        const callerSelect = a?.select;
        const callerInclude = a?.include;
        const selectOmitsDeletedAt =
          callerSelect && typeof callerSelect === "object" && !callerSelect.deletedAt;
        if (selectOmitsDeletedAt || callerInclude) {
          return (this as any)[model!].findFirstOrThrow({
            where: { ...(a?.where || {}), deletedAt: null },
            ...(callerSelect ? { select: callerSelect } : {}),
            ...(callerInclude ? { include: callerInclude } : {}),
          });
        }
        const row = (await query(args)) as any;
        if (row && row.deletedAt !== null) {
          // Match Prisma's runtime "no result" error shape.
          throw new Error(`No ${model} found`);
        }
        return row;
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
