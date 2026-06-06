"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Users, MapPin, Zap, DollarSign, Crown, Clock, Pencil, Trash2, Check, X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";

interface Member {
  id: string;
  userId: string;
  role: string;
  status: string;
  managedSyncEnabled: boolean | null;
  joinedAt: string;
  lastActiveAt: string | null;
  name: string | null;
  email: string | null;
  deleted: boolean;
  entered: { addresses: number; services: number; budgets: number };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface WorkspaceDetail {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string | null;
  plan: string;
  planLabel: string;
  seatLimit: number;
  activeSeats: number;
  owner: { id: string | null; email: string | null; name: string | null; deleted?: boolean };
  members: Member[];
  invitations: Invitation[];
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-tone-foil-bg text-tone-foil-fg",
  ADMIN: "bg-tone-sky-bg text-tone-sky-fg",
  MEMBER: "bg-tone-sage-bg text-tone-sage-fg",
  CHILD: "bg-tone-honey-bg text-tone-honey-fg",
  VIEW_ONLY: "bg-tone-slate-bg text-muted-foreground",
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-tone-sage-bg text-tone-sage-fg",
  OVERFLOW: "bg-tone-honey-bg text-tone-honey-fg",
  SUSPENDED: "bg-destructive/10 text-destructive",
};
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  CHILD: "Child",
  VIEW_ONLY: "View only",
};
// Roles an admin may assign — never OWNER (ownership moves via transfer, which
// this surface intentionally does not expose). Mirrors the API's assignable set.
const ASSIGNABLE_ROLES = ["ADMIN", "MEMBER", "CHILD", "VIEW_ONLY"] as const;

const inputCls =
  "rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

interface AdminApiError {
  message: string;
  requiresMfa: boolean;
}

/** Mirror of the user-detail client helper: normalize a failed admin response. */
async function readAdminApiError(response: Response, fallback: string): Promise<AdminApiError> {
  const data = await response.json().catch(() => ({}));
  const requiresMfa = Boolean((data as any)?.requiresMfa);
  const rawMessage = typeof (data as any)?.error === "string" ? (data as any).error : fallback;

  if (response.status === 401) {
    return { message: "Admin session expired. Please sign in again.", requiresMfa };
  }
  if (response.status === 403 && /origin|referer/i.test(rawMessage)) {
    return {
      message: "Request blocked by admin security checks. Refresh the admin page and retry from the same host.",
      requiresMfa,
    };
  }
  if (response.status === 403 && rawMessage === "Forbidden") {
    return { message: "Your admin account does not have permission to perform this action.", requiresMfa };
  }
  if (requiresMfa && response.status === 403) {
    return { message: "MFA is required for this operation. Add an authenticator code or backup code and retry.", requiresMfa };
  }
  return { message: rawMessage, requiresMfa };
}

