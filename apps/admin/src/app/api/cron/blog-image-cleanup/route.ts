/**
 * Cron: prune R2 blog images that are no longer referenced by any post.
 *
 * Reasoning behind the approach: every upload writes an audit log row
 * with the full R2 object key in `changes.key` so we can iterate past
 * uploads in the database without listing R2 directly. For each
 * recently uploaded key older than 7 days, check whether any blog
 * post still references it (cover image OR inline `<img>` in
 * `contentHtml`); if not, delete the R2 object and log the removal.
 *
 * Bounded per tick (200 keys) so a long backlog doesn't stall.
 *
 * Why 7 days: editors commonly upload an image, abandon the draft,
 * come back the next day, and resume. A shorter grace would delete
 * images mid-edit; a longer grace lets cost build up unnecessarily.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyInternalAuth } from "@/lib/internal-secrets";
import {
  BLOG_DELETE_IMAGE_AUDIT_ACTION,
  BLOG_UPLOAD_IMAGE_AUDIT_ACTION,
  deleteBlogImage,
  getBlogImageAuditEntityId,
  getBlogImageKeyFromAuditRow,
} from "@/lib/blog-uploads";

const GRACE_DAYS = 7;
const SCAN_BATCH = 200;

function unauthorized(req: NextRequest): boolean {
  const xCronSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  const effective = authHeader || (xCronSecret ? `Bearer ${xCronSecret}` : null);
  return !verifyInternalAuth(effective, "cron");
}

export async function GET(req: NextRequest) {
  if (unauthorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return runCleanup();
}

export async function POST(req: NextRequest) {
  if (unauthorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return runCleanup();
}

async function runCleanup() {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);

  // Recent upload audit rows. We pick the oldest first so each tick
  // chips away at the backlog deterministically.
  const candidates = await prisma.adminAuditLog.findMany({
    where: {
      action: BLOG_UPLOAD_IMAGE_AUDIT_ACTION,
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, adminUserId: true, entityId: true, changes: true, createdAt: true },
    take: SCAN_BATCH,
  });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, deleted: 0 });
  }

  // Skip keys we've already deleted so we don't keep retrying R2 404s
  // on an in-flight backlog.
  const uploadsByKey = new Map<
    string,
    { adminUserId: string | null; auditEntityId: string }
  >();
  for (const row of candidates) {
    const key = getBlogImageKeyFromAuditRow(row);
    if (!key || uploadsByKey.has(key)) continue;
    uploadsByKey.set(key, {
      adminUserId: row.adminUserId,
      auditEntityId: row.entityId,
    });
  }
  const keys = Array.from(uploadsByKey.keys());
  if (keys.length === 0) {
    return NextResponse.json({ ok: true, scanned: candidates.length, deleted: 0 });
  }
  const auditEntityIds = Array.from(
    new Set([
      ...Array.from(uploadsByKey.values()).map((row) => row.auditEntityId),
      ...keys.map(getBlogImageAuditEntityId),
    ]),
  );
  const alreadyDeleted = await prisma.adminAuditLog.findMany({
    where: {
      action: { in: [BLOG_DELETE_IMAGE_AUDIT_ACTION, "BLOG_DELETE_ORPHAN_IMAGE"] },
      entityId: { in: auditEntityIds },
    },
    select: { entityId: true, changes: true },
  });
  const deletedEntityIds = new Set(alreadyDeleted.map((row) => row.entityId));
  const deletedKeys = new Set(
    alreadyDeleted
      .map((row) => getBlogImageKeyFromAuditRow(row))
      .filter((key): key is string => Boolean(key)),
  );
  const toCheck = keys.filter((key) => {
    const auditEntityId = getBlogImageAuditEntityId(key);
    return !deletedKeys.has(key) && !deletedEntityIds.has(auditEntityId);
  });

  // Find keys still referenced by a post — either as cover image or
  // inside the rendered HTML (admin uploads always store as
  // `/api/blog/image?key=<key>` so a substring check is safe).
  const referenced = new Set<string>();
  if (toCheck.length > 0) {
    const coverHits = await prisma.blogPost.findMany({
      where: { ogImageKey: { in: toCheck } },
      select: { ogImageKey: true },
    });
    for (const hit of coverHits) {
      if (hit.ogImageKey) referenced.add(hit.ogImageKey);
    }

    // Inline images: check if the key appears in any post's contentHtml.
    // We do this one key at a time so each query stays cheap; the
    // batch is capped at SCAN_BATCH so this is bounded.
    for (const key of toCheck) {
      if (referenced.has(key)) continue;
      const inline = await prisma.blogPost.findFirst({
        where: { contentHtml: { contains: key } },
        select: { id: true },
      });
      if (inline) referenced.add(key);
    }
  }

  let deleted = 0;
  let failed = 0;
  for (const key of toCheck) {
    if (referenced.has(key)) continue;
    let ok = false;
    try {
      ok = await deleteBlogImage(key);
    } catch {
      ok = false;
    }
    if (ok) {
      deleted += 1;
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: uploadsByKey.get(key)?.adminUserId ?? null,
          action: BLOG_DELETE_IMAGE_AUDIT_ACTION,
          entityType: "BlogImage",
          entityId: getBlogImageAuditEntityId(key),
          changes: JSON.stringify({ key, reason: "orphaned_after_grace_days", graceDays: GRACE_DAYS }),
          ipAddress: "cron",
        },
      }).catch(() => null);
    } else {
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    candidates: toCheck.length,
    referenced: referenced.size,
    deleted,
    failed,
  });
}
