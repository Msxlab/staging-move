"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2, MessageSquare, ChevronRight, AlertCircle } from "lucide-react";

const statusBadge: Record<string, string> = {
  OPEN: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  WAITING_USER: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  RESOLVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

const priorityBadge: Record<string, string> = {
  URGENT: "bg-red-500/10 text-red-500 border-red-500/20",
  HIGH: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  MEDIUM: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  LOW: "bg-muted text-muted-foreground border-border",
};

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  updatedAt: string;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string | null };
  messages: { content: string; senderType: string; createdAt: string }[];
  _count: { messages: number };
}

const STATUS_FILTERS = ["", "OPEN", "IN_PROGRESS", "WAITING_USER", "CLOSED"];

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState({ open: 0, inProgress: 0, waitingUser: 0, urgent: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchTickets = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    params.set("limit", "50");
    const res = await fetch(`/api/tickets?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setTickets(data.tickets || []);
      if (data.stats) setStats(data.stats);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    setLoading(true);
    fetchTickets().finally(() => setLoading(false));
  }, [fetchTickets]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage and respond to user support requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Open", value: stats.open, cls: "text-blue-500" },
          { label: "In Progress", value: stats.inProgress, cls: "text-amber-500" },
          { label: "Waiting User", value: stats.waitingUser, cls: "text-orange-500" },
          { label: "Urgent", value: stats.urgent, cls: "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search subject or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-56"
        />
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${statusFilter === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tickets found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground truncate max-w-[220px]">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">{ticket.category} · {ticket._count.messages} messages</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{[ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(" ") || "—"}</p>
                    <p className="text-xs text-muted-foreground">{ticket.user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusBadge[ticket.status] || statusBadge.OPEN}`}>
                      {ticket.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${priorityBadge[ticket.priority] || priorityBadge.MEDIUM}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(ticket.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/support/${ticket.id}`}>
                      <button className="p-1.5 rounded-lg hover:bg-accent transition">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
