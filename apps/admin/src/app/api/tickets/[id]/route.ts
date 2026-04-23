import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { z } from "zod";

const replySchema = z.object({
  message: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false), // Admin internal notes
});

const updateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedTo: z.string().max(30).nullable().optional(),
  category: z.enum(["GENERAL", "BUG", "BILLING", "ACCOUNT", "FEATURE_REQUEST"]).optional(),
});

// GET /api/tickets/:id — get ticket details (admin sees all messages including internal)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("tickets", "canRead", { minimumRole: "ADMIN" });
    const { id } = await params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            senderType: true,
            senderId: true,
            content: true,
            attachmentUrl: true,
            isInternal: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ticket });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to fetch ticket:", error);
    return NextResponse.json({ error: "Failed to fetch ticket" }, { status: 500 });
  }
}

// POST /api/tickets/:id — admin reply to a ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("tickets", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = replySchema.parse(body);

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderType: "ADMIN",
        senderId: session.adminId,
        content: validated.message,
        isInternal: validated.isInternal,
      },
    });

    // Auto-update status to WAITING_USER when admin replies (unless internal note)
    if (!validated.isInternal && ticket.status === "OPEN") {
      await prisma.supportTicket.update({
        where: { id },
        data: { status: "IN_PROGRESS", assignedTo: ticket.assignedTo || session.adminId },
      });
    } else if (!validated.isInternal) {
      await prisma.supportTicket.update({
        where: { id },
        data: { status: "WAITING_USER", updatedAt: new Date() },
      });
    }

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: validated.isInternal ? "TICKET_INTERNAL_NOTE" : "TICKET_REPLY",
        entityType: "SupportTicket",
        entityId: id,
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.name === "ZodError") return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    console.error("Failed to reply to ticket:", error);
    return NextResponse.json({ error: "Failed to reply" }, { status: 500 });
  }
}

// PATCH /api/tickets/:id — update ticket status/priority/assignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("tickets", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    const updateData: any = {};
    if (validated.status !== undefined) {
      updateData.status = validated.status;
      if (validated.status === "RESOLVED") updateData.resolvedAt = new Date();
      if (validated.status === "CLOSED") updateData.closedAt = new Date();
    }
    if (validated.priority !== undefined) updateData.priority = validated.priority;
    if (validated.assignedTo !== undefined) updateData.assignedTo = validated.assignedTo;
    if (validated.category !== undefined) updateData.category = validated.category;

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: updateData,
    });

    // Add system message for status changes
    if (validated.status) {
      await prisma.ticketMessage.create({
        data: {
          ticketId: id,
          senderType: "SYSTEM",
          senderId: session.adminId,
          content: `Ticket status changed to ${validated.status} by admin.`,
        },
      });
    }

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "TICKET_UPDATE",
        entityType: "SupportTicket",
        entityId: id,
        changes: JSON.stringify(validated),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ ticket: updated });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.name === "ZodError") return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    console.error("Failed to update ticket:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
