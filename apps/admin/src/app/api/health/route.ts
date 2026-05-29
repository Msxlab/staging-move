import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAdminRuntimeConfigValues } from "@/lib/runtime-config";
import { buildLimiterHealth, probeLimiterReachable } from "@/lib/rate-limit-health";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latencyMs?: number;
  details?: string;
}

function isProductionLikeRuntime() {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  return (
    process.env.NODE_ENV === "production" ||
    appEnv === "production" ||
    appEnv === "staging" ||
    appEnv === "preview" ||
    Boolean(process.env.DIGITALOCEAN_APP_ID)
  );
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN" });

    const runtimeValues = await getAdminRuntimeConfigValues([
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "ALERT_EMAIL_FROM",
      "ALERT_EMAIL_TO",
      "BACKUP_STORAGE_BUCKET",
      "BACKUP_STORAGE_PROVIDER",
      "NEXT_PUBLIC_SENTRY_DSN",
      "SLACK_WEBHOOK_URL",
    ]);

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
      checks.push({
        name: "Database",
        status: "down",
        latencyMs: Date.now() - dbStart,
        details: err.message?.slice(0, 100),
      });
    }

    // ── Redis (Upstash) ─────────────────────────────────────
    // Probe via the shared limiter-health helper so the URL/token never
    // appear in the response or log line. The probe scrubs error
    // messages of URLs/tokens before returning a `reason` code.
    const redisUrl = runtimeValues.UPSTASH_REDIS_REST_URL;
    const redisToken = runtimeValues.UPSTASH_REDIS_REST_TOKEN;
    const limiterProbe = await probeLimiterReachable({
      url: redisUrl,
      token: redisToken,
    });
    if (limiterProbe.reason === "NOT_CONFIGURED") {
      checks.push({
        name: "Redis (Upstash)",
        status: "unknown",
        details: "Not configured",
      });
    } else if (limiterProbe.ok) {
      const latency = limiterProbe.latencyMs ?? 0;
      checks.push({
        name: "Redis (Upstash)",
        status: latency > 300 ? "degraded" : "healthy",
        latencyMs: latency,
        details: "Connected",
      });
    } else {
      checks.push({
        name: "Redis (Upstash)",
        status: "down",
        latencyMs: limiterProbe.latencyMs ?? undefined,
        details: limiterProbe.reason ?? "Unreachable",
      });
    }
    const limiterHealth = buildLimiterHealth(
      { url: redisUrl, token: redisToken },
      limiterProbe.reason === "NOT_CONFIGURED" ? undefined : limiterProbe.ok,
      limiterProbe.reason === "NOT_CONFIGURED" ? null : limiterProbe.reason,
    );

    // ── Auth (JWT secret) ───────────────────────────────────
    const jwtSecret =
      process.env.ADMIN_JWT_SECRET || process.env.USER_JWT_SECRET;
    if (jwtSecret && !jwtSecret.includes("REPLACE") && jwtSecret.length >= 32) {
      checks.push({
        name: "Auth (JWT)",
        status: "healthy",
        details: "Secret configured",
      });
    } else {
      checks.push({
        name: "Auth (JWT)",
        status: "degraded",
        details: jwtSecret ? "Secret too short" : "Not configured",
      });
    }

    // ── Email (Resend) ──────────────────────────────────────
    const resendKey = runtimeValues.RESEND_API_KEY;
    const alertRecipients = runtimeValues.ALERT_EMAIL_TO;
    const alertFrom = runtimeValues.ALERT_EMAIL_FROM || runtimeValues.EMAIL_FROM;
    const validRecipients = Boolean(
      alertRecipients &&
        alertRecipients
          .split(",")
          .map((email) => email.trim())
          .every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    );
    const missingEmailConfig = [
      !resendKey || resendKey.includes("REPLACE") ? "RESEND_API_KEY" : null,
      !runtimeValues.EMAIL_FROM ? "EMAIL_FROM" : null,
      !alertFrom ? "ALERT_EMAIL_FROM or EMAIL_FROM" : null,
      !validRecipients ? "ALERT_EMAIL_TO" : null,
    ].filter(Boolean);
    if (missingEmailConfig.length === 0) {
      checks.push({
        name: "Email (Resend)",
        status: "healthy",
        details: "API key, senders, and alert recipients configured",
      });
    } else {
      checks.push({
        name: "Email (Resend)",
        status: isProductionLikeRuntime() ? "degraded" : "unknown",
        details: `Missing or invalid: ${missingEmailConfig.join(", ")}`,
      });
    }

    // ── S3-Compatible Backup Storage ────────────────────────
    const backupBucket = runtimeValues.BACKUP_STORAGE_BUCKET;
    const backupProvider =
      runtimeValues.BACKUP_STORAGE_PROVIDER || "S3-compatible";
    if (backupBucket && !backupBucket.includes("REPLACE")) {
      checks.push({
        name: "Backup Storage (S3-Compatible)",
        status: "healthy",
        details: `${backupProvider} bucket: ${backupBucket}`,
      });
    } else {
      checks.push({
        name: "Backup Storage (S3-Compatible)",
        status: "unknown",
        details: "Not configured",
      });
    }

    // ── Sentry ──────────────────────────────────────────────
    const sentryDsn = runtimeValues.NEXT_PUBLIC_SENTRY_DSN;
    if (sentryDsn && !sentryDsn.includes("REPLACE")) {
      checks.push({
        name: "Error Tracking (Sentry)",
        status: "healthy",
        details: "DSN configured",
      });
    } else {
      checks.push({
        name: "Error Tracking (Sentry)",
        status: "unknown",
        details: "Not configured",
      });
    }

    // ── Slack Webhook ───────────────────────────────────────
    const slackUrl = runtimeValues.SLACK_WEBHOOK_URL;
    if (slackUrl && !slackUrl.includes("REPLACE")) {
      checks.push({
        name: "Slack Alerts",
        status: "healthy",
        details: "Webhook configured",
      });
    } else {
      checks.push({
        name: "Slack Alerts",
        status: "unknown",
        details: "Not configured",
      });
    }

    // ── System Metrics ──────────────────────────────────────
    const [
      totalUsers,
      totalSessions,
      totalEvents,
      totalAdminLogs,
      totalBackups,
      activeAdminSessions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userSession.count(),
      prisma.userEvent.count(),
      prisma.adminAuditLog.count(),
      prisma.backupRecord.count().catch(() => 0),
      prisma.adminSession.count({ where: { isActive: true } }).catch(() => 0),
    ]);

    // Last successful backup. The admin backup schedule is wired through
    // docker/ofelia.ini in container deployments, so this runtime check is
    // the source-code proof that the scheduled endpoint has actually been
    // succeeding after deploy.
    let lastBackup = null;
    try {
      const backup = await prisma.backupRecord.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, completedAt: true, type: true, fileSize: true },
      });
      lastBackup = backup;
    } catch {}

    if (lastBackup?.completedAt || lastBackup?.createdAt) {
      const backupAt = lastBackup.completedAt || lastBackup.createdAt;
      const ageHours = (Date.now() - backupAt.getTime()) / (60 * 60 * 1000);
      checks.push({
        name: "Scheduled Backup",
        status: ageHours <= 24 ? "healthy" : "degraded",
        details: `Last successful backup: ${backupAt.toISOString()}`,
      });
    } else {
      checks.push({
        name: "Scheduled Backup",
        status: isProductionLikeRuntime() ? "degraded" : "unknown",
        details: "No successful backup record found",
      });
    }

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
      // Admin-only detailed view of the distributed limiter — safe to
      // surface here behind admin auth. URL/token never appear; reason
      // codes are scrubbed in `probeLimiterReachable`.
      limiter: limiterHealth,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: "1.0.0",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Health check error:", error);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
