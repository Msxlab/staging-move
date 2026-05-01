import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getRecentSecurityEvents } from "@/lib/security-monitor";
import { getSecurityReadinessSnapshot } from "@/lib/security-readiness";

// GET /api/security/dashboard — comprehensive security overview & anomaly report
export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Parallel data fetches ──────────────────────────────
    const [
      securityAlerts,
      recentLogins,
      failedLogins24h,
      totalAuditLogs7d,
      sensitiveOps7d,
      activeIPRules,
      blockedRequests24h,
      activeAdmins,
      recentGDPR,
      backupStats,
      readiness,
    ] = await Promise.all([
      // Security alerts from monitor
      getRecentSecurityEvents(100),

      // Recent successful logins (last 7 days)
      prisma.adminAuditLog.findMany({
        where: { action: "LOGIN", createdAt: { gte: last7d } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { adminUserId: true, ipAddress: true, createdAt: true },
      }),

      // Failed login count (from durable auth audit entries in last 24h)
      prisma.adminAuditLog.count({
        where: {
          action: "LOGIN_FAILED",
          createdAt: { gte: last24h },
        },
      }),

      // Total audit log entries in 7 days
      prisma.adminAuditLog.count({
        where: { createdAt: { gte: last7d } },
      }),

      // Sensitive operations in last 7 days
      prisma.adminAuditLog.findMany({
        where: {
          action: {
            in: [
              "DELETE_USER",
              "GRANT_PREMIUM",
              "KEY_ROTATION",
              "IMPORT_BACKUP",
              "IMPORT_BACKUP_FAILED",
              "CREATE_BACKUP",
              "ADD_IP_RULE",
              "DELETE_IP_RULE",
              "TOGGLE_IP_RULE",
              "UPDATE_GDPR",
            ],
          },
          createdAt: { gte: last7d },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { adminUserId: true, action: true, entityType: true, entityId: true, createdAt: true, ipAddress: true },
      }),

      // Active IP rules
      prisma.iPRule.findMany({
        where: { isActive: true },
        select: { ipAddress: true, type: true, reason: true, expiresAt: true, createdAt: true },
      }),

      // Blocked requests in last 24h
      prisma.rateLimitLog.count({
        where: { blocked: true, createdAt: { gte: last24h } },
      }).catch(() => 0),

      // Active admin users
      prisma.adminUser.findMany({
        where: { isActive: true },
        select: { id: true, email: true, role: true, lastLoginAt: true },
      }),

      // Recent GDPR requests
      prisma.gDPRRequest.findMany({
        where: { status: "PENDING" },
        select: { id: true, type: true, createdAt: true },
      }).catch(() => []),

      // Backup health
      prisma.backupRecord.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, type: true, recordCount: true },
      }).catch(() => null),

      getSecurityReadinessSnapshot(),
    ]);

    // ── Analyze alerts by severity ──────────────────────────
    const alertsBySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const alertsByType: Record<string, number> = {};
    for (const alert of securityAlerts) {
      const severity = alert.entityId as string; // We stored severity in entityId
      if (severity in alertsBySeverity) {
        alertsBySeverity[severity as keyof typeof alertsBySeverity]++;
      }
      const type = alert.entityType as string;
      alertsByType[type] = (alertsByType[type] || 0) + 1;
    }

    // ── Unique login IPs per admin (detect unusual patterns) ──
    // adminUserId is nullable because P0-2 changed the FK to onDelete:
    // SetNull so audit entries survive admin deletion. Skip the orphaned
    // rows here — there's no admin to attribute the IP set to.
    const loginIPMap: Record<string, Set<string>> = {};
    for (const login of recentLogins) {
      const adminId = login.adminUserId;
      if (!adminId) continue;
      if (!loginIPMap[adminId]) loginIPMap[adminId] = new Set();
      loginIPMap[adminId].add(login.ipAddress || "unknown");
    }
    const multiIPAdmins = Object.entries(loginIPMap)
      .filter(([, ips]) => ips.size > 3)
      .map(([adminId, ips]) => ({ adminId, ipCount: ips.size, ips: [...ips] }));

    // ── Admins not logged in for 30+ days (stale accounts) ──
    const staleAdmins = activeAdmins.filter(
      (a: any) => !a.lastLoginAt || new Date(a.lastLoginAt) < last30d
    );

    // ── Encryption health ──────────────────────────────────
    const encryptionKeyConfigured = Boolean(process.env.FIELD_ENCRYPTION_KEY && process.env.FIELD_ENCRYPTION_KEY.length === 64);

    // ── Build response ─────────────────────────────────────
    return NextResponse.json({
      generatedAt: now.toISOString(),

      overview: {
        totalSecurityAlerts: securityAlerts.length,
        criticalAlerts: alertsBySeverity.CRITICAL,
        highAlerts: alertsBySeverity.HIGH,
        failedLogins24h,
        blockedRequests24h,
        totalAuditLogs7d,
        pendingGDPR: recentGDPR.length,
      },

      alerts: {
        bySeverity: alertsBySeverity,
        byType: alertsByType,
        recent: securityAlerts.slice(0, 20).map((a: any) => ({
          type: a.entityType,
          severity: a.entityId,
          ip: a.ipAddress,
          details: a.changes ? JSON.parse(a.changes)?.details : null,
          time: a.createdAt,
        })),
      },

      accessControl: {
        activeAdmins: activeAdmins.length,
        staleAdmins: staleAdmins.map((a: any) => ({ id: a.id, email: a.email, role: a.role, lastLoginAt: a.lastLoginAt })),
        multiIPAdmins,
        activeIPRules: {
          total: activeIPRules.length,
          blacklisted: activeIPRules.filter((r: any) => r.type === "BLACKLIST").length,
          whitelisted: activeIPRules.filter((r: any) => r.type === "WHITELIST").length,
        },
      },

      sensitiveOperations: sensitiveOps7d,

      encryption: {
        keyConfigured: encryptionKeyConfigured,
        algorithm: "AES-256-GCM",
        encryptedTables: ["services (accountNumber, username, phone, email, notes)", "addresses (formattedAddress)"],
      },

      backup: {
        lastBackup: backupStats
          ? { date: backupStats.createdAt, type: backupStats.type, records: backupStats.recordCount }
          : null,
        backupConfigured: Boolean(backupStats),
      },

      readiness,

      recommendations: generateRecommendations({
        criticalAlerts: alertsBySeverity.CRITICAL,
        staleAdmins: staleAdmins.length,
        encryptionKeyConfigured,
        lastBackup: backupStats?.createdAt ?? null,
        multiIPAdmins: multiIPAdmins.length,
        pendingGDPR: recentGDPR.length,
        readinessMissing: readiness.summary.missing,
        readinessUnknown: readiness.summary.unknown,
        missingRequired: readiness.summary.missingRequired,
      }),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Security dashboard failed:", error);
    return NextResponse.json({ error: "Failed to generate security report" }, { status: 500 });
  }
}

