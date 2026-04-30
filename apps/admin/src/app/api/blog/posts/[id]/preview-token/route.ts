/**
 * POST /api/blog/posts/[id]/preview-token
 *
 * Returns a short-lived signed token the editor uses to share a
 * preview link (`/blog/preview/<token>` on the public web app). The
 * token encodes the postId + adminId; the public route verifies and
 * renders the DRAFT/SCHEDULED post without exposing it via the
 * sitemap, RSS, or any public JSON.
 *
 * Why mint here, not on the public side: the admin owns the editing
 * session and the audit log, and the secret stays server-side either
 * way. Mint-and-link is also one round-trip from the editor.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const PREVIEW_TTL_SECONDS = 60 * 10; // 10 minutes
const AUDIENCE = "blog-preview";
const ISSUER = "locateflow-admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requirePermission("blog", "canRead", { minimumRole: "MODERATOR" });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { id } = await params;
  const post = await prisma.blogPost.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const token = await new SignJWT({ postId: post.id, adminId: session.adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${PREVIEW_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: session.adminId,
      action: "BLOG_PREVIEW_TOKEN",
      entityType: "BlogPost",
      entityId: post.id,
      changes: JSON.stringify({ ttlSeconds: PREVIEW_TTL_SECONDS }),
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    },
  });

  const webUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  return NextResponse.json({
    token,
    url: webUrl ? `${webUrl}/blog/preview/${token}` : `/blog/preview/${token}`,
    expiresInSeconds: PREVIEW_TTL_SECONDS,
  });
}
