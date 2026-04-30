/**
 * POST /api/blog/uploads
 *
 * Multipart upload for blog cover + inline images. The browser sends a
 * single `file` field; we mime-check, size-check, hand off to R2, and
 * return the object key. The editor stores the key (not the URL) in
 * the post draft — render time builds a signed imgproxy URL.
 *
 * Why server-side PUT (vs presigned URL handed to the browser):
 *   - We never expose the signing key.
 *   - Mime/size/RBAC live in one place.
 *   - Audit log row is guaranteed (browser can't drop it).
 * Cost is bandwidth — fine for blog images that cap at 5 MiB.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
  ALLOWED_BLOG_IMAGE_MIME,
  MAX_BLOG_IMAGE_BYTES,
  uploadBlogImage,
} from "@/lib/blog-uploads";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requirePermission("blog", "canCreate", { minimumRole: "MODERATOR" });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const mime = file.type.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_BLOG_IMAGE_MIME.has(mime)) {
    return NextResponse.json(
      { error: "Unsupported image type", allowed: [...ALLOWED_BLOG_IMAGE_MIME] },
      { status: 415 },
    );
  }
  if (file.size > MAX_BLOG_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "File too large", maxBytes: MAX_BLOG_IMAGE_BYTES },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = await uploadBlogImage({ body: buf, contentType: mime, adminId: session.adminId });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (
      msg.startsWith("UNSUPPORTED_MIME") ||
      msg.startsWith("UNSUPPORTED_BYTES") ||
      msg.startsWith("TOO_LARGE")
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }

  // Audit row so we can trace who uploaded which key, and reconcile
  // R2 contents against the DB later (orphan-image cleanup cron).
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.adminId,
      action: "BLOG_UPLOAD_IMAGE",
      entityType: "BlogPost",
      entityId: result.key, // we don't have a postId yet; key is unique
      changes: JSON.stringify({ key: result.key, bytes: result.bytes, mime: result.contentType }),
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    },
  });

  return NextResponse.json({
    key: result.key,
    bytes: result.bytes,
    contentType: result.contentType,
  });
}
