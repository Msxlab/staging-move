/**
 * Server-side page-guard for the admin panel.
 *
 * Every privileged admin page renders sensitive UI (runtime config, security
 * dashboard, backups, team management, etc.). The admin panel is publicly
 * reachable on the internet, so privileged pages MUST fail closed before
 * rendering — relying on the API to return 403 after the bundle ships is
 * too late: any leaked HTML/data already left the server, and a determined
 * attacker can fingerprint the layout.
 *
 * Each helper here resolves the current admin server-side, asserts the
 * required role/permission, and either:
 *   - returns a `PageGuardContext` with the admin's id, role, and a small
 *     permission map the client component can use to hide unavailable
 *     controls (display only — server APIs remain authoritative), OR
 *   - redirects to /login (no session) or /forbidden (insufficient role).
 *
 * Client components must NEVER treat the returned `permissions` map as a
 * security boundary; it exists purely so the UI can hide buttons that
 * would 403 anyway, reducing user confusion. The corresponding API route
 * still re-validates permissions on every write.
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, type AdminSession } from "@/lib/auth";
import {
  ADMIN_RESOURCES,
  type AdminResource,
} from "@/lib/admin-permissions";

export type AdminRoleString = "VIEWER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

export const ADMIN_ROLE_HIERARCHY: Record<AdminRoleString, number> = {
  VIEWER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export interface ResourcePermissionFlags {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export type AdminPermissionsMap = Record<AdminResource, ResourcePermissionFlags>;

export interface PageGuardContext {
  /** Active admin's id from the validated session. */
  adminId: string;
  /** Active admin's email (display only). */
  email: string;
  /** Fresh role read from DB, not the JWT. */
  role: AdminRoleString;
  /**
   * Permission map for every known resource. Client components may use
   * this to gate display of action buttons. The server APIs remain the
   * authoritative gate — flipping these in DevTools changes nothing.
   */
  permissions: AdminPermissionsMap;
}

const READ_ONLY: ResourcePermissionFlags = {
  canRead: true,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
};

const ALL_DENIED: ResourcePermissionFlags = {
  canRead: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
};

const ALL_GRANTED: ResourcePermissionFlags = {
  canRead: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
};

/**
 * Build the admin's permission map. SUPER_ADMIN gets full grants
 * (mirrors the runtime short-circuit in `checkPermission`). Everyone else
 * gets exactly what's persisted in `AdminPermission` rows; missing rows
 * mean "denied" — no legacy fallback.
 */
function buildPermissionsMap(
  role: AdminRoleString,
  rows: Array<{ resource: string } & ResourcePermissionFlags>,
): AdminPermissionsMap {
  const map = Object.fromEntries(
    ADMIN_RESOURCES.map((resource) => [resource, { ...ALL_DENIED }]),
  ) as AdminPermissionsMap;

  if (role === "SUPER_ADMIN") {
    for (const resource of ADMIN_RESOURCES) {
      map[resource] = { ...ALL_GRANTED };
    }
    return map;
  }

  for (const row of rows) {
    if ((ADMIN_RESOURCES as readonly string[]).includes(row.resource)) {
      map[row.resource as AdminResource] = {
        canRead: Boolean(row.canRead),
        canCreate: Boolean(row.canCreate),
        canUpdate: Boolean(row.canUpdate),
        canDelete: Boolean(row.canDelete),
      };
    }
  }
  return map;
}

function normalizeRole(value: string): AdminRoleString {
  if (value === "SUPER_ADMIN" || value === "ADMIN" || value === "MODERATOR" || value === "VIEWER") {
    return value;
  }
  return "VIEWER";
}

async function loadActiveAdmin(session: AdminSession): Promise<{
  role: AdminRoleString;
  permissions: AdminPermissionsMap;
  mustChangePassword: boolean;
} | null> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: {
      id: true,
      isActive: true,
      role: true,
      mustChangePassword: true,
      permissions: {
        select: {
          resource: true,
          canRead: true,
          canCreate: true,
          canUpdate: true,
          canDelete: true,
        },
      },
    },
  });
  if (!admin || !admin.isActive) return null;
  const role = normalizeRole(admin.role);
  return {
    role,
    permissions: buildPermissionsMap(role, admin.permissions),
    // Null (legacy rows / unset) is treated as "no rotation required".
    mustChangePassword: admin.mustChangePassword === true,
  };
}

function meetsRole(actual: AdminRoleString, required: AdminRoleString): boolean {
  return ADMIN_ROLE_HIERARCHY[actual] >= ADMIN_ROLE_HIERARCHY[required];
}

function hasPermission(
  permissions: AdminPermissionsMap,
  resource: AdminResource,
  action: keyof ResourcePermissionFlags,
): boolean {
  return Boolean(permissions[resource]?.[action]);
}

/**
 * Server-side page entry. Throws via redirect on missing session or
 * insufficient role — control flow never returns to the page when the
 * gate fails.
 */
export async function requirePageRole(
  minimumRole: AdminRoleString,
): Promise<PageGuardContext> {
  let session: AdminSession;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/login");
  }

  const admin = await loadActiveAdmin(session);
  if (!admin) {
    redirect("/login");
  }

  // Fail-closed forced rotation: an invited / flagged admin cannot reach any
  // privileged page until they own their password. Authoritative DB check —
  // independent of the (possibly stale) JWT `mcp` claim the middleware uses.
  if (admin.mustChangePassword) {
    redirect("/set-password/change");
  }

  if (!meetsRole(admin.role, minimumRole)) {
    redirect("/forbidden");
  }

  return {
    adminId: session.adminId,
    email: session.email,
    role: admin.role,
    permissions: admin.permissions,
  };
}

/**
 * Server-side page entry that requires a specific (resource, action) grant.
 * Optionally accepts a `minimumRole` floor (defaults to VIEWER).
 */
export async function requirePagePermission(
  resource: AdminResource,
  action: keyof ResourcePermissionFlags,
  options: { minimumRole?: AdminRoleString } = {},
): Promise<PageGuardContext> {
  let session: AdminSession;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/login");
  }

  const admin = await loadActiveAdmin(session);
  if (!admin) {
    redirect("/login");
  }

  if (admin.mustChangePassword) {
    redirect("/set-password/change");
  }

  const minimumRole = options.minimumRole || "VIEWER";
  if (!meetsRole(admin.role, minimumRole)) {
    redirect("/forbidden");
  }

  if (!hasPermission(admin.permissions, resource, action)) {
    redirect("/forbidden");
  }

  return {
    adminId: session.adminId,
    email: session.email,
    role: admin.role,
    permissions: admin.permissions,
  };
}

/**
 * Get the validated context without enforcing a specific role. Use this
 * when the page is reachable by any active admin (e.g. dashboard, list
 * pages whose API layer enforces VIEWER) but you still want a fresh
 * server-side role for navigation/UI gating.
 */
export async function requirePageAdmin(): Promise<PageGuardContext> {
  let session: AdminSession;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/login");
  }

  const admin = await loadActiveAdmin(session);
  if (!admin) {
    redirect("/login");
  }

  if (admin.mustChangePassword) {
    redirect("/set-password/change");
  }

  return {
    adminId: session.adminId,
    email: session.email,
    role: admin.role,
    permissions: admin.permissions,
  };
}
