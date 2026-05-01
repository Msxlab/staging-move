/**
 * Cron: prune blog telemetry past its retention window.
 *
 *   - BlogView rows older than 90 days
 *   - BlogRevision rows older than 90 days for posts that are not
 *     currently DRAFT (active drafts keep full history)
 *
 * Bounded deletion (10k rows per tick) keeps transactions short even
 * on a months-old database. Idempotent: a second run finds zero.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VIEW_RETENTION_DAYS = 90;
const REVISION_RETENTION_DAYS = 90;
const DELETE_BATCH_SIZE = 10_000;

function unauthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${expected}`) return false;
  return (req.headers.get("x-cron-secret") ?? "") !== expected;
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
  const viewCutoff = new Date(Date.now() - VIEW_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const revisionCutoff = new Date(Date.now() - REVISION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const [viewIds, revisionIds] = await Promise.all([
    prisma.blogView.findMany({
      where: { createdAt: { lt: viewCutoff } },
      select: { id: true },
      take: DELETE_BATCH_SIZE,
    }),
    prisma.blogRevision.findMany({
      where: {
        createdAt: { lt: revisionCutoff },
        post: { status: { not: "DRAFT" } },
      },
      select: { id: true },
      take: DELETE_BATCH_SIZE,
    }),
  ]);

  const [views, revisions] = await Promise.all([
    prisma.blogView.deleteMany({
      where: { id: { in: viewIds.map((v) => v.id) } },
    }),
    prisma.blogRevision.deleteMany({
      where: { id: { in: revisionIds.map((r) => r.id) } },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    viewsDeleted: views.count,
    revisionsDeleted: revisions.count,
  });
}