// ── Recommendation engine ──────────────────────────────────

interface RecommendationInput {
  criticalAlerts: number;
  staleAdmins: number;
  encryptionKeyConfigured: boolean;
  lastBackup: Date | null;
  multiIPAdmins: number;
  pendingGDPR: number;
  readinessMissing: number;
  readinessUnknown: number;
  missingRequired: number;
}

function generateRecommendations(input: RecommendationInput): Array<{ severity: string; message: string }> {
  const recs: Array<{ severity: string; message: string }> = [];

  if (input.criticalAlerts > 0) {
    recs.push({ severity: "CRITICAL", message: `${input.criticalAlerts} critical security alert(s) detected. Review immediately.` });
  }

  if (!input.encryptionKeyConfigured) {
    recs.push({ severity: "HIGH", message: "FIELD_ENCRYPTION_KEY is not configured. Sensitive data is stored in plaintext." });
  }

  if (input.missingRequired > 0) {
    recs.push({ severity: "HIGH", message: `${input.missingRequired} required security readiness control(s) are not configured.` });
  }

  if (!input.lastBackup) {
    recs.push({ severity: "HIGH", message: "No completed backups found. Create a backup immediately." });
  } else {
    const daysSinceBackup = (Date.now() - new Date(input.lastBackup).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceBackup > 7) {
      recs.push({ severity: "MEDIUM", message: `Last backup was ${Math.round(daysSinceBackup)} days ago. Consider creating a fresh backup.` });
    }
  }

  if (input.staleAdmins > 0) {
    recs.push({ severity: "MEDIUM", message: `${input.staleAdmins} admin account(s) have not logged in for 30+ days. Consider deactivating.` });
  }

  if (input.multiIPAdmins > 0) {
    recs.push({ severity: "LOW", message: `${input.multiIPAdmins} admin(s) logged in from 4+ different IPs in 7 days. Verify legitimacy.` });
  }

  if (input.pendingGDPR > 0) {
    recs.push({ severity: "MEDIUM", message: `${input.pendingGDPR} pending GDPR request(s). Process within required timeframe.` });
  }

  if (input.readinessMissing > 0 && input.missingRequired === 0) {
    recs.push({ severity: "MEDIUM", message: `${input.readinessMissing} optional readiness control(s) are still missing.` });
  }

  if (input.readinessUnknown > 0) {
    recs.push({ severity: "LOW", message: `${input.readinessUnknown} readiness check(s) require infrastructure-side verification outside application code.` });
  }

  if (recs.length === 0) {
    recs.push({ severity: "INFO", message: "No security issues detected. System is healthy." });
  }

  return recs;
}
