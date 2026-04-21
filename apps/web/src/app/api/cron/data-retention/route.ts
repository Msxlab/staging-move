import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { processPendingAccountDeletionRequests } from "@/lib/account-deletion";
import { verifyInternalAuth } from "@/lib/internal-secrets";

/**
 * Data retention cron endpoint.
 * Cleans up old session logs, events, rate limit logs, and email logs
 * to prevent unbounded table growth.
 *
 * Secured with CRON_SECRET header check.
 * Recommended schedule: daily at 3:00 AM UTC.
 */
export async function POST(request: NextRequest) {
  // Accept either the `Authorization: Bearer ...` header (preferred) or the
  // legacy `x-cron-secret` header for compatibility with older schedulers.
  const xCronSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const effective = authHeader || (xCronSecret ? `Bearer ${xCronSecret}` : null);
  if (!verifyInternalAuth(effective, "cron")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results: Record<string, number> = {};

  try {
    // Delete UserSession records older than 90 days
    const sessionCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deletedSessions = await prisma.userSession.deleteMany({
      where: { lastActivity: { lt: sessionCutoff } },
    });
    results.userSessions = deletedSessions.count;

    // Delete UserEvent records older than 90 days
    const eventCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deletedEvents = await prisma.userEvent.deleteMany({
      where: { createdAt: { lt: eventCutoff } },
    });
    results.userEvents = deletedEvents.count;

    // Delete RateLimitLog records older than 30 days
    const rateLimitCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const deletedRateLimits = await prisma.rateLimitLog.deleteMany({
      where: { createdAt: { lt: rateLimitCutoff } },
    });
    results.rateLimitLogs = deletedRateLimits.count;

    // Delete EmailLog records older than 180 days
    const emailCutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const deletedEmails = await prisma.emailLog.deleteMany({
      where: { sentAt: { lt: emailCutoff } },
    });
    results.emailLogs = deletedEmails.count;

    const deletionResults = await processPendingAccountDeletionRequests(25);
    results.accountDeletionRequestsProcessed = deletionResults.length;
    results.accountDeletionRequestsCompleted = deletionResults.filter((result) => result.status === "COMPLETED").length;

    logger.info("Data retention cleanup completed", {
      action: "DATA_RETENTION",
      ...results,
    });

    return NextResponse.json({ success: true, cleaned: results });
  } catch (error) {
    logger.error("Data retention cleanup failed", {
      action: "DATA_RETENTION",
      error: String(error),
    });
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
