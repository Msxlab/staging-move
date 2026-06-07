import { can } from "@locateflow/shared";
import type { WorkspaceDataScope } from "@/lib/workspace-data-scope";

/**
 * Field-level redaction for the `service.viewSensitive` permission (AUTH-015).
 *
 * The role matrix in `@locateflow/shared` already decides WHO may see a
 * service's sensitive fields (`can(role, "service.viewSensitive", ...)`), but
 * nothing enforced it on the read paths — every workspace member received the
 * decrypted account number / login info regardless of role. This helper closes
 * that gap purely in code: given a (decrypted) service record and the resolved
 * data scope, it returns the record with the sensitive fields nulled when the
 * caller's role lacks `service.viewSensitive`.
 *
 * Sensitive = the credential / login / contact fields stored encrypted at rest
 * (account number, username, phone, email, free-form notes). The "basic" fields
 * (provider, category, cost, billing, address) are always returned intact.
 *
 * Visibility rules:
 *  - Legacy / non-workspace mode (no member role): never redacted — the user is
 *    looking at their own data.
 *  - The record's own user (`actorUserId === record.userId`) and the workspace
 *    OWNER always keep full visibility.
 *  - Everyone else is gated through `can()` against `scope.memberRole`. Under
 *    the current matrix that means OWNER/ADMIN keep full view; CHILD, VIEW_ONLY
 *    (and MEMBER, since no per-field WORKSPACE visibility flag exists) get the
 *    sensitive fields redacted to `null`.
 */

/** The sensitive Service fields gated behind `service.viewSensitive`. */
export const SENSITIVE_SERVICE_FIELDS = [
  "accountNumber",
  "username",
  "phone",
  "email",
  "notes",
] as const;

type SensitiveServiceField = (typeof SENSITIVE_SERVICE_FIELDS)[number];

type ServiceRecord = {
  userId?: string | null;
} & Partial<Record<SensitiveServiceField, unknown>>;

/**
 * Whether the caller described by `scope` may see the sensitive fields of the
 * given service record. Pure; mirrors the policy applied by `redactService`.
 */
export function canViewSensitiveService(
  record: { userId?: string | null },
  scope: WorkspaceDataScope,
): boolean {
  // Legacy / own-data mode: nothing to redact.
  if (!scope.workspaceMode || !scope.memberRole) return true;

  // The record's own user always keeps full visibility (covers the actor's own
  // services in a shared workspace, regardless of their role).
  if (record.userId && record.userId === scope.actorUserId) return true;

  // The workspace owner sees everything in their workspace.
  if (scope.actorUserId === scope.ownerUserId) return true;

  return can(scope.memberRole, "service.viewSensitive", {
    status: scope.memberStatus || undefined,
    isSelf: record.userId === scope.actorUserId,
  });
}

/**
 * Returns a copy of the service with sensitive fields nulled out when the
 * caller's role lacks `service.viewSensitive`. Basic fields are untouched. If
 * the caller is permitted (or in legacy mode), the record is returned as-is.
 */
export function redactService<T extends ServiceRecord>(record: T, scope: WorkspaceDataScope): T {
  if (canViewSensitiveService(record, scope)) return record;

  const next: Record<string, unknown> = { ...record };
  for (const field of SENSITIVE_SERVICE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(next, field)) {
      next[field] = null;
    }
  }
  return next as T;
}

/** Convenience: redact every service in a list against the same scope. */
export function redactServices<T extends ServiceRecord>(records: T[], scope: WorkspaceDataScope): T[] {
  return records.map((record) => redactService(record, scope));
}
