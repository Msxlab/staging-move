/**
 * Workspace context resolver (doc 07).
 *
 * The single helper every workspace-scoped API route calls first: it verifies
 * the session, resolves which workspace the request targets, checks membership,
 * and loads the owner-resolved entitlement. Route-level (not middleware) because
 * Prisma can't run on the edge.
 *
 * Gated by WORKSPACE_MODEL_ENABLED — until the dual-read window opens, routes
 * keep their legacy userId path and never call this. Building it now (tested,
 * unused) is the Sprint-1 deliverable; route retrofit comes later.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getEffectiveEntitlement,
  can,
  type EffectiveEntitlement,
  type WorkspaceRole,
  type WorkspaceMemberStatus,
} from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

/** Canonical lf_workspace_id cookie name + write options (match accept/create routes). */
const WORKSPACE_COOKIE_NAME = "lf_workspace_id";
const WORKSPACE_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

/**
 * Overwrite the lf_workspace_id cookie with the resolved workspace id so a stale
 * value stops forcing the oldest-workspace fallback on every request.
 *
 * Best-effort: cookies() can only be mutated from a Route Handler / Server
 * Action. In a Server Component render (pages also resolve context) the write
 * throws read-only — we swallow it. The next API call the client makes runs in a
 * route handler and self-heals the cookie there. MUST never throw: regressing
 * this back into the resolver would re-introduce the lockout it guards against.
 */
async function overwriteStaleWorkspaceCookie(workspaceId: string): Promise<void> {
  try {
    const store = await cookies();
    store.set(WORKSPACE_COOKIE_NAME, workspaceId, WORKSPACE_COOKIE_OPTIONS);
  } catch {
    /* outside a writable response scope (e.g. server-component render) — ignore */
  }
}

export interface WorkspaceContext {
  userId: string;
  workspaceId: string;
  ownerUserId: string;
  workspaceName: string;
  memberRole: WorkspaceRole;
  memberStatus: WorkspaceMemberStatus;
  entitlement: EffectiveEntitlement;
  isOwner: boolean;
  // Convenience flags materialized from the permission matrix.
  canManageMembers: boolean;
  canInitiateSync: boolean;
  /**
   * True when the request asked for a workspace (via X-Workspace-Id header or
   * lf_workspace_id cookie) that the user is NOT a member of, and we silently
   * fell back to their oldest workspace instead. Routes should overwrite the
   * lf_workspace_id cookie with `workspaceId` (or clear it) so the stale value
   * — e.g. left behind after the user was removed, or carried over from another
   * device — stops mis-routing future requests. Absent/false on the normal path.
   */
  staleWorkspaceCookie?: boolean;
}

export type WorkspaceContextCode =
  | "UNAUTHENTICATED"
  | "NO_WORKSPACE_ACCESS"
  | "WORKSPACE_NOT_FOUND"
  | "MEMBER_SUSPENDED"
  | "STALE_WORKSPACE_SELECTION";

export class WorkspaceContextError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404 | 409 | 410,
    public readonly code: WorkspaceContextCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceContextError";
  }
}

/** Master flag. Default OFF — the whole workspace model stays inert. */
export async function isWorkspaceModelEnabled(): Promise<boolean> {
  const value = (await getRuntimeConfigValue("WORKSPACE_MODEL_ENABLED")) ?? process.env.WORKSPACE_MODEL_ENABLED ?? "";
  return value === "true" || value === "1";
}

const ID_RE = /^[A-Za-z0-9_-]{1,30}$/;
type WorkspaceSelectionSource = "header" | "cookie" | "none";

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/**
 * Pure precedence resolution: X-Workspace-Id header → lf_workspace_id cookie.
 * Returns null when neither is present (caller falls back to the DB default).
 * The `?workspace=` query override is admin-only and handled separately.
 */
export function resolveWorkspaceSelectionFromRequest(
  request: Request,
): { workspaceId: string | null; source: WorkspaceSelectionSource } {
  const header = request.headers.get("x-workspace-id");
  if (header && ID_RE.test(header)) return { workspaceId: header, source: "header" };
  const cookie = readCookie(request, "lf_workspace_id");
  if (cookie && ID_RE.test(cookie)) return { workspaceId: cookie, source: "cookie" };
  return { workspaceId: null, source: "none" };
}

