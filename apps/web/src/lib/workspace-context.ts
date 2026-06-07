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
  | "MEMBER_SUSPENDED";

export class WorkspaceContextError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404 | 410,
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
export function resolveWorkspaceIdFromRequest(request: Request): string | null {
  const header = request.headers.get("x-workspace-id");
  if (header && ID_RE.test(header)) return header;
  const cookie = readCookie(request, "lf_workspace_id");
  if (cookie && ID_RE.test(cookie)) return cookie;
  return null;
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

  const requestedId = resolveWorkspaceIdFromRequest(request);

  // Find the member row for the explicitly requested workspace, if any.
  let member = requestedId
    ? await prisma.workspaceMember.findFirst({ where: { workspaceId: requestedId, userId } })
    : null;

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
