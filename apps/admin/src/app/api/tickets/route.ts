import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

function buildSla(ticket: { priority: string; status: string; createdAt: Date }) {
  const hoursByPriority: Record<string, number> = {
    URGENT: 4,
    HIGH: 24,
    MEDIUM: 72,
    LOW: 120,
  };
  const targetHours = hoursByPriority[ticket.priority] || 72;
  const dueAt = new Date(ticket.createdAt.getTime() + targetHours * 60 * 60 * 1000);
  const terminal = ticket.status === "RESOLVED" || ticket.status === "CLOSED";
  const now = Date.now();
  return {
    targetHours,
    dueAt,
    breached: !terminal && dueAt.getTime() < now,
    remainingHours: terminal
      ? null
      : Math.ceil((dueAt.getTime() - now) / (60 * 60 * 1000)),
    policy: "derived_default",
    note: "Derived operational target based on priority; not a configured contractual SLA.",
  };
}

type TicketOpsSummary = {
  assignedTo: string | null;
  priority: string;
  status: string;
  createdAt: Date;
};

type AssignedAdminSummary = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

// GET /api/tickets — list all tickets (admin view with filters)
export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("tickets", "canRead", { minimumRole: "ADMIN" });
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const assignedTo = searchParams.get("assignedTo");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (assignedTo === "me") where.assignedTo = session.adminId;
    else if (assignedTo === "unassigned") where.assignedTo = null;
    else if (assignedTo) where.assignedTo = assignedTo;
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { user: { email: { contains: search } } },
      ];
    }

    // Priority is a VarChar, so ordering by `priority: "desc"` sorts it
    // ALPHABETICALLY (URGENT > MEDIUM > LOW > HIGH) — burying HIGH below LOW in
    // the triage queue. Order by an explicit severity rank instead. Prisma's
    // `orderBy` can't express a custom value order, so resolve the correctly
    // ordered page of IDs from a lightweight (id/priority/updatedAt) scan, then
    // hydrate only that page with its relations.
    const PRIORITY_RANK: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const ordering = await prisma.supportTicket.findMany({
      where,
      select: { id: true, priority: true, updatedAt: true },
    });
    ordering.sort((a, b) => {
      const byRank = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
      if (byRank !== 0) return byRank;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    const total = ordering.length;
    const pageIds = ordering.slice((page - 1) * limit, (page - 1) * limit + limit).map((t) => t.id);

    const [pageTickets, stats] = await Promise.all([
      pageIds.length
        ? prisma.supportTicket.findMany({
            where: { id: { in: pageIds } },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
              messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { content: true, senderType: true, createdAt: true },
              },
              _count: { select: { messages: true } },
            },
          })
        : Promise.resolve([] as any[]),
      // Quick stats
      Promise.all([
        prisma.supportTicket.count({ where: { status: "OPEN" } }),
        prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
        prisma.supportTicket.count({ where: { status: "WAITING_USER" } }),
        prisma.supportTicket.count({ where: { priority: "URGENT", status: { not: "CLOSED" } } }),
        prisma.supportTicket.count({ where: { assignedTo: session.adminId, status: { notIn: ["CLOSED", "RESOLVED"] } } }),
      ]),
    ]);

    // `findMany({ id: { in } })` doesn't preserve order — re-apply the ranked page order.
    const ticketById = new Map(pageTickets.map((t: { id: string }) => [t.id, t]));
    const tickets = pageIds.map((id) => ticketById.get(id)).filter((t): t is any => Boolean(t));

    const assignedIds = Array.from(
      new Set(
        tickets
          .map((ticket: { assignedTo: string | null }) => ticket.assignedTo)
          .filter((id: string | null): id is string => Boolean(id)),
      ),
    );
    const assignedAdmins = assignedIds.length
      ? await prisma.adminUser.findMany({
          where: { id: { in: assignedIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const assignedAdminMap = new Map<string, AssignedAdminSummary>(
      assignedAdmins.map((admin: AssignedAdminSummary) => [admin.id, admin]),
    );

    return NextResponse.json({
      tickets: tickets.map((ticket: TicketOpsSummary) => ({
        ...ticket,
        assignedAdmin: ticket.assignedTo ? assignedAdminMap.get(ticket.assignedTo) || null : null,
        sla: buildSla(ticket),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: {
        open: stats[0],
        inProgress: stats[1],
        waitingUser: stats[2],
        urgent: stats[3],
        myTickets: stats[4],
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to fetch tickets:", error);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}
