/**
 * Cron: the scheduled-delivery worker.
 *
 * GAP this closes: NotificationQueue rows with a future `sendAt` and SCHEDULED
 * blog posts with a future `scheduledAt` were never acted on by any worker —
 * "true" scheduling silently did nothing until some unrelated action happened
 * to flip the row. This endpoint is the worker that drains both.
 *
 * What it processes each tick:
 *   1. DUE NotificationQueue rows (sent = false AND sendAt <= now): delivers
 *      each through the web app's real delivery path — IN_APP feed row via
 *      createInAppNotification, EMAIL/PUSH/SMS via sendNotification — then marks
 *      the row sent. Single-user and broadcast (userId = null) rows are both
 *      handled; a broadcast fans the IN_APP feed row + chosen channel out to
 *      every user in bounded sub-batches.
 *   2. DUE SCHEDULED blog posts (status = SCHEDULED AND scheduledAt <= now):
 *      flips them to PUBLISHED + publishedAt = now and revalidates the public
 *      surfaces, mirroring /api/cron/blog-publish.
 *
 * Double-send prevention (idempotent / safe to re-run and run concurrently):
 *   Each queue row is CLAIMED before any side effect via an atomic guarded
 *   updateMany — `where: { id, sent: false }, data: { sent: true, sentAt }`.
 *   Only the worker whose update returns count === 1 owns the row and performs
 *   delivery; a concurrent worker or an overlapping re-run gets count === 0 and
 *   skips it. Claiming BEFORE sending makes this at-most-once: a row is never
 *   delivered twice, even if delivery later fails (the failure is recorded in
 *   `error` and the row is left claimed rather than flipped back, which would
 *   reintroduce double-send risk). Blog posts use the same guarded-update claim
 *   (`where: { id, status: "SCHEDULED" }`).
 *
 * Bounded: caps NotificationQueue at QUEUE_BATCH rows and blog posts at
 * BLOG_BATCH per tick so a backlog can't stall the cron loop. Per-item
 * try/catch so one bad row never aborts the batch.
 *
 * Secured with the shared CRON_SECRET guard (same Bearer check as every other
 * /api/cron/* route). Recommended schedule: every ~10 minutes.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendNotification } from "@/lib/notifications";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { pingIndexNow } from "@/lib/blog/indexnow";

// Bounded batches per tick.
const QUEUE_BATCH = 200;
const BLOG_BATCH = 50;
// Sub-batch size when fanning a broadcast row out to every user, so a large
// audience neither loads every id at once nor holds a long transaction.
const BROADCAST_USER_PAGE = 2_000;

interface QueueRow {
  id: string;
  userId: string | null;
  broadcast: boolean;
  type: string;
  title: string;
  body: string;
  href: string | null;
  channel: string;
}

/**
 * Deliver one already-CLAIMED queue row through the real web delivery path.
 * The caller has already flipped sent=true/sentAt for this row, so this is the
 * post-claim side effect only. Returns true if at least one delivery succeeded
 * (purely for the summary counters — the claim is what guarantees no re-send).
 */
async function deliverClaimedRow(row: QueueRow): Promise<boolean> {
  const channel = (row.channel || "IN_APP").toUpperCase();

  // Resolve the audience. A broadcast row (userId null) targets every user; a
  // direct row targets exactly one. Page broadcasts so we never load the whole
  // user table into memory.
  if (row.broadcast || !row.userId) {
    let cursor: string | undefined;
    let anyDelivered = false;
    for (;;) {
      const users = await prisma.user.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
        take: BROADCAST_USER_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (users.length === 0) break;
      for (const u of users) {
        const ok = await deliverToUser(u.id, channel, row);
        anyDelivered = anyDelivered || ok;
      }
      cursor = users[users.length - 1].id;
      if (users.length < BROADCAST_USER_PAGE) break;
    }
    return anyDelivered;
  }

  return deliverToUser(row.userId, channel, row);
}

/**
 * Deliver a single queue row to one user on the requested channel. The in-app
 * feed row is always written (so the user sees the message regardless of the
 * delivery channel); EMAIL/PUSH/SMS are extra fan-out on top, exactly mirroring
 * the admin send path's "always write IN_APP, then fan out" contract.
 */
async function deliverToUser(userId: string, channel: string, row: QueueRow): Promise<boolean> {
  // Always write the in-app feed row. dedupeKey keyed off the queue row id so a
  // retried delivery of the same claimed row can never duplicate the feed entry.
  const inApp = await createInAppNotification({
    userId,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    dedupeKey: `queue:${row.id}:${userId}`,
    metadata: { kind: "scheduled-delivery", queueId: row.id, type: row.type },
  });

  if (channel === "EMAIL" || channel === "PUSH" || channel === "SMS") {
    const extra = await sendNotification({
      userId,
      type: channel,
      subject: row.title,
      body: row.body,
      dedupeKey: `queue:${row.id}:${userId}:${channel}`,
      metadata: { kind: "scheduled-delivery", queueId: row.id, type: row.type, href: row.href },
    });
    return inApp || extra;
  }

  return inApp;
}

