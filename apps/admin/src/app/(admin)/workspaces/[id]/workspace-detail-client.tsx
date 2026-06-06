"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Users, MapPin, Zap, DollarSign, Crown, Clock } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";

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
  invitations: Array<{ id: string; email: string; role: string; status: string; expiresAt: string; createdAt: string }>;
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

function pill(map: Record<string, string>, key: string, label?: string) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[key] || "bg-tone-slate-bg text-muted-foreground"}`}>
      {label || key}
    </span>
  );
}

export default function WorkspaceDetailClient({ id }: { id: string }) {
  const [ws, setWs] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  return (
    <div className="space-y-6">
      <Link href="/workspaces" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to workspaces
      </Link>

      <AdminPageHeader
        eyebrow={ws.planLabel}
        title={ws.name}
        subtitle={`Owner: ${ws.owner.deleted ? "(deleted)" : ws.owner.name || ws.owner.email || "—"}`}
      />

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

      {/* Members + per-member authorship (who entered what) */}
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
              </tr>
            </thead>
            <tbody>
              {ws.members.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link href={`/users/${m.userId}`} className="font-medium text-foreground hover:underline">
                      {m.deleted ? "(deleted)" : m.name || m.email || m.userId}
                    </Link>
                    {!m.deleted && m.name && m.email ? (
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{pill(ROLE_COLORS, m.role, ROLE_LABEL[m.role] || m.role)}</td>
                  <td className="px-4 py-3">{pill(STATUS_COLORS, m.status)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.entered.addresses}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.entered.services}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.role === "CHILD" ? "—" : m.entered.budgets}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(m.joinedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.lastActiveAt ? new Date(m.lastActiveAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invitations */}
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
                </tr>
              </thead>
              <tbody>
                {ws.invitations.map((inv) => (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground">{inv.email}</td>
                    <td className="px-4 py-3">{pill(ROLE_COLORS, inv.role, ROLE_LABEL[inv.role] || inv.role)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
