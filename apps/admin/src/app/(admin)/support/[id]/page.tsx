"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Send, Lock } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const statusCls: Record<string, string> = {
  OPEN: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  WAITING_USER: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  RESOLVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

interface Message {
  id: string;
  senderType: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}
interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    subscription?: {
      plan: string;
      status: string;
      provider: string | null;
      platform: string | null;
      lastValidatedAt: string | null;
    } | null;
    movingPlans?: Array<{
      id: string;
      status: string;
      moveDate: string;
      fromAddress: { city: string; state: string; zip: string } | null;
      toAddress: { city: string; state: string; zip: string } | null;
      moveTasks: Array<{
        id: string;
        actionType: string;
        status: string;
        confidence: string;
        title: string;
        provider?: { id: string; name: string; scope: string } | null;
        customProvider?: { id: string; name: string; providerType: string } | null;
        destinationProvider?: { id: string; name: string; scope: string } | null;
      }>;
    }>;
    services?: Array<{
      id: string;
      category: string;
      providerName: string;
      isActive: boolean;
      provider?: { id: string; name: string; scope: string } | null;
      customProvider?: { id: string; name: string; providerType: string; trustStatus: string } | null;
    }>;
    customProviders?: Array<{
      id: string;
      name: string;
      category: string;
      providerType: string;
      trustStatus: string;
      adminReviewStatus: string;
    }>;
  };
  assignedAdmin?: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
  sla?: { breached: boolean; remainingHours: number | null; dueAt: string; targetHours: number; policy?: string; note?: string };
  messages: Message[];
}

function getAdminLabel(admin?: Ticket["assignedAdmin"]) {
  if (!admin) return "";
  return [admin.firstName, admin.lastName].filter(Boolean).join(" ") || admin.email || "Assigned admin";
}

function getSlaLabel(sla?: Ticket["sla"]) {
  if (!sla) return "No target";
  if (sla.remainingHours === null) return "Closed";
  if (sla.breached) return "Breached";
  if (sla.remainingHours <= 0) return "Due now";
  if (sla.remainingHours < 24) return `${sla.remainingHours}h left`;
  return `${Math.ceil(sla.remainingHours / 24)}d left`;
}

