/**
 * Admin permission matrix — single source of truth.
 *
 * Three callers consume this module:
 *   1. `packages/db/prisma/seed-admin.ts` — seeds the SUPER_ADMIN row
 *      with a full permission set on first deploy.
 *   2. `apps/admin/src/app/api/team/route.ts` (POST) — seeds a role's
 *      default matrix when a SUPER_ADMIN creates a new team member.
 *   3. Ops tools / future backfill scripts — any one-off that needs to
 *      derive "what should role X be allowed to do by default?"
 *
 * Before this helper existed the matrix was duplicated inline in each
 * caller and the gaps (any admin without persisted rows) were masked
 * by a legacy fallback in `checkPermission`. The fallback has been
 * removed — absence of a permission row now means "denied" — so every
 * admin account MUST have the right set of `AdminPermission` rows.
 * The helper keeps those rows consistent across create paths.
 */

/**
 * Every resource the admin panel gates behind a permission check.
 * Routes call `requirePermission("users", "canUpdate", ...)` with the
 * literal string — if you add a new resource here, audit the route
 * handlers for the corresponding write gates.
 */
export const ADMIN_RESOURCES = [
  "users",
  "subscriptions",
  "reviews",
  "providers",
  "state_rules",
  "badges",
  "documents",
  "moving_plans",
  "tickets",
  "audit_logs",
  "admin_users",
  "settings",
  // Blog (M14). Reads cover the admin list/edit UI; writes cover
  // create/update; delete soft-deletes a post. Publish is an UPDATE on
  // the lifecycle column (no separate flag) — tightly coupled to write
  // because anyone who can edit the post should be able to ship it.
  "blog",
  // Acquisition campaigns rewrite public pricing copy and bind Stripe
  // price IDs to live checkout, so they need a tighter gate than the
  // generic `subscriptions` permission (which is read by support /
  // billing roles for refunds). Splitting the resource lets us let an
  // ADMIN handle refunds without also letting them edit the homepage
  // headline.
  "acquisition_campaigns",
] as const;

export type AdminResource = (typeof ADMIN_RESOURCES)[number];

/**
 * Closed enum of admin role values. Used by team-management and user-
 * detail endpoints to reject arbitrary role strings before they hit the
 * permission matrix or hierarchy lookup. Order is irrelevant — the
 * privilege ordering lives in `ADMIN_ROLE_HIERARCHY`.
 */
export const ADMIN_ROLE_VALUES = [
  "VIEWER",
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
] as const;
export type AdminRoleValue = (typeof ADMIN_ROLE_VALUES)[number];

export function isValidAdminRole(value: unknown): value is AdminRoleValue {
  return typeof value === "string" && (ADMIN_ROLE_VALUES as readonly string[]).includes(value);
}

export interface PermissionFlags {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface ResourcePermission extends PermissionFlags {
  resource: AdminResource;
}

const ALL_GRANTED: PermissionFlags = {
  canRead: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
};

const READ_ONLY: PermissionFlags = {
  canRead: true,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
};

/**
 * Derive a single `{canRead, canCreate, canUpdate, canDelete}` row for
 * (role, resource). `checkPermission` in auth.ts is authoritative at
 * runtime — this helper only produces the INITIAL matrix persisted to
 * the database. Once rows exist, they can be edited by a SUPER_ADMIN
 * via the team UI without re-deriving from role.
 *
 * Rules (see docs/brand-voice.md → Admin):
 *   - SUPER_ADMIN: full access everywhere. This is mirrored by the
 *     runtime short-circuit in `checkPermission` so demoting a
 *     SUPER_ADMIN still revokes access even if rows remain.
 *   - ADMIN: full CRUD on everything EXCEPT managing other admins.
 *     (Only SUPER_ADMIN can create/delete admin_users.)
 *   - MODERATOR: read everywhere; write only on content moderation
 *     surfaces (reviews).
 *   - VIEWER: read-only across the board. No writes, no deletes.
 *   - Unknown role: read-only as a safe default.
 */
export function getDefaultPermissionsForRole(
  role: string,
  resource: AdminResource,
): PermissionFlags {
  if (role === "SUPER_ADMIN") return { ...ALL_GRANTED };

  if (role === "ADMIN") {
    // Admins cannot manage the admin team roster — SUPER_ADMIN only.
    if (resource === "admin_users") return { ...READ_ONLY };
    return { ...ALL_GRANTED };
  }

  if (role === "MODERATOR") {
    // Moderators write only where moderation lives.
    if (resource === "reviews") {
      return { canRead: true, canCreate: true, canUpdate: true, canDelete: false };
    }
    if (resource === "blog") {
      // Editorial moderators draft + edit + publish, but not delete.
      // Hard-delete stays with ADMIN/SUPER_ADMIN to avoid an editor
      // accidentally wiping a post that's already been linked to.
      return { canRead: true, canCreate: true, canUpdate: true, canDelete: false };
    }
    if (resource === "acquisition_campaigns") {
      // Read-only for moderators — the campaign editor binds Stripe
      // prices and rewrites public pricing surfaces. Only ADMIN /
      // SUPER_ADMIN should be activating offers.
      return { ...READ_ONLY };
    }
    return { ...READ_ONLY };
  }

  // VIEWER + unknown → read-only everywhere.
  return { ...READ_ONLY };
}

/** Materialize the full matrix for a role — ready to pass to Prisma. */
export function buildDefaultPermissionMatrix(role: string): ResourcePermission[] {
  return ADMIN_RESOURCES.map((resource) => ({
    resource,
    ...getDefaultPermissionsForRole(role, resource),
  }));
}
