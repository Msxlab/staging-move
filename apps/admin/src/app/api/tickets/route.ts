import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

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

    const [tickets, total, stats] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true, senderType: true, createdAt: true },
          },
          _count: { select: { messages: true } },
        },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
      // Quick stats
      Promise.all([
        prisma.supportTicket.count({ where: { status: "OPEN" } }),
        prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
        prisma.supportTicket.count({ where: { status: "WAITING_USER" } }),
        prisma.supportTicket.count({ where: { priority: "URGENT", status: { not: "CLOSED" } } }),
        prisma.supportTicket.count({ where: { assignedTo: session.adminId, status: { notIn: ["CLOSED", "RESOLVED"] } } }),
      ]),
    ]);

    return NextResponse.json({
      tickets,
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
