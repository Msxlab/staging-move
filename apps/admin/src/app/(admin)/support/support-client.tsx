"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Loader2, MessageSquare, ChevronRight, ChevronLeft,
  Inbox, Timer, Hourglass, AlertTriangle, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";
import { MinistatStrip } from "@/components/ministat-strip";

// Dot-indicator status pills: the swatch color is carried on a leading dot,
// the pill itself stays neutral (bg-muted) so the Move admin status column
// reads as one consistent column of chips rather than a rainbow of fills.
const statusDot: Record<string, string> = {
  OPEN: "bg-tone-sky-fg",
  IN_PROGRESS: "bg-tone-honey-fg",
  WAITING_USER: "bg-tone-orange-fg",
  RESOLVED: "bg-tone-emerald-fg",
  CLOSED: "bg-muted-foreground",
};

const priorityDot: Record<string, string> = {
  URGENT: "bg-destructive",
  HIGH: "bg-tone-orange-fg",
  MEDIUM: "bg-tone-honey-fg",
  LOW: "bg-muted-foreground",
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
        window.location.assign("/settings/two-factor?required=1");
        return;
      }
      toast.error(data?.error || "Failed to load support tickets");
      return;
    }
    setTickets(data.tickets || []);
    if (data.stats) setStats(data.stats);
    if (data.pagination) setPagination(data.pagination);
  }, [assignmentFilter, categoryFilter, page, priorityFilter, search, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchTickets().finally(() => setLoading(false));
  }, [fetchTickets]);

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        eyebrow="Inbox"
        title="Support <em>Tickets</em>"
        subtitle="Manage and respond to user support requests"
      />

      {/* Ministat strip — counts come straight from the /api/tickets stats
          payload. No avg-age card: the API does not return one, and the
          loaded page of tickets cannot honestly stand in for the queue. */}
      <MinistatStrip
        columns={5}
        items={[
          { key: "open", icon: Inbox, label: "Open", value: stats.open, tone: "cool" },
          { key: "in-progress", icon: Timer, label: "In progress", value: stats.inProgress, tone: "family" },
          { key: "waiting", icon: Hourglass, label: "Waiting user", value: stats.waitingUser, tone: "amber" },
          { key: "urgent", icon: AlertTriangle, label: "Urgent", value: stats.urgent, tone: "coral" },
          { key: "mine", icon: UserCheck, label: "My queue", value: stats.myTickets, tone: "mint" },
        ]}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap rounded-2xl border border-border bg-card p-4">
        <input
          type="text"
          placeholder="Search subject or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-56 rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s || "all"}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-accent hover:text-foreground"}`}
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
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground"
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
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground"
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
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground"
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
            className="rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No tickets found"
          description="No support tickets match your current filters."
          className="rounded-2xl border border-dashed border-border"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
            Targets are derived from priority for triage only; no configured contractual SLA policy is active.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Subject</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Priority</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Assignment</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Target</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <p className="max-w-[220px] truncate font-medium text-foreground">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">{ticket.category} · <span className="font-mono">{ticket._count.messages}</span> messages</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{[ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(" ") || "—"}</p>
                      <p className="font-mono text-xs text-muted-foreground">{ticket.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot[ticket.status] || statusDot.OPEN}`} />
                        {ticket.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        <span className={`h-1.5 w-1.5 rounded-full ${priorityDot[ticket.priority] || priorityDot.MEDIUM}`} />
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
                      <span className={`inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                        ticket.sla?.breached ? "text-destructive" : "text-muted-foreground"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ticket.sla?.breached ? "bg-destructive" : "bg-muted-foreground"}`} />
                        {getSlaLabel(ticket.sla)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {new Date(ticket.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/support/${ticket.id}`}>
                        <button aria-label="View ticket" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-mono">{(pagination.page - 1) * pagination.limit + 1}</span>-
            <span className="font-mono">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-mono">{pagination.total}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={pagination.page <= 1}
              aria-label="Previous page"
              className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-xs text-muted-foreground">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
              disabled={pagination.page >= pagination.totalPages}
              aria-label="Next page"
              className="rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
