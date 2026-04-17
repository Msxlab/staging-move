import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { z } from "zod";

const createTicketSchema = z.object({
  subject: z.string().min(5).max(255),
  category: z.enum(["GENERAL", "BUG", "BILLING", "ACCOUNT", "FEATURE_REQUEST"]).default("GENERAL"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  message: z.string().min(10).max(5000),
  platform: z.enum(["WEB", "MOBILE"]).default("WEB"),
});

// GET /api/tickets — list user's tickets
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const where: any = { userId };
    if (status) where.status = status;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          messages: {
            where: { isInternal: false }, // Don't show admin internal notes to user
            orderBy: { createdAt: "desc" },
            take: 1, // Only last message for list view
            select: { content: true, senderType: true, createdAt: true },
          },
          _count: { select: { messages: { where: { isInternal: false } } } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return NextResponse.json({
      tickets,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Failed to fetch tickets:", error);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

// POST /api/tickets — create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    // Rate limit: 5 tickets per hour
    const rlKey = getRateLimitKey(request, "ticket:create");
    const rl = await rateLimit(rlKey, { limit: 5, windowSeconds: 3600 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many tickets. Please wait before creating another." }, { status: 429 });
    }

    const body = await request.json();
    const validated = createTicketSchema.parse(body);

    // Check open ticket limit (max 10 open tickets per user)
    const openCount = await prisma.supportTicket.count({
      where: { userId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_USER"] } },
    });
    if (openCount >= 10) {
      return NextResponse.json({
        error: "You have too many open tickets. Please wait for existing tickets to be resolved.",
      }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject: validated.subject,
        category: validated.category,
        priority: validated.priority,
        platform: validated.platform,
        status: "OPEN",
        messages: {
          create: {
            senderType: "USER",
            senderId: userId,
            content: validated.message,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to create ticket:", error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