async function processNotificationQueue(now: Date) {
  const due = await prisma.notificationQueue.findMany({
    where: { sent: false, sendAt: { lte: now } },
    orderBy: { sendAt: "asc" },
    take: QUEUE_BATCH,
    select: {
      id: true,
      userId: true,
      broadcast: true,
      type: true,
      title: true,
      body: true,
      href: true,
      channel: true,
    },
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let claimSkipped = 0;

  for (const row of due) {
    // ---- Atomic claim BEFORE any delivery ----
    // Only the worker whose update flips this exact row from unsent wins. A
    // concurrent worker / overlapping re-run sees count === 0 and skips, so a
    // row is delivered at most once. Claiming first (not after) is what makes
    // re-runs safe.
    const claim = await prisma.notificationQueue.updateMany({
      where: { id: row.id, sent: false },
      data: { sent: true, sentAt: new Date() },
    });
    if (claim.count === 0) {
      claimSkipped++;
      continue;
    }

    processed++;
    try {
      const ok = await deliverClaimedRow(row);
      if (ok) {
        sent++;
      } else {
        // Claimed but nothing actually went out (e.g. PUSH disabled, no email
        // on file). Not an error per se, but record it for visibility. The row
        // stays claimed — we never re-deliver, to preserve at-most-once.
        failed++;
        await prisma.notificationQueue
          .update({ where: { id: row.id }, data: { error: "No channel delivered" } })
          .catch(() => {});
      }
    } catch (error) {
      failed++;
      // Record the failure on the (already-claimed) row. Deliberately do NOT
      // reset sent=false: re-queuing would risk a double-send on partial
      // success. A genuinely-stuck row is visible via its `error` column.
      await prisma.notificationQueue
        .update({
          where: { id: row.id },
          data: { error: String(error).slice(0, 1000) },
        })
        .catch(() => {});
      logger.error("Scheduled notification delivery failed", {
        action: "SCHEDULED_DELIVERY",
        queueId: row.id,
        error: String(error),
      });
    }
  }

  return { processed, sent, failed, claimSkipped };
}

async function processScheduledBlogPosts(now: Date) {
  const due = await prisma.blogPost.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now }, deletedAt: null },
    orderBy: { scheduledAt: "asc" },
    take: BLOG_BATCH,
    select: { id: true, slug: true, locale: true },
  });

  let published = 0;
  let failed = 0;
  const publishedSlugs: { slug: string; locale: string }[] = [];

  for (const post of due) {
    try {
      // Atomic claim: only the worker that flips SCHEDULED→PUBLISHED owns this
      // post. A concurrent worker sees count === 0 and skips, so a post is
      // never published (and never index-pinged) twice.
      const claim = await prisma.blogPost.updateMany({
        where: { id: post.id, status: "SCHEDULED" },
        data: { status: "PUBLISHED", publishedAt: now, scheduledAt: null },
      });
      if (claim.count === 0) continue;
      published++;
      publishedSlugs.push({ slug: post.slug, locale: post.locale });
    } catch (error) {
      failed++;
      logger.error("Scheduled blog publish failed", {
        action: "SCHEDULED_DELIVERY",
        postId: post.id,
        error: String(error),
      });
    }
  }

  if (publishedSlugs.length > 0) {
    // Invalidate aggregation surfaces once, plus each new slug — mirrors
    // /api/cron/blog-publish.
    revalidatePath("/blog");
    revalidatePath("/sitemap.xml");
    revalidatePath("/llms.txt");
    revalidatePath("/blog/feed.xml");
    revalidatePath("/blog/atom.xml");
    revalidatePath("/");
    for (const p of publishedSlugs) {
      revalidatePath(`/blog/${p.slug}`);
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    if (appUrl) {
      void pingIndexNow([
        `${appUrl}/blog`,
        ...publishedSlugs.map(
          (p) => `${appUrl}/blog/${p.slug}${p.locale === "es" ? "?locale=es" : ""}`,
        ),
      ]);
    }
  }

  return { published, failed, slugs: publishedSlugs.map((p) => p.slug) };
}

async function handleCron(request: NextRequest) {
  const guard = await guardCronRequest(request, "scheduled-delivery");
  if (!guard.ok) return guard.response;

  const now = new Date();

  try {
    const notifications = await processNotificationQueue(now);
    const blog = await processScheduledBlogPosts(now);

    logger.info("Scheduled delivery worker completed", {
      action: "SCHEDULED_DELIVERY",
      ...notifications,
      blogPublished: blog.published,
      blogFailed: blog.failed,
    });

    return NextResponse.json({
      ok: true,
      notifications,
      blog,
    });
  } catch (error) {
    logger.error("Scheduled delivery worker failed", {
      action: "SCHEDULED_DELIVERY",
      error: String(error),
    });
    return NextResponse.json({ error: "Scheduled delivery failed" }, { status: 500 });
  }
}

// Cron may invoke via GET (Bearer CRON_SECRET); POST is kept for manual/system
// invocation. Both share one handler and the identical guard.
export async function GET(request: NextRequest) {
  return handleCron(request);
}
export async function POST(request: NextRequest) {
  return handleCron(request);
}
