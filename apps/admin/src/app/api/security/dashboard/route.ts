import { NextRequest, NextResponse } from "next/server";
import { redactAuditPayload } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { maskEmail, maskIpAddress } from "@/lib/privacy";
import { getRecentSecurityEvents } from "@/lib/security-monitor";
import { getSecurityReadinessSnapshot } from "@/lib/security-readiness";

const SENSITIVE_OPERATION_ACTIONS = [
  "DELETE_USER",
  "GRANT_PREMIUM",
  "KEY_ROTATION_STARTED",
  "KEY_ROTATION_FAILED",
  "KEY_ROTATION_COMPLETED",
  "IMPORT_BACKUP",
  "IMPORT_BACKUP_FAILED",
  "CREATE_BACKUP",
  "IP_RULE_CREATED",
  "IP_RULE_FAILED",
  "IP_RULE_DELETED",
  "IP_RULE_TOGGLED",
  "GDPR_STATUS_UPDATED",
  "SECURITY_ACTION_FAILED",
  "SECURITY_SESSION_REVOKED",
  "ADD_IP_RULE",
  "DELETE_IP_RULE",
  "TOGGLE_IP_RULE",
  "UPDATE_GDPR",
  "KEY_ROTATION",
];

function safeJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return { parseError: true };
  }
}

function redactAdminEmail(email: string | null | undefined, unmasked: boolean) {
  return unmasked ? email || "Unknown" : maskEmail(email);
}

function redactIp(ip: string | null | undefined, unmasked: boolean) {
  return unmasked ? ip || null : maskIpAddress(ip);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("audit_logs", "canRead", { minimumRole: "ADMIN" });
    const unmasked = session.role === "SUPER_ADMIN";

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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
      getRecentSecurityEvents(100),
      prisma.adminAuditLog.findMany({
        where: { action: "LOGIN", createdAt: { gte: last7d } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { adminUserId: true, ipAddress: true, createdAt: true },
      }),
      prisma.adminAuditLog.count({
        where: {
          action: "LOGIN_FAILED",
          createdAt: { gte: last24h },
        },
      }),
      prisma.adminAuditLog.count({
        where: { createdAt: { gte: last7d } },
      }),
      prisma.adminAuditLog.findMany({
        where: {
          action: { in: SENSITIVE_OPERATION_ACTIONS },
          createdAt: { gte: last7d },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { adminUserId: true, action: true, entityType: true, entityId: true, createdAt: true, ipAddress: true },
      }),
      prisma.iPRule.findMany({
        where: { isActive: true },
        select: { type: true },
      }),
      prisma.rateLimitLog.count({
        where: { blocked: true, createdAt: { gte: last24h } },
      }).catch(() => 0),
      prisma.adminUser.findMany({
        where: { isActive: true },
        select: { id: true, email: true, role: true, lastLoginAt: true },
      }),
      prisma.gDPRRequest.findMany({
        where: { status: "PENDING" },
        select: { id: true, type: true, createdAt: true },
      }).catch(() => []),
      prisma.backupRecord.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, type: true, recordCount: true },
      }).catch(() => null),
      getSecurityReadinessSnapshot(),
    ]);

    const alertsBySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const alertsByType: Record<string, number> = {};
    for (const alert of securityAlerts) {
      const severity = alert.entityId as string;
      if (severity in alertsBySeverity) {
        alertsBySeverity[severity as keyof typeof alertsBySeverity]++;
      }
      const type = alert.entityType as string;
      alertsByType[type] = (alertsByType[type] || 0) + 1;
    }

    const loginIPMap: Record<string, Set<string>> = {};
    for (const login of recentLogins) {
      const adminId = login.adminUserId;
      if (!adminId) continue;
      if (!loginIPMap[adminId]) loginIPMap[adminId] = new Set();
      loginIPMap[adminId].add(login.ipAddress || "unknown");
    }
    const multiIPAdmins = Object.entries(loginIPMap)
      .filter(([, ips]) => ips.size > 3)
      .map(([adminId, ips]) => ({
        adminId,
        ipCount: ips.size,
        ips: unmasked ? [...ips] : undefined,
        ipSamples: unmasked ? undefined : [...ips].slice(0, 3).map((ip) => maskIpAddress(ip)),
      }));

    const staleAdmins = activeAdmins.filter(
      (a: any) => !a.lastLoginAt || new Date(a.lastLoginAt) < last30d,
    );

    const encryptionKeyConfigured = Boolean(process.env.FIELD_ENCRYPTION_KEY && process.env.FIELD_ENCRYPTION_KEY.length === 64);

    const responseBody = {
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
        recent: securityAlerts.slice(0, 20).map((a: any) => {
          const parsed = safeJson(a.changes) as any;
          return {
            type: a.entityType,
            severity: a.entityId,
            ip: redactIp(a.ipAddress, unmasked),
            details: unmasked ? redactAuditPayload(parsed?.details ?? null) : { redacted: true },
            time: a.createdAt,
          };
        }),
      },
      accessControl: {
        activeAdmins: activeAdmins.length,
        staleAdmins: staleAdmins.map((a: any) => ({
          id: a.id,
          email: redactAdminEmail(a.email, unmasked),
          role: a.role,
          lastLoginAt: a.lastLoginAt,
        })),
        multiIPAdmins,
        activeIPRules: {
          total: activeIPRules.length,
          blacklisted: activeIPRules.filter((r: any) => r.type === "BLACKLIST").length,
          whitelisted: activeIPRules.filter((r: any) => r.type === "WHITELIST").length,
        },
      },
      sensitiveOperations: sensitiveOps7d.map((op: any) => ({
        ...op,
        ipAddress: redactIp(op.ipAddress, unmasked),
      })),
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
    };

    await writeAdminAudit(session, {
      action: "SECURITY_DASHBOARD_VIEWED",
      entityType: "SecurityDashboard",
      entityId: "overview",
      metadata: {
        timeRange: { last24h: last24h.toISOString(), last7d: last7d.toISOString(), last30d: last30d.toISOString() },
        counts: {
          alerts: securityAlerts.length,
          sensitiveOperations: sensitiveOps7d.length,
          activeAdmins: activeAdmins.length,
          staleAdmins: staleAdmins.length,
          multiIPAdmins: multiIPAdmins.length,
        },
        rowCount: {
          alerts: responseBody.alerts.recent.length,
          sensitiveOperations: responseBody.sensitiveOperations.length,
        },
      },
      request: getAuditRequestMeta(request),
    });

    return NextResponse.json(responseBody);
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to generate security report" }, { status: 500 });
  }
}

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
