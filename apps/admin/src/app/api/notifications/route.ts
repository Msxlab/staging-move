export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { parsePaginationParams } from "@/lib/pagination";
import { writeAdminAudit, getAuditRequestMeta } from "@/lib/audit";
import { dispatchEmailBatch, dispatchPushBatch } from "@/lib/notify-dispatch";
import { sanitizeNotificationHref } from "@/lib/notification-href";

const SUPPORTED_ADMIN_SEND_CHANNELS = ["IN_APP", "EMAIL", "PUSH"] as const;
type SupportedChannel = (typeof SUPPORTED_ADMIN_SEND_CHANNELS)[number];

// Notification types the admin send path is allowed to emit. Free-string
// types previously let an admin store arbitrary `type` values which the
// rest of the app then can't filter against. Lock to the canonical list.
// MARKETING / PROMO are gated by per-user opt-out inside notify-dispatch;
// the operational types bypass opt-out.
const ADMIN_SENDABLE_TYPES = [
  "SYSTEM",
  "ANNOUNCEMENT",
  "MAINTENANCE",
  "BILLING",
  "SUPPORT",
  "MARKETING",
  "PROMO",
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
const BROADCAST_DEDUPE_WINDOW_MS = 30_000;
const BROADCAST_DEDUPE_SOURCE = "admin-notification";

const notificationCreateSchema = z
  .object({
    type: z.enum(ADMIN_SENDABLE_TYPES).optional(),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2_000),
    // href is rendered as `<Link href>` in the consumer feed, so it must be an
    // in-app relative path or a same-origin https URL — never javascript:/data:
    // (stored XSS) or an off-origin URL (open redirect). Validated + normalized
    // server-side; fail closed on anything else.
    href: z
      .string()
      .trim()
      .max(500)
      .refine((value) => sanitizeNotificationHref(value).ok, {
        message:
          "href must be an in-app path (e.g. /dashboard) or a same-origin https URL.",
      })
      .optional(),
    channel: z.enum(SUPPORTED_ADMIN_SEND_CHANNELS).optional(),
    userId: z.string().trim().min(1).max(60).optional(),
    broadcast: z.boolean().optional(),
    confirmPassword: z.string().max(256).optional(),
    sendAt: z
      .string()
      .datetime({ offset: true })
      .optional(),
  })
  .strict();

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as any).code === "P2002");
}

function broadcastDedupeClaimId(input: {
  type: string;
  title: string;
  body: string;
  channel: string;
}) {
  const bucket = Math.floor(Date.now() / BROADCAST_DEDUPE_WINDOW_MS);
  const hash = createHash("sha256")
    .update(JSON.stringify([input.type, input.title, input.body, input.channel]))
    .digest("hex")
    .slice(0, 40);
  return `admin-broadcast:${bucket}:${hash}`;
}

