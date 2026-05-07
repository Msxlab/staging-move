"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

const statusBadge: Record<string, string> = {
  OPEN: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br",
  IN_PROGRESS: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
  WAITING_USER: "bg-tone-orange-bg text-tone-orange-fg border-tone-orange-br",
  RESOLVED: "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

const priorityBadge: Record<string, string> = {
  URGENT: "bg-destructive/10 text-destructive border-destructive/20",
  HIGH: "bg-tone-orange-bg text-tone-orange-fg border-tone-orange-br",
  MEDIUM: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
  LOW: "bg-muted text-muted-foreground border-border",
};

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  updatedAt: string;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string | null };
  assignedAdmin?: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
  sla?: { breached: boolean; remainingHours: number | null; dueAt: string; targetHours: number; policy?: string; note?: string };
  messages: { content: string; senderType: string; createdAt: string }[];
  _count: { messages: number };
}

const STATUS_FILTERS = ["", "OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"];
const CATEGORY_FILTERS = ["", "GENERAL", "BUG", "BILLING", "ACCOUNT", "FEATURE_REQUEST"];
const PRIORITY_FILTERS = ["", "LOW", "MEDIUM", "HIGH", "URGENT"];
const ASSIGNMENT_FILTERS = [
  { value: "", label: "All Assignments" },
  { value: "me", label: "Assigned To Me" },
  { value: "unassigned", label: "Unassigned" },
];

function getAdminLabel(admin?: Ticket["assignedAdmin"]) {
  if (!admin) return "Unassigned";
  return [admin.firstName, admin.lastName].filter(Boolean).join(" ") || admin.email || "Assigned";
}

function getSlaLabel(sla?: Ticket["sla"]) {
  if (!sla) return "No target";
  if (sla.remainingHours === null) return "Closed";
  if (sla.breached) return "Breached";
  if (sla.remainingHours <= 0) return "Due now";
  if (sla.remainingHours < 24) return `${sla.remainingHours}h left`;
  return `${Math.ceil(sla.remainingHours / 24)}d left`;
}

export default function AdminSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState({ open: 0, inProgress: 0, waitingUser: 0, urgent: 0, myTickets: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });

  const fetchTickets = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (assignmentFilter) params.set("assignedTo", assignmentFilter);
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", "25");
    const res = await fetch(`/api/tickets?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data?.mfaSetupRequired) {
        toast.error("MFA setup is required before support tickets can be loaded.");
        router.push("/settings/two-factor?required=1");
        return;
      }
      toast.error(data?.error || "Failed to load support tickets");
      return;
    }
    setTickets(data.tickets || []);
    if (data.stats) setStats(data.stats);
    if (data.pagination) setPagination(data.pagination);
  }, [assignmentFilter, categoryFilter, page, priorityFilter, router, search, statusFilter]);

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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Open", value: stats.open, cls: "text-tone-sky-fg" },
          { label: "In Progress", value: stats.inProgress, cls: "text-tone-honey-fg" },
          { label: "Waiting User", value: stats.waitingUser, cls: "text-tone-orange-fg" },
          { label: "Urgent", value: stats.urgent, cls: "text-destructive" },
          { label: "My Queue", value: stats.myTickets, cls: "text-tone-emerald-fg" },
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
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-56"
        />
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s || "all"}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${statusFilter === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
        >
          <option value="">All Categories</option>
          {CATEGORY_FILTERS.filter(Boolean).map((category) => (
            <option key={category} value={category}>
              {category.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
        >
          <option value="">All Priorities</option>
          {PRIORITY_FILTERS.filter(Boolean).map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        <select
          value={assignmentFilter}
          onChange={(e) => {
            setAssignmentFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
        >
          {ASSIGNMENT_FILTERS.map((assignment) => (
            <option key={assignment.value || "all"} value={assignment.value}>
              {assignment.label}
            </option>
          ))}
        </select>
        {(statusFilter || categoryFilter || priorityFilter || assignmentFilter || search) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setCategoryFilter("");
              setPriorityFilter("");
              setAssignmentFilter("");
              setSearch("");
              setPage(1);
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            Clear
          </button>
        )}
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
          <div className="border-b border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
            Targets are derived from priority for triage only; no configured contractual SLA policy is active.
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Assignment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Target</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground truncate max-w-[220px]">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">{ticket.category} Â· {ticket._count.messages} messages</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{[ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(" ") || "â€”"}</p>
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
                    {ticket.assignedTo === null
                      ? "Unassigned"
                      : assignmentFilter === "me"
                        ? "Me"
                        : getAdminLabel(ticket.assignedAdmin)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      ticket.sla?.breached
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {getSlaLabel(ticket.sla)}
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

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={pagination.page <= 1}
              className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
