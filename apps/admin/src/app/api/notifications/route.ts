export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const SUPPORTED_ADMIN_SEND_CHANNELS = ["IN_APP"] as const;

export async function GET(req: NextRequest) {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const type = url.searchParams.get("type");
    const channel = url.searchParams.get("channel");

    const where: any = {};
    if (type) where.type = type;
    if (channel) where.channel = channel;

    const [notifications, total, queue, stats] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      prisma.notification.count({ where }),
      prisma.notificationQueue.findMany({
        where: { sent: false },
        orderBy: { sendAt: "asc" },
        take: 20,
      }),
      Promise.all([
        prisma.notification.count(),
        prisma.notification.count({ where: { read: false } }),
        prisma.notification.count({ where: { sent: true } }),
        prisma.notificationQueue.count({ where: { sent: false } }),
      ]),
    ]);

    return NextResponse.json({
      notifications,
      total,
      pages: Math.ceil(total / limit),
      queue,
      capabilities: {
        supportedSendChannels: SUPPORTED_ADMIN_SEND_CHANNELS,
        schedulingEnabled: false,
        workerEnabled: false,
        note:
          "Admin-created notifications are delivered immediately as in-app records only. Email, push, and delayed delivery require a dedicated worker/provider path.",
      },
      stats: {
        total: stats[0],
        unread: stats[1],
        sent: stats[2],
        queued: stats[3],
      },
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canCreate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const body = await req.json();
    const { type, title, body: msgBody, href, channel = "IN_APP", userId, broadcast, sendAt } = body;

    if (!title || !msgBody) {
      return NextResponse.json({ error: "Title and body required" }, { status: 400 });
    }

    if (!SUPPORTED_ADMIN_SEND_CHANNELS.includes(channel)) {
      return NextResponse.json(
        {
          error:
            "This admin send path only supports immediate in-app notifications. Email and push delivery are disabled until a real worker/provider path is enabled.",
        },
        { status: 400 },
      );
    }

    const requestedSendAt = sendAt ? new Date(sendAt) : null;
    if (requestedSendAt && Number.isNaN(requestedSendAt.getTime())) {
      return NextResponse.json({ error: "Invalid sendAt value" }, { status: 400 });
    }
    if (requestedSendAt && requestedSendAt.getTime() > Date.now() + 5000) {
      return NextResponse.json(
        {
          error:
            "Scheduled notification delivery is not enabled yet. Send immediately for now.",
        },
        { status: 400 },
      );
    }
    const deliveredAt = new Date();

    if (broadcast) {
      const users = await prisma.user.findMany({ select: { id: true } });
      const notifications = users.map((u: { id: string }) => ({
        userId: u.id,
        type: type || "SYSTEM",
        title,
        body: msgBody,
        href: href || null,
        channel,
        sent: true,
        sentAt: deliveredAt,
        sendAt: deliveredAt,
      }));

      await prisma.notification.createMany({ data: notifications });

      await prisma.notificationQueue.create({
        data: {
          broadcast: true,
          type: type || "SYSTEM",
          title,
          body: msgBody,
          href,
          channel,
          sendAt: deliveredAt,
          sent: true,
          sentAt: deliveredAt,
          createdBy: session.adminId,
        },
      });

      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "SEND_NOTIFICATION",
          entityType: "Notification",
          entityId: "broadcast",
          changes: JSON.stringify({
            broadcast: true,
            channel,
            type: type || "SYSTEM",
            count: users.length,
          }),
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        },
      });

      return NextResponse.json({ success: true, count: users.length });
    }

    if (!userId) {
      return NextResponse.json({ error: "userId or broadcast required" }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: type || "SYSTEM",
        title,
        body: msgBody,
        href,
        channel,
        sent: true,
        sentAt: deliveredAt,
        sendAt: deliveredAt,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "SEND_NOTIFICATION",
        entityType: "Notification",
        entityId: notification.id,
        changes: JSON.stringify({
          broadcast: false,
          userId,
          channel,
          type: type || "SYSTEM",
        }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json(notification);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
