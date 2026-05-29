"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Users, Trash2, ArrowLeft } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  role: string;
  status: string;
  planLabel: string;
  seatLimit: number;
  memberCount: number;
  deletedAt: string | null;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  status: string;
  managedSyncEnabled: boolean | null;
  joinedAt: string;
  lastActiveAt: string | null;
  displayName: string | null;
  email: string;
}

interface Invitation {
  id: string;
  invitedEmail: string;
  role: string;
  status: string;
  expiresAt: string;
  tokenLast4: string;
  createdAt: string;
}

const ASSIGNABLE_ROLES = ["ADMIN", "MEMBER", "CHILD", "VIEW_ONLY"];
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  CHILD: "Child",
  VIEW_ONLY: "View only",
};

function isManagerRole(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

function managedSyncOn(role: string, flag: boolean | null): boolean {
  return typeof flag === "boolean" ? flag : role === "CHILD";
}

export default function WorkspaceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [featureOff, setFeatureOff] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [myManagedSync, setMyManagedSync] = useState<boolean | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [devInviteUrl, setDevInviteUrl] = useState<string | null>(null);
  const [busyMember, setBusyMember] = useState<string | null>(null);

  const selected = workspaces.find((w) => w.id === selectedId) ?? null;
  const iAmManager = selected ? isManagerRole(selected.role) : false;
  const iAmOwner = selected ? selected.role === "OWNER" : false;

  // Initial load: workspaces + my user id.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [wsRes, meRes] = await Promise.all([
          fetch("/api/workspaces", { cache: "no-store" }),
          fetch("/api/auth/me?optional=1", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (wsRes.status === 404) {
          setFeatureOff(true);
          return;
        }
        if (!wsRes.ok) throw new Error("load failed"); // 5xx → caught below + toasted, not shown as "no workspaces"
        const wsData = await wsRes.json().catch(() => ({}));
        const meData = await meRes.json().catch(() => ({}));
        const list: Workspace[] = Array.isArray(wsData.workspaces) ? wsData.workspaces : [];
        setWorkspaces(list);
        setMyUserId(meData.user?.id ?? null);
        if (list.length > 0) setSelectedId(list[0].id);
      } catch {
        if (!cancelled) toast.error("Couldn't load your workspaces.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDetail = useCallback(async (workspaceId: string, manager: boolean) => {
    setLoadingDetail(true);
    setDevInviteUrl(null);
    try {
      const calls: Promise<Response>[] = [
        fetch(`/api/workspaces/${workspaceId}/members`, { cache: "no-store" }),
        fetch(`/api/workspaces/${workspaceId}/managed-sync`, { cache: "no-store" }),
      ];
      if (manager) calls.push(fetch(`/api/workspaces/${workspaceId}/invitations`, { cache: "no-store" }));
      const [memRes, msRes, invRes] = await Promise.all(calls);

      const memData = await memRes.json().catch(() => ({}));
      setMembers(Array.isArray(memData.members) ? memData.members : []);

      const msData = await msRes.json().catch(() => ({}));
      setMyManagedSync(typeof msData.enabled === "boolean" ? msData.enabled : null);

      if (invRes) {
        const invData = await invRes.json().catch(() => ({}));
        setInvitations(Array.isArray(invData.invitations) ? invData.invitations : []);
      } else {
        setInvitations([]);
      }
    } catch {
      toast.error("Couldn't load workspace details.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId, iAmManager);
  }, [selectedId, iAmManager, loadDetail]);

  const refreshDetail = () => {
    if (selectedId) loadDetail(selectedId, iAmManager);
  };

  const changeRole = async (member: Member, role: string) => {
    if (!selectedId) return;
    setBusyMember(member.id);
    try {
      const res = await fetch(`/api/workspaces/${selectedId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't change the role.");
        return;
      }
      toast.success("Role updated.");
      refreshDetail();
    } finally {
      setBusyMember(null);
    }
  };

  const removeMember = async (member: Member) => {
    if (!selectedId) return;
    setBusyMember(member.id);
    try {
      const res = await fetch(`/api/workspaces/${selectedId}/members/${member.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't remove the member.");
        return;
      }
      toast.success("Member removed.");
      refreshDetail();
    } finally {
      setBusyMember(null);
    }
  };

  const transferOwnership = async (member: Member) => {
    if (!selectedId) return;
    if (!window.confirm(`Make ${member.displayName || member.email} the owner? You'll become an admin.`)) return;
    setBusyMember(member.id);
    try {
      const res = await fetch(`/api/workspaces/${selectedId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: member.userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't transfer ownership.");
        return;
      }
      toast.success("Ownership transferred.");
      window.location.reload();
    } finally {
      setBusyMember(null);
    }
  };

  const leaveWorkspace = async () => {
    if (!selectedId) return;
    setBusyMember("__leave__");
    try {
      const res = await fetch(`/api/workspaces/${selectedId}/members/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't leave the workspace.");
        return;
      }
      toast.success("You left the workspace.");
      window.location.reload();
    } finally {
      setBusyMember(null);
    }
  };

  const sendInvite = async () => {
    if (!selectedId || !inviteEmail.trim()) return;
    setInviting(true);
    setDevInviteUrl(null);
    try {
      const res = await fetch(`/api/workspaces/${selectedId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't send the invitation.");
        return;
      }
      toast.success(`Invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail("");
      if (data.devInviteUrl) setDevInviteUrl(data.devInviteUrl);
      refreshDetail();
    } finally {
      setInviting(false);
    }
  };

  const revokeInvite = async (inv: Invitation) => {
    if (!selectedId) return;
    setBusyMember(inv.id);
    try {
      const res = await fetch(`/api/workspaces/${selectedId}/invitations/${inv.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't revoke the invitation.");
        return;
      }
      toast.success("Invitation revoked.");
      refreshDetail();
    } finally {
      setBusyMember(null);
    }
  };

  const toggleMyManagedSync = async () => {
    if (!selectedId) return;
    const next = !(myManagedSync ?? false);
    setMyManagedSync(next);
    try {
      const res = await fetch(`/api/workspaces/${selectedId}/managed-sync`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMyManagedSync(!next);
        toast.error(data.error || "Couldn't update your setting.");
        return;
      }
      setMyManagedSync(typeof data.enabled === "boolean" ? data.enabled : next);
    } catch {
      setMyManagedSync(!next);
      toast.error("Couldn't update your setting.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (featureOff) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <Header />
        <div className="rounded-2xl border border-border bg-foreground/5 p-6 text-sm text-muted-foreground">
          Shared workspaces aren&apos;t available on your account yet.
        </div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <Header />
        <div className="rounded-2xl border border-border bg-foreground/5 p-6 text-sm text-muted-foreground">
          You&apos;re not part of any shared workspace yet. A Family or Pro plan lets you create one and invite members.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <Header />

      {workspaces.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedId(w.id)}
              className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                w.id === selectedId
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-foreground/5"
              }`}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="rounded-2xl border border-border bg-foreground/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {selected.planLabel} · You are {ROLE_LABEL[selected.role] ?? selected.role} ·{" "}
                  {selected.memberCount} / {selected.seatLimit} members
                  {iAmManager && invitations.length > 0 ? ` (+${invitations.length} pending)` : ""}
                </p>
              </div>
              {selected.role !== "OWNER" && (
                <button
                  onClick={leaveWorkspace}
                  disabled={busyMember === "__leave__"}
                  className="shrink-0 rounded-xl border border-destructive bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
                >
                  Leave
                </button>
              )}
            </div>
          </div>

          {/* My managed-sync consent */}
          <div className="rounded-2xl border border-border bg-foreground/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Managed sync</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Let an owner or admin push an address change to your connected partners on your behalf. They never see
                  your partner passwords.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={Boolean(myManagedSync)}
                onClick={toggleMyManagedSync}
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
                  myManagedSync ? "bg-primary" : "bg-foreground/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    myManagedSync ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Members */}
          <div className="rounded-2xl border border-border bg-foreground/5 overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-5 pb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/40">Members</h3>
            </div>
            <div className="divide-y divide-border">
              {loadingDetail && members.length === 0 ? (
                <div className="px-5 py-6 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                members.map((m) => {
                  const isSelf = myUserId != null && m.userId === myUserId;
                  const canManageThis = iAmManager && !isSelf && m.role !== "OWNER";
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {m.displayName || m.email}
                          {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.email}
                          {m.status !== "ACTIVE" ? ` · ${m.status.toLowerCase()}` : ""}
                          {iAmManager && managedSyncOn(m.role, m.managedSyncEnabled) ? " · managed sync on" : ""}
                        </p>
                      </div>
                      {canManageThis ? (
                        <select
                          value={m.role}
                          disabled={busyMember === m.id}
                          onChange={(e) => changeRole(m, e.target.value)}
                          className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded-lg bg-foreground/10 px-2 py-1 text-xs text-muted-foreground">
                          {ROLE_LABEL[m.role] ?? m.role}
                        </span>
                      )}
                      {iAmOwner && !isSelf && m.status === "ACTIVE" && (m.role === "ADMIN" || m.role === "MEMBER") && (
                        <button
                          onClick={() => transferOwnership(m)}
                          disabled={busyMember === m.id}
                          className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
                        >
                          Make owner
                        </button>
                      )}
                      {canManageThis && (
                        <button
                          onClick={() => removeMember(m)}
                          disabled={busyMember === m.id}
                          aria-label="Remove member"
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Invitations (managers only) */}
          {iAmManager && (
            <div className="rounded-2xl border border-border bg-foreground/5 overflow-hidden">
              <div className="px-5 pt-5 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/40">Invite a member</h3>
              </div>
              <div className="space-y-3 px-5 pb-5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    placeholder="name@email.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={sendInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Invite
                  </button>
                </div>

                {devInviteUrl && (
                  <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3 text-xs text-tone-honey-fg/90">
                    <p className="mb-1 font-medium">Dev invite link (no email configured):</p>
                    <code className="break-all">{devInviteUrl}</code>
                  </div>
                )}

                {invitations.length > 0 && (
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{inv.invitedEmail}</p>
                          <p className="text-xs text-muted-foreground">
                            {ROLE_LABEL[inv.role] ?? inv.role} · pending
                          </p>
                        </div>
                        <button
                          onClick={() => revokeInvite(inv)}
                          disabled={busyMember === inv.id}
                          className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <Link href="/settings" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>
      <h1 className="text-2xl md:text-3xl font-bold text-foreground">Workspace</h1>
      <p className="text-muted-foreground mt-1">Manage members, roles, and invitations</p>
    </div>
  );
}
