/**
 * Cron: reconcile EmailLog rows stuck in PENDING.
 *
 * A row is written PENDING before the provider send and updated to SENT /
 * FAILED / SKIPPED afterward. If the process dies between those two steps
 * (deploy, OOM, crash) the row is orphaned at PENDING forever — the
 * admin email-health "pending" metric drifts up and the dedupe guard never
 * lets a retry through (a PENDING row is not FAILED/SKIPPED, so
 * sendLoggedEmail treats it as already-claimed).
 *
 * This sweep flips PENDING rows older than ~15 minutes to FAILED so they
 * (a) stop inflating the pending count and (b) become retry-eligible. The
 * cutoff is generous — a real in-flight send completes in seconds — so a
 * row that's still legitimately sending is never touched.
 *
 * Bounded (10k rows per tick) so a months-old backlog can't load/scan
 * everything at once. Idempotent: a second run within the window finds zero.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardCronRequest } from "@/lib/cron-guard";

const STUCK_PENDING_MINUTES = 15;
const RECONCILE_BATCH_SIZE = 10_000;

async function runReconcile() {
  const cutoff = new Date(Date.now() - STUCK_PENDING_MINUTES * 60 * 1000);

  // Cap the candidate set so one tick can't load an unbounded backlog. We
  // select ids first (bounded `take`) then updateMany over exactly those ids
  // — keeps the write transaction short and the scan paginated.
  const stuck = await prisma.emailLog.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true },
    take: RECONCILE_BATCH_SIZE,
    orderBy: { createdAt: "asc" },
  });

  if (stuck.length === 0) {
    return NextResponse.json({ ok: true, reconciled: 0 });
  }

  const failed = await prisma.emailLog.updateMany({
    where: { id: { in: stuck.map((row) => row.id) }, status: "PENDING" },
    data: {
      status: "FAILED",
      error: "Reconciled: stuck in PENDING (send never completed)",
    },
  });

  return NextResponse.json({ ok: true, reconciled: failed.count });
}

export async function GET(req: NextRequest) {
  const guard = await guardCronRequest(req, "email-reconcile");
  if (!guard.ok) return guard.response;
  return runReconcile();
}

export async function POST(req: NextRequest) {
  const guard = await guardCronRequest(req, "email-reconcile");
  if (!guard.ok) return guard.response;
  return runReconcile();
}