function pill(map: Record<string, string>, key: string, label?: string) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[key] || "bg-tone-slate-bg text-muted-foreground"}`}>
      {label || key}
    </span>
  );
}

// A pending step-up action: which API to hit, the dialog copy, and a callback to
// patch local state on success. Drives the single shared PasswordConfirmModal so
// every mutation reuses the exact same 403/requiresMfa re-prompt flow.
type PendingAction = {
  kind: "rename" | "removeMember" | "changeRole" | "revokeInvite" | "resendInvite";
  title: string;
  description: string;
  confirmLabel: string;
  run: (stepUp: StepUpValues) => Promise<Response>;
  onSuccess: (data: any) => void;
  successMessage: string;
};

export default function WorkspaceDetailClient({ id }: { id: string }) {
  const [ws, setWs] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Rename inline editor.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Shared step-up modal state.
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [stepUpRequiresMfa, setStepUpRequiresMfa] = useState(false);

  // Per-row busy flags so only the acted-on control spins.
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setWs(data.workspace || null);
    } catch {
      toast.error("Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Open the shared step-up modal for a given pending action.
  function startAction(action: PendingAction) {
    setStepUpError(null);
    setStepUpRequiresMfa(false);
    setPending(action);
  }

  async function confirmPending(_password: string, stepUp: StepUpValues) {
    if (!pending) return;
    setStepUpBusy(true);
    setStepUpError(null);
    try {
      const res = await pending.run(stepUp);
      if (!res.ok) {
        const { message, requiresMfa } = await readAdminApiError(res, "Action failed.");
        setStepUpError(message);
        setStepUpRequiresMfa(requiresMfa);
        toast.error(message);
        return;
      }
      const data = await res.json().catch(() => ({}));
      pending.onSuccess(data);
      toast.success(pending.successMessage);
      setPending(null);
      setStepUpRequiresMfa(false);
    } catch {
      setStepUpError("Action failed.");
      toast.error("Action failed.");
    } finally {
      setStepUpBusy(false);
    }
  }

  function closeStepUp() {
    if (stepUpBusy) return;
    setPending(null);
    setStepUpError(null);
    setStepUpRequiresMfa(false);
    setBusyMemberId(null);
    setBusyInviteId(null);
  }

  // ── Action builders ───────────────────────────────────────────

  function submitRename() {
    if (!ws) return;
    const name = nameDraft.trim();
    if (!name) {
      toast.error("Enter a workspace name.");
      return;
    }
    if (name === ws.name) {
      setEditingName(false);
      return;
    }
    startAction({
      kind: "rename",
      title: "Rename workspace",
      description: `Rename "${ws.name}" to "${name}". The owner and members will see the new name.`,
      confirmLabel: "Rename",
      run: (stepUp) =>
        fetch(`/api/workspaces/${id}/rename`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, ...stepUp }),
        }),
      onSuccess: (data) => {
        setWs((prev) => (prev ? { ...prev, name: data?.name ?? name } : prev));
        setEditingName(false);
      },
      successMessage: "Workspace renamed",
    });
  }

  function removeMember(m: Member) {
    setBusyMemberId(m.id);
    const who = m.deleted ? "(deleted user)" : m.name || m.email || m.userId;
    startAction({
      kind: "removeMember",
      title: "Remove member",
      description: `Remove ${who} from this workspace. Their addresses, services and budgets stay with the workspace; only their membership is removed. This frees a seat.`,
      confirmLabel: "Remove member",
      run: (stepUp) =>
        fetch(`/api/workspaces/${id}/members/${m.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stepUp),
        }),
      onSuccess: () => {
        setWs((prev) => (prev ? { ...prev, members: prev.members.filter((x) => x.id !== m.id) } : prev));
        // Seat counts / overflow restores may have shifted — refetch for truth.
        fetchDetail();
      },
      successMessage: "Member removed",
    });
  }

  function changeMemberRole(m: Member, newRole: string) {
    if (newRole === m.role) return;
    setBusyMemberId(m.id);
    const who = m.name || m.email || m.userId;
    startAction({
      kind: "changeRole",
      title: "Change member role",
      description: `Change ${who}'s role from ${ROLE_LABEL[m.role] || m.role} to ${ROLE_LABEL[newRole] || newRole}.`,
      confirmLabel: "Change role",
      run: (stepUp) =>
        fetch(`/api/workspaces/${id}/members/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole, ...stepUp }),
        }),
      onSuccess: (data) => {
        const role = data?.role ?? newRole;
        setWs((prev) =>
          prev ? { ...prev, members: prev.members.map((x) => (x.id === m.id ? { ...x, role } : x)) } : prev,
        );
      },
      successMessage: "Role updated",
    });
  }

  function revokeInvite(inv: Invitation) {
    setBusyInviteId(inv.id);
    startAction({
      kind: "revokeInvite",
      title: "Revoke invitation",
      description: `Revoke the pending invitation for ${inv.email}. The invite link stops working immediately.`,
      confirmLabel: "Revoke invitation",
      run: (stepUp) =>
        fetch(`/api/workspaces/${id}/invitations/${inv.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stepUp),
        }),
      onSuccess: () => {
        setWs((prev) =>
          prev ? { ...prev, invitations: prev.invitations.filter((x) => x.id !== inv.id) } : prev,
        );
      },
      successMessage: "Invitation revoked",
    });
  }

  function resendInvite(inv: Invitation) {
    setBusyInviteId(inv.id);
    startAction({
      kind: "resendInvite",
      title: "Resend invitation",
      description: `Resend the invitation to ${inv.email}. A fresh link is generated (the previous one stops working) and the email is sent again.`,
      confirmLabel: "Resend invitation",
      run: (stepUp) =>
        fetch(`/api/workspaces/${id}/invitations/${inv.id}/resend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stepUp),
        }),
      onSuccess: (data) => {
        const next = data?.invitation as Invitation | undefined;
        if (next) {
          setWs((prev) =>
            prev ? { ...prev, invitations: prev.invitations.map((x) => (x.id === inv.id ? { ...x, ...next } : x)) } : prev,
          );
        }
        if (data?.emailSent === false) {
          toast.message("Invitation updated, but the email could not be sent.", {
            description: data?.devInviteUrl ? `Dev link: ${data.devInviteUrl}` : undefined,
          });
        }
      },
      successMessage: "Invitation resent",
    });
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (notFound || !ws) {
    return (
      <div className="space-y-4">
        <Link href="/workspaces" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to workspaces
        </Link>
        <p className="text-sm text-muted-foreground">Workspace not found.</p>
      </div>
    );
  }

  const isDeleted = Boolean(ws.deletedAt);

  return (
    <div className="space-y-6">
      <Link href="/workspaces" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to workspaces
      </Link>

      {/* Header + inline rename control on the title */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                className={`${inputCls} text-xl font-semibold`}
                value={nameDraft}
                maxLength={120}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename();
                  if (e.key === "Escape") setEditingName(false);
                }}
                placeholder="Workspace name"
                autoFocus
                aria-label="Workspace name"
              />
              <button
                type="button"
                onClick={submitRename}
                aria-label="Save name"
                className="rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                aria-label="Cancel rename"
                className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <AdminPageHeader
              eyebrow={ws.planLabel}
              title={ws.name}
              subtitle={`Owner: ${ws.owner.deleted ? "(deleted)" : ws.owner.name || ws.owner.email || "—"}`}
              actions={
                isDeleted ? undefined : (
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(ws.name);
                      setEditingName(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" /> Rename
                  </button>
                )
              }
            />
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Crown className="h-4 w-4" /> Plan</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{ws.plan}</div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Users className="h-4 w-4" /> Seats used</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{ws.activeSeats} / {ws.seatLimit}</div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Clock className="h-4 w-4" /> Created</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{new Date(ws.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Members + per-member authorship (who entered what) + actions */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Members &amp; who entered what</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Addr</span></th>
                <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Svc</span></th>
                <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Budget</span></th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="px-4 py-3 font-medium text-right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {ws.members.map((m) => {
                const isOwner = m.role === "OWNER";
                const rowBusy = busyMemberId === m.id;
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link href={`/users/${m.userId}`} className="font-medium text-foreground hover:underline">
                        {m.deleted ? "(deleted)" : m.name || m.email || m.userId}
                      </Link>
                      {!m.deleted && m.name && m.email ? (
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {isOwner ? (
                        pill(ROLE_COLORS, m.role, ROLE_LABEL[m.role] || m.role)
                      ) : (
                        <select
                          className={inputCls}
                          value={m.role}
                          disabled={rowBusy || isDeleted}
                          onChange={(e) => changeMemberRole(m, e.target.value)}
                          aria-label={`Role for ${m.name || m.email || m.userId}`}
                        >
                          {/* Keep the current role selectable even if it isn't in the
                              assignable set (defensive — all non-OWNER roles are). */}
                          {!ASSIGNABLE_ROLES.includes(m.role as (typeof ASSIGNABLE_ROLES)[number]) && (
                            <option value={m.role}>{ROLE_LABEL[m.role] || m.role}</option>
                          )}
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">{pill(STATUS_COLORS, m.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.entered.addresses}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.entered.services}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.role === "CHILD" ? "—" : m.entered.budgets}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(m.joinedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.lastActiveAt ? new Date(m.lastActiveAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {isOwner ? (
                        <span className="text-xs text-muted-foreground">Owner</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeMember(m)}
                          disabled={rowBusy || isDeleted}
                          className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invitations + actions */}
      {ws.invitations.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Pending invitations</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Sent</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium text-right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {ws.invitations.map((inv) => {
                  const rowBusy = busyInviteId === inv.id;
                  return (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-4 py-3 text-muted-foreground">{inv.email}</td>
                      <td className="px-4 py-3">{pill(ROLE_COLORS, inv.role, ROLE_LABEL[inv.role] || inv.role)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => resendInvite(inv)}
                            disabled={rowBusy || isDeleted}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                          >
                            {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Resend
                          </button>
                          <button
                            type="button"
                            onClick={() => revokeInvite(inv)}
                            disabled={rowBusy || isDeleted}
                            className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" /> Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shared step-up modal — one instance drives every mutation, so the
          403 {requiresMfa} re-prompt flow is identical to the impersonate path. */}
      <PasswordConfirmModal
        open={pending !== null}
        title={pending?.title || ""}
        description={pending?.description || ""}
        confirmLabel={pending?.confirmLabel || "Confirm"}
        busy={stepUpBusy}
        error={stepUpError}
        requiresMfa={stepUpRequiresMfa}
        onClose={closeStepUp}
        onConfirm={confirmPending}
      />
    </div>
  );
}
