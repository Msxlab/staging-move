import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
  sendSupportTicketReplyEmail,
  sendSupportTicketStatusEmail,
} from "@/lib/email";
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            subscription: {
              select: {
                plan: true,
                status: true,
                provider: true,
                platform: true,
                lastValidatedAt: true,
              },
            },
            movingPlans: {
              where: { deletedAt: null },
              select: {
                id: true,
                status: true,
                moveDate: true,
                fromAddress: { select: { city: true, state: true, zip: true } },
                toAddress: { select: { city: true, state: true, zip: true } },
                moveTasks: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    actionType: true,
                    status: true,
                    confidence: true,
                    title: true,
                    provider: { select: { id: true, name: true, scope: true } },
                    customProvider: { select: { id: true, name: true, providerType: true } },
                    destinationProvider: { select: { id: true, name: true, scope: true } },
                  },
                  orderBy: [{ status: "asc" }, { createdAt: "desc" }],
                  take: 8,
                },
              },
              orderBy: { moveDate: "desc" },
              take: 2,
            },
            services: {
              where: { deletedAt: null },
              select: {
                id: true,
                category: true,
                providerName: true,
                isActive: true,
                provider: { select: { id: true, name: true, scope: true } },
                customProvider: { select: { id: true, name: true, providerType: true, trustStatus: true } },
              },
              orderBy: { updatedAt: "desc" },
              take: 8,
            },
            customProviders: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                category: true,
                providerType: true,
                trustStatus: true,
                adminReviewStatus: true,
              },
              orderBy: { updatedAt: "desc" },
              take: 8,
            },
          },
        },
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
    const assignedAdmin = ticket.assignedTo
      ? await prisma.adminUser.findUnique({
          where: { id: ticket.assignedTo },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : null;

    return NextResponse.json({
      ticket: {
        ...ticket,
        assignedAdmin,
        sla: buildSla(ticket),
      },
    });
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

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { user: { select: { email: true, firstName: true, deletedAt: true } } },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = replySchema.parse(body);

    if (!validated.isInternal && (ticket.status === "RESOLVED" || ticket.status === "CLOSED")) {
      return NextResponse.json(
        { error: "Closed or resolved tickets only accept internal notes" },
        { status: 409 },
      );
    }

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

    if (!validated.isInternal && ticket.user?.email && !ticket.user.deletedAt) {
      await sendSupportTicketReplyEmail({
        userEmail: ticket.user.email,
        userName: ticket.user.firstName || "there",
        ticketId: ticket.id,
        ticketSubject: ticket.subject,
        replyPreview: validated.message,
      }).catch((err) => {
        console.error("[SUPPORT] ticket-reply email failed:", err);
      });
    }

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

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { user: { select: { email: true, firstName: true, deletedAt: true } } },
    });
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
    if (validated.assignedTo !== undefined) {
      if (typeof validated.assignedTo === "string") {
        const assignee = await prisma.adminUser.findFirst({
          where: { id: validated.assignedTo, isActive: true },
          select: { id: true },
        });
        if (!assignee) {
          return NextResponse.json({ error: "Assigned admin not found" }, { status: 400 });
        }
      }
      updateData.assignedTo = validated.assignedTo;
    }
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

    if (validated.status && validated.status !== ticket.status && ticket.user?.email && !ticket.user.deletedAt) {
      await sendSupportTicketStatusEmail({
        userEmail: ticket.user.email,
        userName: ticket.user.firstName || "there",
        ticketId: ticket.id,
        ticketSubject: ticket.subject,
        status: validated.status,
      }).catch((err) => {
        console.error("[SUPPORT] ticket-status email failed:", err);
      });
    }

    return NextResponse.json({ ticket: updated });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.name === "ZodError") return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    console.error("Failed to update ticket:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
