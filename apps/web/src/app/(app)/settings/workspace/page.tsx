"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Loader2, Users, Trash2, ArrowLeft, Share2, Copy } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Workspace {
  id: string;
  name: string;
  role: string;
  status: string;
  planLabel: string;
  seatLimit: number;
  memberCount: number;
  isPersonalSolo: boolean;
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
const WORKSPACE_COOKIE_NAME = "lf_workspace_id";
const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function isManagerRole(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

function managedSyncOn(role: string, flag: boolean | null): boolean {
  return typeof flag === "boolean" ? flag : role === "CHILD";
}

// Managed sync (pushing an address change to a member's partner connectors on their
// behalf) is not yet generally available: the connector backend stays gated behind
// FEATURE_API_CONNECTORS until partner agreements + legal sign-off. Until then we surface
// "Coming soon" and disable the consent toggle so Family/Pro users aren't shown a feature
// that can't run yet. Flip to false once connectors are live to restore the toggle.
const MANAGED_SYNC_COMING_SOON = true;

function readWorkspaceCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${WORKSPACE_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function persistWorkspaceSelection(workspaceId: string) {
  document.cookie = `${WORKSPACE_COOKIE_NAME}=${encodeURIComponent(workspaceId)}; path=/; max-age=${WORKSPACE_COOKIE_MAX_AGE}; samesite=lax`;
}

export default function WorkspaceSettingsPage() {
  const tShare = useTranslations("workspaceShare");
  const inviteEmailRef = useRef<HTMLInputElement | null>(null);
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
  const [editingName, setEditingName] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [transferPassword, setTransferPassword] = useState("");
  const [transferMfaCode, setTransferMfaCode] = useState("");
  const [transferBackupCode, setTransferBackupCode] = useState("");
  const [transferring, setTransferring] = useState(false);

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
        if (list.length > 0) {
          const cookieWorkspaceId = readWorkspaceCookie();
          // Default to the cookie's workspace if it's still in the list; else
          // prefer a shared (non-personal) workspace over a personal-solo so a
          // Family/Pro member lands on the household they actually share, not
          // their own data container. Fall back to the first entry otherwise.
          const sharedDefault = list.find((w) => !w.isPersonalSolo);
          const nextSelectedId =
            list.find((w) => w.id === cookieWorkspaceId)?.id ?? sharedDefault?.id ?? list[0].id;
          setSelectedId(nextSelectedId);
          persistWorkspaceSelection(nextSelectedId);
        }
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
    } catch {
      toast.error("Something went wrong. Please try again.");
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
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusyMember(null);
    }
  };

  const openTransferOwnership = (member: Member) => {
    setTransferTarget(member);
    setTransferPassword("");
    setTransferMfaCode("");
    setTransferBackupCode("");
  };

  const closeTransferDialog = () => {
    if (transferring) return;
    setTransferTarget(null);
    setTransferPassword("");
    setTransferMfaCode("");
    setTransferBackupCode("");
  };

  const transferOwnership = async () => {
    if (!selectedId || !transferTarget) return;
    setTransferring(true);
    setBusyMember(transferTarget.id);
    try {
      const res = await fetch(`/api/workspaces/${selectedId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: transferTarget.userId,
          ...(transferPassword.trim() ? { confirmPassword: transferPassword } : {}),
          ...(transferMfaCode.trim() ? { mfaCode: transferMfaCode.trim() } : {}),
          ...(transferBackupCode.trim() ? { backupCode: transferBackupCode.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't transfer ownership.");
        return;
      }
      toast.success("Ownership transferred.");
      setTransferTarget(null);
      window.location.reload();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusyMember(null);
      setTransferring(false);
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
    } catch {
      toast.error("Something went wrong. Please try again.");
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
    } catch {
      toast.error("Something went wrong. Please try again.");
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
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusyMember(null);
    }
  };

  const saveHouseholdName = async () => {
    if (!selectedId) return;
    const name = householdName.trim();
    if (name.length < 1 || name.length > 60) {
      toast.error("Name must be between 1 and 60 characters.");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/workspaces/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't rename your household.");
        return;
      }
      toast.success("Household name saved.");
      setWorkspaces((prev) => prev.map((w) => (w.id === selectedId ? { ...w, name: data.name ?? name } : w)));
      setEditingName(false);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSavingName(false);
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

  const focusInviteForm = () => {
    const el = inviteEmailRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  };

  const copyMoveSummary = async () => {
    if (!selected) return;
    const summary = tShare("summaryLine", {
      name: selected.name,
      plan: selected.planLabel,
      members: selected.memberCount,
      seats: selected.seatLimit,
    });
    try {
      await navigator.clipboard.writeText(summary);
      toast.success(tShare("copied"));
    } catch {
      toast.error(tShare("copyFailed"));
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
              onClick={() => {
                setSelectedId(w.id);
                persistWorkspaceSelection(w.id);
              }}
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
                {iAmOwner && editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveHouseholdName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                      maxLength={60}
                      autoFocus
                      aria-label="Workspace name"
                      className="rounded-lg border border-input bg-background px-2 py-1 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      onClick={saveHouseholdName}
                      disabled={savingName}
                      className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      disabled={savingName}
                      className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-foreground/10"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                    {selected.isPersonalSolo && (
                      <span className="rounded-full border border-border bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Personal
                      </span>
                    )}
                    {iAmOwner && (
                      <button
                        onClick={() => {
                          setHouseholdName(selected.name);
                          setEditingName(true);
                        }}
                        className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
                      >
                        Rename
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {selected.isPersonalSolo ? (
                    <>{selected.planLabel} · Personal · just you</>
                  ) : (
                    <>
                      {selected.planLabel} · You are {ROLE_LABEL[selected.role] ?? selected.role} ·{" "}
                      {selected.memberCount} / {selected.seatLimit} members
                      {iAmManager && invitations.length > 0 ? ` (+${invitations.length} pending)` : ""}
                    </>
                  )}
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

          {/* Share this move (D20 v1) — surfaces the EXISTING household invite
              flow plus a copyable read-only summary. A tokenized public share
              link is deferred (separate security review) and shown as
              "Coming soon" only. Shown for shared workspaces with spare seats. */}
          {!selected.isPersonalSolo && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {tShare("eyebrow")}
                </span>
              </div>
              <h3 className="mt-1.5 text-base font-semibold text-foreground">{tShare("title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{tShare("body")}</p>

              {iAmManager && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={focusInviteForm}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                  >
                    <Users className="h-4 w-4" />
                    {tShare("inviteCta")}
                  </button>
                  <p className="mt-1.5 text-xs text-muted-foreground">{tShare("inviteHint")}</p>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{tShare("summaryTitle")}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {tShare("summaryLine", {
                        name: selected.name,
                        plan: selected.planLabel,
                        members: selected.memberCount,
                        seats: selected.seatLimit,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyMoveSummary}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-foreground/5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {tShare("copy")}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{tShare("summaryHint")}</p>
              </div>

              <div className="mt-3 rounded-xl border border-dashed border-border bg-foreground/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{tShare("linkSoonTitle")}</p>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {tShare("linkSoonBadge")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tShare("linkSoonBody")}</p>
              </div>
            </div>
          )}

          {/* Household setup — guides a new Family/Pro owner who hasn't built
              their household yet (only themselves, no pending invites). */}
          {iAmOwner && selected.seatLimit > 1 && selected.memberCount <= 1 && invitations.length === 0 && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <h3 className="text-sm font-semibold text-foreground">Finish setting up your household</h3>
              <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">1.</span> Name your household — tap{" "}
                  <span className="font-medium text-foreground">Rename</span> above so members recognize it.
                </li>
                <li>
                  <span className="font-medium text-foreground">2.</span> Invite up to {selected.seatLimit - 1}{" "}
                  {selected.seatLimit - 1 === 1 ? "person" : "people"} using the form below. Everyone keeps their own
                  login and private data — they just share this {selected.planLabel} plan.
                </li>
              </ol>
            </div>
          )}

          {/* My managed-sync consent — "Coming soon" until partner connectors + legal sign-off */}
          <div className="rounded-2xl border border-border bg-foreground/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Managed sync</h3>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Coming soon
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Soon an owner or admin will be able to push an address change to your connected partners on your
                  behalf — without ever seeing your partner passwords. We&apos;ll let you know the moment it&apos;s ready.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={MANAGED_SYNC_COMING_SOON ? false : Boolean(myManagedSync)}
                disabled
                onClick={toggleMyManagedSync}
                title="Coming soon"
                className="relative mt-0.5 h-6 w-11 shrink-0 cursor-not-allowed rounded-full bg-foreground/15 opacity-60"
              >
                <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white/70" />
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
                          {!MANAGED_SYNC_COMING_SOON && iAmManager && managedSyncOn(m.role, m.managedSyncEnabled)
                            ? " · managed sync on"
                            : ""}
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
                          onClick={() => openTransferOwnership(m)}
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

          {/* A solo personal workspace has no spare seats to invite into — surface
              a quiet hint instead of a full invite form so it reads as the owner's
              own data container, not a household they staff. */}
          {iAmManager && selected.isPersonalSolo && (
            <div className="rounded-2xl border border-border bg-foreground/5 p-5 text-xs text-muted-foreground">
              This is your personal workspace — just your own data. Upgrade to a Family or Pro plan to
              invite people and share it as a household.
            </div>
          )}

          {/* Invitations (managers only) — hidden for a solo personal workspace */}
          {iAmManager && !selected.isPersonalSolo && (
            <div className="rounded-2xl border border-border bg-foreground/5 overflow-hidden">
              <div className="px-5 pt-5 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/40">Invite a member</h3>
              </div>
              <div className="space-y-3 px-5 pb-5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    ref={inviteEmailRef}
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
                    {ASSIGNABLE_ROLES.filter((r) => r !== "ADMIN" || iAmOwner).map((r) => (
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

      <Dialog open={Boolean(transferTarget)} onOpenChange={(open) => {
        if (!open) closeTransferDialog();
      }}>
        <DialogContent className="space-y-4">
          <DialogHeader>
            <DialogTitle>Transfer ownership</DialogTitle>
            <DialogDescription>
              Make {transferTarget?.displayName || transferTarget?.email || "this member"} the workspace owner.
              You&apos;ll become an admin. Confirm with your password or MFA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="workspace-transfer-password" className="text-xs font-medium text-muted-foreground">
                Password
              </label>
              <PasswordInput
                id="workspace-transfer-password"
                autoComplete="current-password"
                value={transferPassword}
                onChange={(event) => setTransferPassword(event.target.value)}
                disabled={transferring}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Current password"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="workspace-transfer-mfa" className="text-xs font-medium text-muted-foreground">
                  MFA code
                </label>
                <input
                  id="workspace-transfer-mfa"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={transferMfaCode}
                  onChange={(event) => setTransferMfaCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  disabled={transferring}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="123456"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="workspace-transfer-backup" className="text-xs font-medium text-muted-foreground">
                  Backup code
                </label>
                <input
                  id="workspace-transfer-backup"
                  type="password"
                  autoComplete="one-time-code"
                  value={transferBackupCode}
                  onChange={(event) => setTransferBackupCode(event.target.value)}
                  disabled={transferring}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Recovery code"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeTransferDialog}
              disabled={transferring}
              className="rounded-xl px-4 py-2 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={transferOwnership}
              disabled={
                transferring ||
                (!transferPassword.trim() && !transferMfaCode.trim() && !transferBackupCode.trim())
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {transferring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                "Transfer ownership"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
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
