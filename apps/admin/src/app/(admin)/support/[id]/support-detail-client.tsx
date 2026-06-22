"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Send, Lock, Settings } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const statusCls: Record<string, string> = {
  OPEN: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br",
  IN_PROGRESS: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
  WAITING_USER: "bg-tone-orange-bg text-tone-orange-fg border-tone-orange-br",
  RESOLVED: "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br",
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

export default function AdminTicketDetailClient() {
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!ticket) return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <p className="text-sm text-muted-foreground">Ticket not found.</p>
      <Link href="/support" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to support
      </Link>
    </div>
  );

  const userName = [ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(" ") || ticket.user.email || "Unknown";
  const activeMove = ticket.user.movingPlans?.[0] || null;
  const openMoveTasks = activeMove?.moveTasks?.filter((task) => !["COMPLETED", "DISMISSED"].includes(task.status)) || [];
  const lowConfidenceTasks = activeMove?.moveTasks?.filter((task) => ["LOW", "UNVERIFIED"].includes(task.confidence)) || [];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/support">
          <button aria-label="Back to support" className="mt-1 rounded-xl border border-border bg-card p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div className="min-w-0">
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Support ticket</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground md:text-[28px]">{ticket.subject}</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="font-mono">#{ticket.id.slice(-8)}</span>
            <span className="mx-1.5">·</span>{ticket.category}
            <span className="mx-1.5">·</span>{userName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread */}
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            {ticket.messages.map((msg) => {
              const isUser = msg.senderType === "USER";
              const isSystem = msg.senderType === "SYSTEM";
              return (
                <div key={msg.id} className={`p-5 ${msg.isInternal ? "bg-tone-honey-bg border-l-2 border-tone-honey-br" : ""}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold ${
                      isUser ? "bg-tone-sky-bg text-tone-sky-fg" :
                      isSystem ? "bg-muted text-muted-foreground" :
                      "bg-tone-emerald-bg text-tone-emerald-fg"
                    }`}>
                      {isUser ? "U" : isSystem ? <Settings className="h-3 w-3" aria-hidden="true" /> : "A"}
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {isUser ? userName : isSystem ? "System" : "Admin"}
                    </span>
                    {msg.isInternal && <span className="rounded-full bg-tone-honey-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-tone-honey-fg">Internal</span>}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{msg.content}</p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply form */}
          <form onSubmit={handleReply} className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Reply</p>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded" />
                Internal note (not visible to user)
              </label>
            </div>
            <textarea
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={4}
              placeholder={isInternal ? "Add an internal note..." : "Write your reply to the user..."}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">User</p>
            <p className="text-sm font-semibold text-foreground">{userName}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{ticket.user.email}</p>
            {ticket.user.subscription && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {ticket.user.subscription.plan} - {ticket.user.subscription.status} - {ticket.user.subscription.provider || "No billing provider"}
              </p>
            )}
            <Link href={`/users/${ticket.user.id}`}>
              <button className="mt-3 text-xs font-medium text-primary transition-colors hover:text-primary/80">View user profile →</button>
            </Link>
          </div>

          <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Move Support Context</p>
            <p className="text-xs text-muted-foreground">
              Manual guidance only. Move task completion updates LocateFlow local state and does not update external provider accounts.
            </p>
            {activeMove ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-border bg-background/70 p-3.5">
                  <p className="text-sm font-semibold text-foreground">
                    {activeMove.fromAddress?.state || "?"} to {activeMove.toAddress?.state || "?"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeMove.status} - Move date <span className="font-mono">{new Date(activeMove.moveDate).toLocaleDateString()}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-tone-sky-bg px-2 py-0.5 text-[10px] font-medium text-tone-sky-fg">
                      Open tasks: <span className="font-mono">{openMoveTasks.length}</span>
                    </span>
                    {lowConfidenceTasks.length > 0 && (
                      <span className="rounded-full bg-tone-honey-bg px-2 py-0.5 text-[10px] font-medium text-tone-honey-fg">
                        Low confidence: <span className="font-mono">{lowConfidenceTasks.length}</span>
                      </span>
                    )}
                  </div>
                </div>
                {(activeMove.moveTasks || []).slice(0, 4).map((task) => (
                  <div key={task.id} className="rounded-xl border border-border bg-background/70 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-xs font-semibold text-foreground">{task.title}</p>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${taskStatusClass(task.status)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
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
              <div className="mt-3 rounded-xl border border-border bg-background/70 p-3.5">
                <p className="text-xs font-semibold text-foreground">User-created providers</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {(ticket.user.customProviders || []).length} private provider record(s), not global catalog data or source verified.
                </p>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Ticket Details</p>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Status</label>
              <select
                value={ticket.status}
                onChange={(e) => handleUpdate("status", e.target.value)}
                disabled={updating}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Priority</label>
              <select
                value={ticket.priority}
                onChange={(e) => handleUpdate("priority", e.target.value)}
                disabled={updating}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="rounded-xl border border-border bg-background/50 p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Assignment</p>
              <p className="mt-1.5 text-sm font-semibold text-foreground">
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
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  Assign to me
                </button>
                <button
                  onClick={() => handleUpdate("assignedTo", null)}
                  disabled={updating || !ticket.assignedTo}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  Unassign
                </button>
              </div>
            </div>
            <div className={`rounded-xl border p-3.5 ${
              ticket.sla?.breached
                ? "border-destructive/30 bg-destructive/5"
                : "border-border bg-background/50"
            }`}>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Response Target</p>
              <p className={`mt-1.5 text-sm font-semibold ${ticket.sla?.breached ? "text-destructive" : "text-foreground"}`}>
                {getSlaLabel(ticket.sla)}
              </p>
              {ticket.sla && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Derived <span className="font-mono">{ticket.sla.targetHours}h</span> target · Due <span className="font-mono">{new Date(ticket.sla.dueAt).toLocaleString()}</span>
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Triage guidance only; no configured contractual SLA policy is active.
              </p>
            </div>
            <div className="border-t border-border pt-3 text-xs text-muted-foreground">
              <p>Created: <span className="font-mono">{new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></p>
              <p className="mt-1">Updated: <span className="font-mono">{new Date(ticket.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></p>
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
  if (status === "COMPLETED") return "bg-tone-sage-bg text-tone-sage-fg";
  if (status === "DISMISSED") return "bg-muted text-muted-foreground";
  if (status === "ACCEPTED" || status === "IN_PROGRESS") return "bg-tone-sky-bg text-tone-sky-fg";
  if (status === "REOPENED") return "bg-tone-foil-bg text-tone-foil-fg";
  return "bg-tone-honey-bg text-tone-honey-fg";
}
