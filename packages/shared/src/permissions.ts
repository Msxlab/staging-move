/**
 * Workspace permission matrix — single source of truth (doc 03).
 *
 * `can(role, action, ctx)` is a pure, deterministic function so the same policy
 * drives API gates, UI affordances, and tests. It answers ROLE-based policy
 * only; field-level data redaction (e.g. masking another member's account
 * number) and seat/entitlement gating live in their own layers and are passed
 * in via `ctx` where they affect the decision.
 *
 * The connector actions (connector.connect / connector.revokeOwn) reflect the
 * "each member connects their own partners" rule — consents are personal, so a
 * member acts only on their own.
 */

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "CHILD" | "VIEW_ONLY";
export type WorkspaceMemberStatus = "ACTIVE" | "SUSPENDED" | "OVERFLOW";

export type WorkspaceAction =
  | "workspace.view"
  | "workspace.rename"
  | "workspace.delete"
  | "member.invite"
  | "member.remove"
  | "member.changeRole"
  | "member.promoteAdmin"
  | "member.transferOwner"
  | "member.leave"
  | "address.view"
  | "address.create"
  | "address.edit"
  | "address.delete"
  | "service.viewBasic"
  | "service.viewSensitive"
  | "service.create"
  | "service.edit"
  | "addressChange.initiate"
  | "syncAttempt.complete"
  | "export.tax"
  | "billing.manage"
  | "budget.view"
  | "connector.connect"
  | "connector.revokeOwn";

export interface PermissionContext {
  /** Acting member's status. SUSPENDED members may only read. */
  status?: WorkspaceMemberStatus;
  /** The resource belongs to / is assigned to the acting member. */
  isSelf?: boolean;
  /** Role of the member being acted upon (member.* actions). */
  targetRole?: WorkspaceRole;
  /** Visibility setting of the sensitive service field being viewed. */
  fieldVisibility?: "OWNER_ONLY" | "WORKSPACE";
}

/** Actions that only read data — the floor a SUSPENDED member keeps. */
const READ_ACTIONS: ReadonlySet<WorkspaceAction> = new Set<WorkspaceAction>([
  "workspace.view",
  "address.view",
  "service.viewBasic",
  "service.viewSensitive",
  "budget.view",
  "export.tax",
]);

function isManagerRole(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Whether `role` may perform `action` in the given context. Pure. */
export function can(role: WorkspaceRole, action: WorkspaceAction, ctx: PermissionContext = {}): boolean {
  // Suspended members keep read-only access; everything else is denied.
  if (ctx.status === "SUSPENDED" && !READ_ACTIONS.has(action)) return false;

  switch (action) {
    // ── Owner-only ──────────────────────────────────────────
    case "workspace.rename":
    case "workspace.delete":
    case "billing.manage":
    case "member.promoteAdmin":
    case "member.transferOwner":
      return role === "OWNER";

    // ── Owner / Admin management ────────────────────────────
    case "member.invite":
      return isManagerRole(role);

    case "member.remove":
    case "member.changeRole":
      if (role === "OWNER") return ctx.targetRole !== "OWNER"; // owner is never removed/role-changed by others
      if (role === "ADMIN")
        return ctx.targetRole === "MEMBER" || ctx.targetRole === "CHILD" || ctx.targetRole === "VIEW_ONLY";
      return false;

    case "member.leave":
      if (role === "OWNER") return false; // must transfer ownership first
      if (role === "CHILD") return false; // requires parent/admin
      return role === "ADMIN" || role === "MEMBER" || role === "VIEW_ONLY";

    // ── Views ───────────────────────────────────────────────
    case "workspace.view":
      return true; // CHILD sees a limited view; redaction is enforced at the query layer

    case "address.view":
    case "service.viewBasic":
      if (role === "CHILD") return ctx.isSelf === true; // self / self-assigned only
      return true;

    case "service.viewSensitive": // accountNumber / username
      if (isManagerRole(role)) return true;
      if (role === "MEMBER") return ctx.fieldVisibility === "WORKSPACE";
      return false; // CHILD, VIEW_ONLY

    case "budget.view":
      return role !== "CHILD";

    case "export.tax":
      return role !== "CHILD"; // MEMBER limited to own data — enforced by caller

    // ── Mutations ───────────────────────────────────────────
    case "address.create":
    case "service.create":
      if (role === "VIEW_ONLY") return false;
      if (role === "CHILD") return ctx.isSelf === true;
      return true;

    case "address.edit":
    case "address.delete":
    case "service.edit":
      if (role === "VIEW_ONLY") return false;
      if (isManagerRole(role)) return true;
      if (role === "MEMBER") return action === "service.edit" ? true : ctx.isSelf === true;
      if (role === "CHILD") return ctx.isSelf === true;
      return false;

    case "addressChange.initiate":
      return role === "OWNER" || role === "ADMIN" || role === "MEMBER"; // CHILD/VIEW_ONLY cannot start a sync

    case "syncAttempt.complete":
      if (role === "VIEW_ONLY") return false;
      if (role === "CHILD") return ctx.isSelf === true;
      return true;

    // ── Connectors (personal consents) ──────────────────────
    case "connector.connect":
    case "connector.revokeOwn":
      return role === "OWNER" || role === "ADMIN" || role === "MEMBER";

    default:
      return false;
  }
}

/** Convenience: whether a member status permits any mutation at all. */
export function statusAllowsMutation(status: WorkspaceMemberStatus | undefined): boolean {
  return status !== "SUSPENDED";
}