async function claimBroadcastDedupe(input: {
  type: string;
  title: string;
  body: string;
  channel: string;
}) {
  try {
    await prisma.processedWebhookEvent.create({
      data: {
        id: broadcastDedupeClaimId(input),
        source: BROADCAST_DEDUPE_SOURCE,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
}

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
          "Admin-created notifications are always written to the in-app feed. EMAIL additionally fans out via Resend; PUSH additionally fans out via Expo (requires NOTIFICATION_PUSH_ENABLED=true). MARKETING/PROMO respect per-user opt-out. Scheduled delivery is not yet implemented.",
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
    const { type, title, body: msgBody, broadcast, sendAt, userId, confirmPassword } = parsed.data;
    const channel: SupportedChannel = parsed.data.channel ?? "IN_APP";
    const resolvedType = type ?? "SYSTEM";

    // Re-run the href validator to obtain the normalized value actually stored
    // (already validated by the zod refine above, so this never fails here).
    const hrefResult = sanitizeNotificationHref(parsed.data.href);
    if (!hrefResult.ok) {
      return NextResponse.json({ error: "Invalid notification href" }, { status: 400 });
    }
    const href = hrefResult.value ?? undefined;

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
      // EMAIL/PUSH broadcasts are irreversible once they leave the
      // worker (mail delivered, push fan-out persisted on devices) so
      // they keep the step-up gate. IN_APP broadcasts only write feed
      // rows that the operator can soft-delete, and the password modal
      // for routine announcements was friction operators kept avoiding.
      const requiresStepUpForBroadcast = channel === "EMAIL" || channel === "PUSH";
      if (requiresStepUpForBroadcast) {
        const confirm = await requirePasswordConfirm(session, confirmPassword, {
          operation: "notification_broadcast",
        });
        if (!confirm.confirmed) {
          return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
        }
      }

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

      // Idempotency guard. The createMany below passes skipDuplicates, but
      // Notification has NO unique index so that flag is a no-op — a retried or
      // double-submitted broadcast would otherwise write the whole feed twice.
      // Reject an IDENTICAL broadcast (same type/title/body/channel) sent in the
      // last 30s; the NotificationQueue row written at the end is the ledger we
      // check. A short window won't block an intentional re-send minutes later.
      // (Pairs with the client's busy-disabled Send button for the truly
      // simultaneous double-click.)
      const recentDuplicateBroadcast = await prisma.notificationQueue.findFirst({
        where: {
          broadcast: true,
          type: resolvedType,
          title,
          body: msgBody,
          channel,
          sentAt: { gte: new Date(Date.now() - 30_000) },
        },
        select: { id: true },
      });
      if (recentDuplicateBroadcast) {
        return NextResponse.json(
          { error: "An identical broadcast was just sent — wait a moment before resending.", code: "DUPLICATE_BROADCAST" },
          { status: 409 },
        );
      }
      const claimed = await claimBroadcastDedupe({
        type: resolvedType,
        title,
        body: msgBody,
        channel,
      });
      if (!claimed) {
        return NextResponse.json(
          { error: "An identical broadcast is already being sent.", code: "DUPLICATE_BROADCAST" },
          { status: 409 },
        );
      }

      // Stream user IDs in batches and write one createMany per batch. The
      // in-app feed row is always written (channel=IN_APP) so the user sees the
      // message regardless of the chosen delivery channel; EMAIL and PUSH are
      // extra fan-out on top of the feed row.
      let cursor: string | undefined;
      let writtenCount = 0;
      let emailDelivered = 0;
      let emailSkipped = 0;
      let pushDelivered = 0;
      let pushSkipped = 0;
      for (;;) {
        const batch = await prisma.user.findMany({
          select: { id: true },
          orderBy: { id: "asc" },
          take: BROADCAST_BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (batch.length === 0) break;
        const userIds = batch.map((u: { id: string }) => u.id);
        const rows = userIds.map((uid: string) => ({
          userId: uid,
          type: resolvedType,
          title,
          body: msgBody,
          href: href || null,
          channel: "IN_APP",
          sent: true,
          sentAt: deliveredAt,
          sendAt: deliveredAt,
        }));
        const result = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
        writtenCount += result.count;

        if (channel === "EMAIL") {
          const r = await dispatchEmailBatch({ userIds, type: resolvedType, title, body: msgBody, href });
          emailDelivered += r.delivered;
          emailSkipped += r.skipped;
        } else if (channel === "PUSH") {
          const r = await dispatchPushBatch({ userIds, type: resolvedType, title, body: msgBody, href });
          pushDelivered += r.delivered;
          pushSkipped += r.skipped;
        }

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
          emailDelivered,
          emailSkipped,
          pushDelivered,
          pushSkipped,
        },
        request: getAuditRequestMeta(req),
      });

      return NextResponse.json({
        success: true,
        count: writtenCount,
        emailDelivered,
        emailSkipped,
        pushDelivered,
        pushSkipped,
      });
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
        channel: "IN_APP",
        sent: true,
        sentAt: deliveredAt,
        sendAt: deliveredAt,
      },
    });

    let emailDelivered = 0;
    let emailSkipped = 0;
    let pushDelivered = 0;
    let pushSkipped = 0;
    if (channel === "EMAIL") {
      const r = await dispatchEmailBatch({ userIds: [userId], type: resolvedType, title, body: msgBody, href });
      emailDelivered = r.delivered;
      emailSkipped = r.skipped;
    } else if (channel === "PUSH") {
      const r = await dispatchPushBatch({ userIds: [userId], type: resolvedType, title, body: msgBody, href });
      pushDelivered = r.delivered;
      pushSkipped = r.skipped;
    }

    await writeAdminAudit(session, {
      action: "SEND_NOTIFICATION",
      entityType: "Notification",
      entityId: notification.id,
      metadata: {
        broadcast: false,
        userId,
        channel,
        type: resolvedType,
        emailDelivered,
        emailSkipped,
        pushDelivered,
        pushSkipped,
      },
      request: getAuditRequestMeta(req),
    });

    return NextResponse.json({ ...notification, emailDelivered, emailSkipped, pushDelivered, pushSkipped });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
