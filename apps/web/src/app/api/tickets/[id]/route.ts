import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";
import { z } from "zod";

const replySchema = z.object({
  message: z.string().min(1).max(5000),
});

// GET /api/tickets/:id — get ticket details with messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          where: { isInternal: false }, // Hide admin internal notes
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            senderType: true,
            senderId: true,
            content: true,
            attachmentUrl: true,
            createdAt: true,
          },
        },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!ticket || ticket.userId !== userId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to fetch ticket:", error);
    return NextResponse.json({ error: "Failed to fetch ticket" }, { status: 500 });
  }
}

// POST /api/tickets/:id — reply to a ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;

    // Rate limit: 20 replies per hour
    const rlKey = getRateLimitKey(request, "ticket:reply", { userId });
    const rl = await rateLimit(rlKey, { limit: 20, windowSeconds: 3600 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many replies. Please wait." }, { status: 429 });
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket || ticket.userId !== userId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "CLOSED") {
      return NextResponse.json({ error: "Cannot reply to a closed ticket. Please create a new one." }, { status: 400 });
    }

    const body = await request.json();
    const validated = replySchema.parse(body);

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderType: "USER",
        senderId: userId,
        content: validated.message,
      },
    });

    // Update ticket status if it was waiting for user
    if (ticket.status === "WAITING_USER") {
      await prisma.supportTicket.update({
        where: { id },
        data: { status: "IN_PROGRESS", updatedAt: new Date() },
      });
    } else {
      await prisma.supportTicket.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
    }

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "TICKET_REPLY", entityType: "SupportTicket", entityId: id, route: "/api/tickets/[id]" });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    console.error("Failed to reply to ticket:", error);
    return NextResponse.json({ error: "Failed to reply" }, { status: 500 });
  }
}

// PATCH /api/tickets/:id — close a ticket (user can close their own)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket || ticket.userId !== userId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "CLOSED") {
      return NextResponse.json({ error: "Ticket is already closed" }, { status: 400 });
    }

    await prisma.supportTicket.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    // Add system message
    await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderType: "SYSTEM",
        senderId: userId,
        content: "Ticket closed by user.",
      },
    });

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "TICKET_CLOSE", entityType: "SupportTicket", entityId: id, route: "/api/tickets/[id]" });

    return NextResponse.json({ success: true });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to close ticket:", error);
    return NextResponse.json({ error: "Failed to close ticket" }, { status: 500 });
  }
}
