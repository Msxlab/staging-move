"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Plus, ChevronRight, Clock, CheckCircle2, AlertCircle, Loader2, Mail, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LEGAL_CONTACTS, mailto } from "@/lib/legal-info";

const statusBadge: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br" },
  WAITING_USER: { label: "Waiting for you", cls: "bg-tone-orange-bg text-tone-orange-fg border-tone-orange-br" },
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
  const tHelp = useTranslations("help");
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
  const openCount = tickets.filter((ticket) => ticket.status !== "CLOSED").length;
  const waitingCount = tickets.filter((ticket) => ticket.status === "WAITING_USER").length;

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
              <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Support command</p>
              <h1 className="mt-1 text-2xl font-semibold text-foreground md:text-3xl">Support</h1>
              <p className="mt-1 text-sm text-muted-foreground">View and manage your support tickets</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Ticket
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            ["Total", tickets.length],
            ["Open", openCount],
            ["Waiting", waitingCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-background/55 p-3">
              <p className="text-lg font-semibold text-foreground">{value}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact cards — email + ticket, tonal icon tiles (Aurora Help) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href={mailto(LEGAL_CONTACTS.support)}
          className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-tone-sky-br"
        >
          <div className="h-10 w-10 rounded-xl bg-tone-sky-bg border border-tone-sky-br flex items-center justify-center mb-3">
            <Mail className="h-4 w-4 text-tone-sky-fg" />
          </div>
          <p className="text-sm font-semibold text-foreground">{tHelp("contactEmailTitle")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{LEGAL_CONTACTS.support}</p>
        </a>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-2xl border border-border bg-card/70 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-tone-orange-br"
        >
          <div className="h-10 w-10 rounded-xl bg-tone-orange-bg border border-tone-orange-br flex items-center justify-center mb-3">
            <MessageCircle className="h-4 w-4 text-tone-orange-fg" />
          </div>
          <p className="text-sm font-semibold text-foreground">{tHelp("contactTicketTitle")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{tHelp("contactTicketSubtitle")}</p>
        </button>
      </div>

      {/* Create ticket form */}
      {showCreate && (
        <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-xl">
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
                className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-tone-orange-br"
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
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-tone-orange-br"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Priority</label>
                <select
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-tone-orange-br"
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
                className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-tone-orange-br resize-none"
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
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
        <div className="rounded-3xl border border-border bg-card/70 p-12 text-center shadow-sm">
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
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card">
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
