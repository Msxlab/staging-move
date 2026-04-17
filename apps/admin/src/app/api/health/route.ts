import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latencyMs?: number;
  details?: string;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN" });

    const checks: HealthCheck[] = [];

    // ── Database Health ─────────────────────────────────────
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;
      checks.push({
        name: "Database",
        status: dbLatency > 500 ? "degraded" : "healthy",
        latencyMs: dbLatency,
        details: dbLatency > 500 ? "High latency" : "Connected",
      });
    } catch (err: any) {
      checks.push({ name: "Database", status: "down", latencyMs: Date.now() - dbStart, details: err.message?.slice(0, 100) });
    }

    // ── Redis (Upstash) ─────────────────────────────────────
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (redisUrl && redisToken && !redisUrl.includes("REPLACE")) {
      const redisStart = Date.now();
      try {
        const res = await fetch(`${redisUrl}/ping`, {
          headers: { Authorization: `Bearer ${redisToken}` },
          signal: AbortSignal.timeout(5000),
        });
        const redisLatency = Date.now() - redisStart;
        const data = await res.json();
        checks.push({
          name: "Redis (Upstash)",
          status: data.result === "PONG" ? (redisLatency > 300 ? "degraded" : "healthy") : "degraded",
          latencyMs: redisLatency,
          details: data.result === "PONG" ? "Connected" : "Unexpected response",
        });
      } catch (err: any) {
        checks.push({ name: "Redis (Upstash)", status: "down", latencyMs: Date.now() - redisStart, details: err.message?.slice(0, 100) });
      }
    } else {
      checks.push({ name: "Redis (Upstash)", status: "unknown", details: "Not configured" });
    }

    // ── Auth (JWT secret) ───────────────────────────────────
    const jwtSecret = process.env.ADMIN_JWT_SECRET || process.env.USER_JWT_SECRET;
    if (jwtSecret && !jwtSecret.includes("REPLACE") && jwtSecret.length >= 32) {
      checks.push({ name: "Auth (JWT)", status: "healthy", details: "Secret configured" });
    } else {
      checks.push({ name: "Auth (JWT)", status: "degraded", details: jwtSecret ? "Secret too short" : "Not configured" });
    }

    // ── Email (Resend) ──────────────────────────────────────
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && !resendKey.includes("REPLACE")) {
      checks.push({ name: "Email (Resend)", status: "healthy", details: "API key configured" });
    } else {
      checks.push({ name: "Email (Resend)", status: "unknown", details: "Not configured" });
    }

    // ── S3 Backup Storage ───────────────────────────────────
    const s3Bucket = process.env.BACKUP_STORAGE_BUCKET;
    if (s3Bucket && !s3Bucket.includes("REPLACE")) {
      checks.push({ name: "Backup Storage (S3)", status: "healthy", details: `Bucket: ${s3Bucket}` });
    } else {
      checks.push({ name: "Backup Storage (S3)", status: "unknown", details: "Not configured" });
    }

    // ── Sentry ──────────────────────────────────────────────
    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (sentryDsn && !sentryDsn.includes("REPLACE")) {
      checks.push({ name: "Error Tracking (Sentry)", status: "healthy", details: "DSN configured" });
    } else {
      checks.push({ name: "Error Tracking (Sentry)", status: "unknown", details: "Not configured" });
    }

    // ── Slack Webhook ───────────────────────────────────────
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl && !slackUrl.includes("REPLACE")) {
      checks.push({ name: "Slack Alerts", status: "healthy", details: "Webhook configured" });
    } else {
      checks.push({ name: "Slack Alerts", status: "unknown", details: "Not configured" });
    }

    // ── System Metrics ──────────────────────────────────────
    const [
      totalUsers, totalSessions, totalEvents, totalAdminLogs,
      totalBackups, activeAdminSessions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userSession.count(),
      prisma.userEvent.count(),
      prisma.adminAuditLog.count(),
      prisma.backupRecord?.count().catch(() => 0) || 0,
      prisma.adminSession?.count({ where: { isActive: true } }).catch(() => 0) || 0,
    ]);

    // Last backup
    let lastBackup = null;
    try {
      const backup = await prisma.backupRecord.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, type: true, fileSize: true },
      });
      lastBackup = backup;
    } catch {}

    const overall = checks.some((c) => c.status === "down")
      ? "down"
      : checks.some((c) => c.status === "degraded")
        ? "degraded"
        : "healthy";

    return NextResponse.json({
      overall,
      checks,
      metrics: {
        totalUsers,
        totalSessions,
        totalEvents,
        totalAdminLogs,
        totalBackups,
        activeAdminSessions,
        lastBackup,
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: "1.0.0",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Health check error:", error);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