export function resolveWorkspaceIdFromRequest(request: Request): string | null {
  return resolveWorkspaceSelectionFromRequest(request).workspaceId;
}

/** Materialize the convenience flags for a resolved member. */
export function materializeContextFlags(
  role: WorkspaceRole,
  status: WorkspaceMemberStatus,
): Pick<WorkspaceContext, "isOwner" | "canManageMembers" | "canInitiateSync"> {
  return {
    isOwner: role === "OWNER",
    canManageMembers: can(role, "member.invite", { status }),
    canInitiateSync: can(role, "addressChange.initiate", { status }),
  };
}

/**
 * Resolve + authorize the workspace for this request. Throws
 * WorkspaceContextError (rendered via workspaceContextErrorResponse).
 */
export async function requireWorkspaceContext(request: Request): Promise<WorkspaceContext> {
  const session = await getUserSession();
  if (!session) {
    throw new WorkspaceContextError(401, "UNAUTHENTICATED", "Sign in required.");
  }
  const userId = session.userId;

  const requestedWorkspace = resolveWorkspaceSelectionFromRequest(request);
  const requestedId = requestedWorkspace.workspaceId;

  // Find the member row for the explicitly requested workspace, if any.
  let member = requestedId
    ? await prisma.workspaceMember.findFirst({ where: { workspaceId: requestedId, userId } })
    : null;

  if (!member && requestedId && requestedWorkspace.source === "header") {
    throw new WorkspaceContextError(
      409,
      "STALE_WORKSPACE_SELECTION",
      "Your selected workspace is no longer available. Choose another workspace.",
    );
  }

  // A requested workspace the user isn't a member of must NOT lock them out of
  // the whole app: the header/cookie can be stale (user removed from that
  // workspace, or a 1-year cookie carried over from another browser/device).
  // Fall back to the user's oldest workspace — the same default used when no
  // workspace was requested at all — and flag the stale cookie so the caller
  // can overwrite/clear it. Only a user with NO membership anywhere is denied.
  let staleWorkspaceCookie = false;
  if (!member) {
    member = await prisma.workspaceMember.findFirst({ where: { userId }, orderBy: { joinedAt: "asc" } });
    if (member && requestedId) staleWorkspaceCookie = true;
  }

  if (!member) {
    throw new WorkspaceContextError(403, "NO_WORKSPACE_ACCESS", "You don't have access to this workspace.");
  }
  // Allow-list, not a SUSPENDED-only denylist: any status that isn't an active
  // membership (or a read-only OVERFLOW after a downgrade) fails closed. The
  // status column is free-form VarChar, so an unknown/future value must NOT
  // silently grant full context. can() further clamps OVERFLOW to read-only.
  if (member.status !== "ACTIVE" && member.status !== "OVERFLOW") {
    throw new WorkspaceContextError(403, "MEMBER_SUSPENDED", "Your access to this workspace is not active.");
  }

  // Extended client filters soft-deleted workspaces → null means gone/missing.
  const workspace = await prisma.workspace.findUnique({ where: { id: member.workspaceId } });
  if (!workspace) {
    throw new WorkspaceContextError(404, "WORKSPACE_NOT_FOUND", "Workspace not found.");
  }

  const ownerSub = await prisma.subscription.findUnique({ where: { userId: workspace.ownerUserId } });
  const entitlement = getEffectiveEntitlement(ownerSub);

  const role = member.role as WorkspaceRole;
  const status = member.status as WorkspaceMemberStatus;

  // Self-heal a stale header/cookie: rewrite lf_workspace_id to the workspace we
  // actually resolved so the bad value stops mis-routing every future request.
  // Best-effort and non-throwing (see helper) — never regress the lockout fix.
  if (staleWorkspaceCookie) {
    await overwriteStaleWorkspaceCookie(workspace.id);
  }

  return {
    userId,
    workspaceId: workspace.id,
    ownerUserId: workspace.ownerUserId,
    workspaceName: workspace.name,
    memberRole: role,
    memberStatus: status,
    entitlement,
    staleWorkspaceCookie,
    ...materializeContextFlags(role, status),
  };
}

/** Render a WorkspaceContextError as a JSON response for a route handler. */
export function workspaceContextErrorResponse(err: WorkspaceContextError): NextResponse {
  return NextResponse.json(
    { error: err.message, code: err.code },
    { status: err.status, headers: { "Cache-Control": "no-store" } },
  );
}