export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchTicket = useCallback(async () => {
    const res = await fetch(`/api/tickets/${id}`);
    if (res.ok) {
      const data = await res.json();
      setTicket(data.ticket);
    }
  }, [id]);

  useEffect(() => {
    fetchTicket().finally(() => setLoading(false));
  }, [fetchTicket]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setCurrentAdminId(data?.admin?.id || ""))
      .catch(() => null);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply, isInternal }),
      });
      if (res.ok) {
        setReply("");
        toast.success(isInternal ? "Internal note added." : "Reply sent.");
        await fetchTicket();
      } else {
        toast.error("Failed to send reply.");
      }
    } finally {
      setSending(false);
    }
  };

  const handleUpdate = async (field: string, value: string | null) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        toast.success("Ticket updated.");
        await fetchTicket();
      } else {
        toast.error("Failed to update ticket.");
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!ticket) return <div className="p-6"><p className="text-muted-foreground">Ticket not found.</p><Link href="/support" className="text-primary text-sm mt-2 inline-block">← Back</Link></div>;

  const userName = [ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(" ") || ticket.user.email || "Unknown";
  const activeMove = ticket.user.movingPlans?.[0] || null;
  const openMoveTasks = activeMove?.moveTasks?.filter((task) => !["COMPLETED", "DISMISSED"].includes(task.status)) || [];
  const lowConfidenceTasks = activeMove?.moveTasks?.filter((task) => ["LOW", "UNVERIFIED"].includes(task.confidence)) || [];

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/support">
          <button className="p-2 rounded-lg border border-border hover:bg-accent transition">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{ticket.subject}</h1>
          <p className="text-xs text-muted-foreground">#{ticket.id.slice(-8)} · {ticket.category} · {userName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {ticket.messages.map((msg) => {
              const isUser = msg.senderType === "USER";
              const isSystem = msg.senderType === "SYSTEM";
              return (
                <div key={msg.id} className={`p-4 ${msg.isInternal ? "bg-yellow-500/5 border-l-2 border-yellow-500/30" : ""}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      isUser ? "bg-blue-500/20 text-blue-400" :
                      isSystem ? "bg-muted text-muted-foreground" :
                      "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {isUser ? "U" : isSystem ? "⚙" : "A"}
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {isUser ? userName : isSystem ? "System" : "Admin"}
                    </span>
                    {msg.isInternal && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">Internal</span>}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply form */}
          <form onSubmit={handleReply} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium text-foreground">Reply</p>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded" />
                Internal note (not visible to user)
              </label>
            </div>
            <textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              rows={4}
              placeholder={isInternal ? "Add an internal note..." : "Write your reply to the user..."}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isInternal ? "Add Note" : "Send Reply"}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* User info */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">User</p>
            <p className="text-sm font-medium text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground mt-1">{ticket.user.email}</p>
            {ticket.user.subscription && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {ticket.user.subscription.plan} - {ticket.user.subscription.status} - {ticket.user.subscription.provider || "No billing provider"}
              </p>
            )}
            <Link href={`/users/${ticket.user.id}`}>
              <button className="mt-3 text-xs text-primary hover:underline">View user profile →</button>
            </Link>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Move Support Context</p>
            <p className="text-xs text-muted-foreground">
              Manual guidance only. LocateFlow task completion updates local state and does not update external provider accounts.
            </p>
            {activeMove ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-border bg-background/70 p-3">
                  <p className="text-sm font-medium text-foreground">
                    {activeMove.fromAddress?.state || "?"} to {activeMove.toAddress?.state || "?"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeMove.status} - Move date {new Date(activeMove.moveDate).toLocaleDateString()}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-500">
                      Open tasks: {openMoveTasks.length}
                    </span>
                    {lowConfidenceTasks.length > 0 && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-500">
                        Low confidence: {lowConfidenceTasks.length}
                      </span>
                    )}
                  </div>
                </div>
                {(activeMove.moveTasks || []).slice(0, 4).map((task) => (
                  <div key={task.id} className="rounded-lg border border-border bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-xs font-medium text-foreground">{task.title}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${taskStatusClass(task.status)}`}>
                        {formatLabel(task.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatLabel(task.actionType)} - {task.provider?.name || task.customProvider?.name || task.destinationProvider?.name || "No provider selected"} - {formatLabel(task.confidence)} confidence
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No moving plan context is available for this user.</p>
            )}
            {(ticket.user.customProviders || []).length > 0 && (
              <div className="mt-3 rounded-lg border border-border bg-background/70 p-3">
                <p className="text-xs font-medium text-foreground">User-created providers</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {(ticket.user.customProviders || []).length} private provider record(s), not global catalog data or source verified.
                </p>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ticket Details</p>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={ticket.status}
                onChange={(e) => handleUpdate("status", e.target.value)}
                disabled={updating}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <select
                value={ticket.priority}
                onChange={(e) => handleUpdate("priority", e.target.value)}
                disabled={updating}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none"
              >
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <p className="text-xs text-muted-foreground">Assignment</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {!ticket.assignedTo
                  ? "Unassigned"
                  : ticket.assignedTo === currentAdminId
                    ? "Assigned to you"
                    : getAdminLabel(ticket.assignedAdmin) || "Assigned to another admin"}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleUpdate("assignedTo", currentAdminId)}
                  disabled={updating || !currentAdminId || ticket.assignedTo === currentAdminId}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-50"
                >
                  Assign to me
                </button>
                <button
                  onClick={() => handleUpdate("assignedTo", null)}
                  disabled={updating || !ticket.assignedTo}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
                >
                  Unassign
                </button>
              </div>
            </div>
            <div className={`rounded-lg border p-3 ${
              ticket.sla?.breached
                ? "border-red-500/30 bg-red-500/5"
                : "border-border bg-background/50"
            }`}>
              <p className="text-xs text-muted-foreground">Response Target</p>
              <p className={`mt-1 text-sm font-medium ${ticket.sla?.breached ? "text-red-400" : "text-foreground"}`}>
                {getSlaLabel(ticket.sla)}
              </p>
              {ticket.sla && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Derived {ticket.sla.targetHours}h target · Due {new Date(ticket.sla.dueAt).toLocaleString()}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Triage guidance only; no configured contractual SLA policy is active.
              </p>
            </div>
            <div className="text-xs text-muted-foreground pt-1 border-t border-border">
              <p>Created: {new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              <p className="mt-1">Updated: {new Date(ticket.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function taskStatusClass(status: string) {
  if (status === "COMPLETED") return "bg-green-500/10 text-green-500";
  if (status === "DISMISSED") return "bg-muted text-muted-foreground";
  if (status === "ACCEPTED" || status === "IN_PROGRESS") return "bg-blue-500/10 text-blue-500";
  if (status === "REOPENED") return "bg-purple-500/10 text-purple-500";
  return "bg-amber-500/10 text-amber-500";
}
