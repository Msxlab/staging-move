"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Plus, ChevronRight, Clock, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const statusBadge: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  WAITING_USER: { label: "Waiting for you", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  CLOSED: { label: "Closed", cls: "bg-foreground/5 text-muted-foreground border-border" },
};

const categoryLabels: Record<string, string> = {
  GENERAL: "General",
  BUG: "Bug Report",
  BILLING: "Billing",
  ACCOUNT: "Account",
  FEATURE_REQUEST: "Feature Request",
};

interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: { content: string; senderType: string; createdAt: string }[];
  _count: { messages: number };
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "GENERAL", priority: "MEDIUM", message: "" });

  const fetchTickets = useCallback(async () => {
    const res = await fetch("/api/tickets");
    if (res.ok) {
      const data = await res.json();
      setTickets(data.tickets || []);
    }
  }, []);

  useEffect(() => {
    fetchTickets().finally(() => setLoading(false));
  }, [fetchTickets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.message.length < 10) { toast.error("Message must be at least 10 characters."); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Ticket created successfully.");
        setShowCreate(false);
        setForm({ subject: "", category: "GENERAL", priority: "MEDIUM", message: "" });
        await fetchTickets();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to create ticket.");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage your support tickets</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition"
        >
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

      {/* Create ticket form */}
      {showCreate && (
        <div className="rounded-2xl border border-border bg-foreground/[0.03] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">New Support Ticket</h2>
            <button onClick={() => setShowCreate(false)} className="text-foreground/40 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Subject</label>
              <input
                className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50"
                placeholder="Brief description of your issue"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                minLength={5}
                maxLength={255}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Category</label>
                <select
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-orange-500/50"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Priority</label>
                <select
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-orange-500/50"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Message</label>
              <textarea
                className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50 resize-none"
                placeholder="Describe your issue in detail..."
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                minLength={10}
                maxLength={5000}
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit Ticket
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-border text-muted-foreground text-sm hover:text-foreground transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ticket list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/30" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-border bg-foreground/[0.02] p-12 text-center">
          <MessageCircle className="h-10 w-10 text-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No support tickets yet</p>
          <p className="text-foreground/30 text-xs mt-1">Create a ticket if you need help with anything</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const badge = statusBadge[ticket.status] || statusBadge.OPEN;
            const lastMsg = ticket.messages[0];
            return (
              <Link key={ticket.id} href={`/support/${ticket.id}`}>
                <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.04] p-4 transition flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] text-foreground/35">{categoryLabels[ticket.category] || ticket.category}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                    {lastMsg && (
                      <p className="text-xs text-foreground/40 mt-0.5 truncate">
                        {lastMsg.senderType === "ADMIN" ? "Support: " : "You: "}{lastMsg.content}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] text-foreground/30">{ticket._count.messages} msg{ticket._count.messages !== 1 ? "s" : ""}</p>
                      <p className="text-[10px] text-foreground/30 mt-0.5">
                        {new Date(ticket.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-foreground/30" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
