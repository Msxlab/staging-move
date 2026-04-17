export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSecurityReadinessSnapshot } from "@/lib/security-readiness";

export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const [ipRules, rateLimitLogs, blockedRequests, gdprRequests, readiness] = await Promise.all([
      prisma.iPRule.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.rateLimitLog.findMany({ where: { blocked: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.rateLimitLog.count({ where: { blocked: true } }).catch(() => 0),
      prisma.gDPRRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      getSecurityReadinessSnapshot(),
    ]);

    const stats = {
      totalIPRules: ipRules.length,
      whitelisted: ipRules.filter((r: any) => r.type === "WHITELIST").length,
      blacklisted: ipRules.filter((r: any) => r.type === "BLACKLIST").length,
      blockedRequests,
      pendingGDPR: gdprRequests.filter((r: any) => r.status === "PENDING").length,
      totalGDPR: gdprRequests.length,
    };

    return NextResponse.json({ ipRules, rateLimitLogs, gdprRequests, stats, readiness });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, ...data } = await req.json();
    const session = action === "add_ip_rule"
      ? await requirePermission("settings", "canCreate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] })
      : action === "delete_ip_rule"
        ? await requirePermission("settings", "canDelete", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] })
        : await requirePermission("settings", "canUpdate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });

    if (action === "add_ip_rule") {
      if (!data.ipAddress || !data.type) return NextResponse.json({ error: "IP and type required" }, { status: 400 });
      const rule = await prisma.iPRule.create({
        data: { ipAddress: data.ipAddress, type: data.type, reason: data.reason, isActive: true, createdBy: session.adminId, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null },
      });
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "ADD_IP_RULE",
          entityType: "IPRule",
          entityId: rule.id,
          changes: JSON.stringify({ ipAddress: rule.ipAddress, type: rule.type, reason: rule.reason, expiresAt: rule.expiresAt }),
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        },
      });
      return NextResponse.json(rule);
    }

    if (action === "delete_ip_rule") {
      const existing = await prisma.iPRule.findUnique({ where: { id: data.id } });
      await prisma.iPRule.delete({ where: { id: data.id } });
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "DELETE_IP_RULE",
          entityType: "IPRule",
          entityId: data.id,
          changes: JSON.stringify({ ipAddress: existing?.ipAddress || null, type: existing?.type || null }),
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "toggle_ip_rule") {
      const rule = await prisma.iPRule.findUnique({ where: { id: data.id } });
      if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await prisma.iPRule.update({ where: { id: data.id }, data: { isActive: !rule.isActive } });
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "TOGGLE_IP_RULE",
          entityType: "IPRule",
          entityId: data.id,
          changes: JSON.stringify({ previous: rule.isActive, next: !rule.isActive, ipAddress: rule.ipAddress, type: rule.type }),
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "update_gdpr") {
      const existing = await prisma.gDPRRequest.findUnique({
        where: { id: data.id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (existing.type === "DELETE" && data.status === "COMPLETED") {
        return NextResponse.json({ error: "Delete requests are completed automatically after staged cleanuprisma." }, { status: 400 });
      }

      const updated = await prisma.gDPRRequest.update({
        where: { id: data.id },
        data: { status: data.status, completedAt: data.status === "COMPLETED" ? new Date() : undefined, resultUrl: data.resultUrl },
      });
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "UPDATE_GDPR",
          entityType: "GDPRRequest",
          entityId: data.id,
          changes: JSON.stringify({ status: updated.status, resultUrl: updated.resultUrl || null, type: updated.type }),
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
