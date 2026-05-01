export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { parsePaginationParams } from "@/lib/pagination";
import { writeAdminAudit, getAuditRequestMeta } from "@/lib/audit";

const SUPPORTED_ADMIN_SEND_CHANNELS = ["IN_APP"] as const;
type SupportedChannel = (typeof SUPPORTED_ADMIN_SEND_CHANNELS)[number];

// Notification types the admin send path is allowed to emit. Free-string
// types previously let an admin store arbitrary `type` values which the
// rest of the app then can't filter against. Lock to the canonical list.
const ADMIN_SENDABLE_TYPES = [
  "SYSTEM",
  "ANNOUNCEMENT",
  "MAINTENANCE",
  "BILLING",
  "SUPPORT",
] as const;

// Broadcast safety nets:
//   - BROADCAST_BATCH_SIZE keeps each createMany small enough to avoid
//     a long lock and an OOM if user count is large.
//   - BROADCAST_MAX_USERS rejects audiences over a known threshold;
//     above this size the operator should use a worker job (which does
//     not exist yet) rather than synchronously fanning out at request
//     time. P1-2 will additionally require step-up above this cap.
const BROADCAST_BATCH_SIZE = 5_000;
const BROADCAST_MAX_USERS = 100_000;

// sendAt tolerance: scheduled delivery is not implemented (see the
// `schedulingEnabled: false` capability advertised by GET). Until a
// worker exists, sendAt may only describe a moment within ±5s of now —
// past timestamps must surface as a validation error so an operator
// who typed "yesterday" doesn't silently get an immediate broadcast.
const SEND_AT_TOLERANCE_MS = 5_000;

const notificationCreateSchema = z
  .object({
    type: z.enum(ADMIN_SENDABLE_TYPES).optional(),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2_000),
    href: z.string().trim().max(500).optional(),
    channel: z.enum(SUPPORTED_ADMIN_SEND_CHANNELS).optional(),
    userId: z.string().trim().min(1).max(60).optional(),
    broadcast: z.boolean().optional(),
    sendAt: z
      .string()
      .datetime({ offset: true })
      .optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const url = new URL(req.url);
    const { page, perPage: limit, skip } = parsePaginationParams(url.searchParams, {
      perPageParam: "limit",
      defaultPerPage: 50,
    });
    const type = url.searchParams.get("type");
    const channel = url.searchParams.get("channel");

    const where: any = {};
    if (type) where.type = type;
    if (channel) where.channel = channel;

    const [notifications, total, queue, stats] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
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
    const raw = await req.json().catch(() => null);
    const parsed = notificationCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid notification payload", details: parsed.error.errors },
        { status: 400 },
      );
    }
    const { type, title, body: msgBody, href, broadcast, sendAt, userId } = parsed.data;
    const channel: SupportedChannel = parsed.data.channel ?? "IN_APP";
    const resolvedType = type ?? "SYSTEM";

    const now = Date.now();
    const requestedSendAt = sendAt ? new Date(sendAt) : null;
    if (requestedSendAt) {
      const ts = requestedSendAt.getTime();
      if (ts < now - SEND_AT_TOLERANCE_MS) {
        return NextResponse.json(
          { error: "sendAt must not be in the past." },
          { status: 400 },
        );
      }
      if (ts > now + SEND_AT_TOLERANCE_MS) {
        return NextResponse.json(
          {
            error:
              "Scheduled notification delivery is not enabled yet. Send immediately for now.",
          },
          { status: 400 },
        );
      }
    }
    const deliveredAt = new Date();

    if (broadcast) {
      // Hard cap on audience size — synchronous fan-out at request time
      // is not a substitute for a worker. Above the cap the operator
      // must use a dedicated batch job (not yet implemented). Step-up
      // requirement on broadcast comes in P1-2.
      const audienceSize = await prisma.user.count();
      if (audienceSize > BROADCAST_MAX_USERS) {
        return NextResponse.json(
          {
            error:
              `Broadcast audience of ${audienceSize} exceeds the synchronous cap of ${BROADCAST_MAX_USERS}. Use a worker job for audiences this large.`,
          },
          { status: 413 },
        );
      }

      // Stream user IDs in batches and write one createMany per batch
      // with skipDuplicates so a retried request doesn't double-send.
      let cursor: string | undefined;
      let writtenCount = 0;
      // Loop until we've drained the user table; cursor-based so memory
      // stays bounded even at the 100k cap.
      for (;;) {
        const batch = await prisma.user.findMany({
          select: { id: true },
          orderBy: { id: "asc" },
          take: BROADCAST_BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (batch.length === 0) break;
        const rows = batch.map((u: { id: string }) => ({
          userId: u.id,
          type: resolvedType,
          title,
          body: msgBody,
          href: href || null,
          channel,
          sent: true,
          sentAt: deliveredAt,
          sendAt: deliveredAt,
        }));
        const result = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
        writtenCount += result.count;
        cursor = batch[batch.length - 1].id;
        if (batch.length < BROADCAST_BATCH_SIZE) break;
      }

      await prisma.notificationQueue.create({
        data: {
          broadcast: true,
          type: resolvedType,
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

      await writeAdminAudit(session, {
        action: "SEND_NOTIFICATION",
        entityType: "Notification",
        entityId: "broadcast",
        metadata: {
          broadcast: true,
          channel,
          type: resolvedType,
          audience: audienceSize,
          written: writtenCount,
        },
        request: getAuditRequestMeta(req),
      });

      return NextResponse.json({ success: true, count: writtenCount });
    }

    if (!userId) {
      return NextResponse.json({ error: "userId or broadcast required" }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: resolvedType,
        title,
        body: msgBody,
        href,
        channel,
        sent: true,
        sentAt: deliveredAt,
        sendAt: deliveredAt,
      },
    });

    await writeAdminAudit(session, {
      action: "SEND_NOTIFICATION",
      entityType: "Notification",
      entityId: notification.id,
      metadata: {
        broadcast: false,
        userId,
        channel,
        type: resolvedType,
      },
      request: getAuditRequestMeta(req),
    });

    return NextResponse.json(notification);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
