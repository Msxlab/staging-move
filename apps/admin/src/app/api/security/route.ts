export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import {
  evaluateIPAccessForRules,
  parseIPRuleValue,
  validateIPRuleValue,
  type IPRuleLike,
} from "@/lib/ip-rules";
import { maskIpAddress } from "@/lib/privacy";
import { getSecurityReadinessSnapshot } from "@/lib/security-readiness";

const IP_RULE_TYPES = new Set(["WHITELIST", "BLACKLIST"]);
const GDPR_STATUSES = new Set(["PENDING", "PROCESSING", "COMPLETED", "REJECTED"]);

function asIPRuleLike(rule: {
  id?: string;
  ipAddress: string;
  type: string;
  isActive: boolean;
  expiresAt?: string | Date | null;
}): IPRuleLike {
  return {
    ipAddress: rule.ipAddress,
    type: rule.type === "WHITELIST" ? "WHITELIST" : "BLACKLIST",
    isActive: rule.isActive,
    expiresAt: rule.expiresAt ?? null,
  };
}

function safeEntityId(value: unknown, fallback = "security") {
  return (typeof value === "string" && value.trim() ? value.trim() : fallback).slice(0, 30);
}

function ipRuleSummary(rawValue: unknown) {
  const parsed = parseIPRuleValue(rawValue);
  if (!parsed) return { valid: false };
  const [base] = parsed.normalized.split("/");
  return {
    valid: true,
    version: parsed.version,
    isCidr: parsed.isCidr,
    prefixLength: parsed.prefixLength,
    isBroad: parsed.isBroad,
    ipSummary: parsed.isCidr ? `${maskIpAddress(base) || "[redacted]"}/${parsed.prefixLength}` : maskIpAddress(base),
  };
}

function hasWhitelistBreakGlass(session: { role?: string } | null, data: Record<string, unknown>) {
  return session?.role === "SUPER_ADMIN" && data.breakGlass === true;
}

async function writeSecurityAudit(
  session: { adminId: string; email?: string; role?: string },
  req: NextRequest,
  action: string,
  metadata: Record<string, unknown>,
  entityType = "Security",
  entityId: unknown = "security",
) {
  await writeAdminAudit(session as any, {
    action,
    entityType,
    entityId: safeEntityId(entityId),
    metadata,
    request: getAuditRequestMeta(req),
  });
}

function failureResponse(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json({ error, ...extra }, { status });
}

async function assertCurrentIpAllowedAfterChange(
  req: NextRequest,
  rules: IPRuleLike[],
): Promise<{ ok: true } | { ok: false; reasonCode: string }> {
  const meta = getAuditRequestMeta(req);
  const currentIp = meta.ipAddress;
  const hasActiveWhitelist = rules.some((rule) => rule.type === "WHITELIST" && rule.isActive);

  if (hasActiveWhitelist && (!currentIp || !parseIPRuleValue(currentIp))) {
    return { ok: false, reasonCode: "current_ip_unavailable_for_whitelist" };
  }

  if (!currentIp) return { ok: true };
  const access = evaluateIPAccessForRules(currentIp, rules);
  if (access.blocked) return { ok: false, reasonCode: "self_lockout_prevented" };
  return { ok: true };
}

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
  let session: any = null;
  try {
    const { action, ...data } = await req.json();
    session = action === "add_ip_rule"
      ? await requirePermission("settings", "canCreate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] })
        : action === "delete_ip_rule"
          ? await requirePermission("settings", "canDelete", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] })
          : await requirePermission("settings", "canUpdate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });

    if (["add_ip_rule", "delete_ip_rule", "toggle_ip_rule", "update_gdpr"].includes(action)) {
      const requestMeta = getAuditRequestMeta(req);
      const confirm = await requirePasswordConfirm(session, data.confirmPassword, {
        operation: "security_rule_mutation",
        requireMfa: true,
        mfaCode: typeof data.mfaCode === "string" ? data.mfaCode : undefined,
        backupCode: typeof data.backupCode === "string" ? data.backupCode : undefined,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
      if (!confirm.confirmed) {
        await writeSecurityAudit(session, req, "SECURITY_ACTION_FAILED", {
          operation: action,
          status: "failed",
          reasonCode: confirm.requiresMfa ? "mfa_required_or_invalid" : "step_up_failed",
          requiresMfa: Boolean(confirm.requiresMfa),
        });
        return failureResponse(403, confirm.error || "Password and MFA confirmation required", {
          requiresPassword: true,
          requiresMfa: confirm.requiresMfa || undefined,
        });
      }
    }

    if (action === "add_ip_rule") {
      if (!data.ipAddress || !data.type) {
        await writeSecurityAudit(session, req, "IP_RULE_FAILED", {
          operation: "create",
          status: "failed",
          reasonCode: "missing_required_fields",
        });
        return failureResponse(400, "IP and type required");
      }
      if (!IP_RULE_TYPES.has(data.type)) {
        await writeSecurityAudit(session, req, "IP_RULE_FAILED", {
          operation: "create",
          status: "failed",
          reasonCode: "invalid_rule_type",
        });
        return failureResponse(400, "Invalid IP rule type");
      }
      if (data.type === "WHITELIST" && !hasWhitelistBreakGlass(session, data)) {
        await writeSecurityAudit(session, req, "IP_RULE_FAILED", {
          operation: "create",
          status: "failed",
          reasonCode: "whitelist_requires_super_admin_break_glass",
          ruleType: data.type,
          rule: ipRuleSummary(data.ipAddress),
        });
        return failureResponse(403, "Active whitelist changes require SUPER_ADMIN break-glass confirmation", {
          reasonCode: "whitelist_requires_super_admin_break_glass",
        });
      }
      const allowBroad = Boolean(data.breakGlass) && session.role === "SUPER_ADMIN";
      const validation = validateIPRuleValue(data.ipAddress, { allowBroad });
      if (!validation.ok) {
        await writeSecurityAudit(session, req, "IP_RULE_FAILED", {
          operation: "create",
          status: "failed",
          reasonCode: validation.reasonCode,
          ruleType: data.type,
          rule: ipRuleSummary(data.ipAddress),
        });
        return failureResponse(400, validation.reasonCode);
      }

      const existingRulesRaw = await prisma.iPRule.findMany({
        select: { id: true, ipAddress: true, type: true, isActive: true, expiresAt: true },
      });
      const existingRules = existingRulesRaw.map(asIPRuleLike);
      const candidateRules = [
        ...existingRules,
        {
          ipAddress: validation.value.normalized,
          type: data.type === "WHITELIST" ? "WHITELIST" as const : "BLACKLIST" as const,
          isActive: true,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        },
      ];
      const lockout = await assertCurrentIpAllowedAfterChange(req, candidateRules);
      if (!lockout.ok) {
        await writeSecurityAudit(session, req, "IP_RULE_FAILED", {
          operation: "create",
          status: "failed",
          reasonCode: lockout.reasonCode,
          ruleType: data.type,
          rule: ipRuleSummary(validation.value.normalized),
        });
        return failureResponse(409, "IP rule would block the current request IP", { reasonCode: lockout.reasonCode });
      }

      const rule = await prisma.iPRule.create({
        data: {
          ipAddress: validation.value.normalized,
          type: data.type,
          reason: typeof data.reason === "string" ? data.reason.slice(0, 500) : null,
          isActive: true,
          createdBy: session.adminId,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        },
      });
      await writeSecurityAudit(session, req, "IP_RULE_CREATED", {
        operation: "create",
        status: "success",
        ruleType: rule.type,
        rule: ipRuleSummary(rule.ipAddress),
        reasonLength: typeof rule.reason === "string" ? rule.reason.length : 0,
        expiresAt: rule.expiresAt,
        breakGlass: allowBroad,
      }, "IPRule", rule.id);
      return NextResponse.json(rule);
    }

    if (action === "delete_ip_rule") {
      if (typeof data.id !== "string") {
        await writeSecurityAudit(session, req, "IP_RULE_FAILED", {
          operation: "delete",
          status: "failed",
          reasonCode: "missing_rule_id",
        });
        return failureResponse(400, "Rule id required");
      }
      const existing = await prisma.iPRule.findUnique({ where: { id: data.id } });
      if (!existing) return failureResponse(404, "Not found");
      await prisma.iPRule.delete({ where: { id: data.id } });
      await writeSecurityAudit(session, req, "IP_RULE_DELETED", {
        operation: "delete",
        status: "success",
        ruleType: existing.type,
        rule: ipRuleSummary(existing.ipAddress),
      }, "IPRule", data.id);
      return NextResponse.json({ success: true });
    }

    if (action === "toggle_ip_rule") {
      if (typeof data.id !== "string") {
        await writeSecurityAudit(session, req, "IP_RULE_FAILED", {
          operation: "toggle",
          status: "failed",
          reasonCode: "missing_rule_id",
        });
        return failureResponse(400, "Rule id required");
      }
      const rulesRaw = await prisma.iPRule.findMany({
        select: { id: true, ipAddress: true, type: true, isActive: true, expiresAt: true },
      });
      const rule = rulesRaw.find((item) => item.id === data.id);
      if (!rule) return failureResponse(404, "Not found");
      const allowBroad = Boolean(data.breakGlass) && session.role === "SUPER_ADMIN";
      if (rule.type === "WHITELIST" && !rule.isActive && !hasWhitelistBreakGlass(session, data)) {
        await writeSecurityAudit(session, req, "IP_RULE_FAILED", {
          operation: "toggle",
          status: "failed",
          reasonCode: "whitelist_requires_super_admin_break_glass",
          ruleType: rule.type,
          rule: ipRuleSummary(rule.ipAddress),
        }, "IPRule", data.id);
        return failureResponse(403, "Enabling a whitelist requires SUPER_ADMIN break-glass confirmation", {
          reasonCode: "whitelist_requires_super_admin_break_glass",
        });
      }
      const validation = validateIPRuleValue(rule.ipAddress, { allowBroad: rule.isActive || allowBroad });
      if (!validation.ok) {
        await writeSecurityAudit(session, req, "IP_RULE_FAILED", {
          operation: "toggle",
          status: "failed",
          reasonCode: validation.reasonCode,
          ruleType: rule.type,
          rule: ipRuleSummary(rule.ipAddress),
        }, "IPRule", data.id);
        return failureResponse(400, validation.reasonCode);
      }
      const nextRules = rulesRaw.map((item) =>
        asIPRuleLike(item.id === data.id ? { ...item, isActive: !item.isActive } : item)
      );
      const lockout = await assertCurrentIpAllowedAfterChange(req, nextRules);
      if (!lockout.ok) {
        await writeSecurityAudit(session, req, "IP_RULE_FAILED", {
          operation: "toggle",
          status: "failed",
          reasonCode: lockout.reasonCode,
          ruleType: rule.type,
          rule: ipRuleSummary(rule.ipAddress),
        }, "IPRule", data.id);
        return failureResponse(409, "IP rule change would block the current request IP", { reasonCode: lockout.reasonCode });
      }

      await prisma.iPRule.update({ where: { id: data.id }, data: { isActive: !rule.isActive } });
      await writeSecurityAudit(session, req, "IP_RULE_TOGGLED", {
        operation: "toggle",
        status: "success",
        previousActive: rule.isActive,
        nextActive: !rule.isActive,
        ruleType: rule.type,
        rule: ipRuleSummary(rule.ipAddress),
      }, "IPRule", data.id);
      return NextResponse.json({ success: true });
    }

    if (action === "update_gdpr") {
      if (typeof data.id !== "string" || typeof data.status !== "string" || !GDPR_STATUSES.has(data.status)) {
        await writeSecurityAudit(session, req, "SECURITY_ACTION_FAILED", {
          operation: "update_gdpr",
          status: "failed",
          reasonCode: "invalid_gdpr_status",
          targetId: typeof data.id === "string" ? data.id : null,
        }, "GDPRRequest", typeof data.id === "string" ? data.id : "gdpr");
        return failureResponse(400, "Invalid GDPR status");
      }
      const existing = await prisma.gDPRRequest.findUnique({
        where: { id: data.id },
      });
      if (!existing) {
        return failureResponse(404, "Not found");
      }
      if (existing.type === "DELETE" && data.status === "COMPLETED") {
        await writeSecurityAudit(session, req, "SECURITY_ACTION_FAILED", {
          operation: "update_gdpr",
          status: "failed",
          reasonCode: "delete_request_auto_completion_required",
          targetId: data.id,
        }, "GDPRRequest", data.id);
        return failureResponse(400, "Delete requests are completed automatically after staged cleanup.");
      }

      const updated = await prisma.gDPRRequest.update({
        where: { id: data.id },
        data: {
          status: data.status,
          completedAt: data.status === "COMPLETED" ? new Date() : undefined,
          resultUrl: typeof data.resultUrl === "string" ? data.resultUrl.slice(0, 500) : undefined,
        },
      });
      await writeSecurityAudit(session, req, "GDPR_STATUS_UPDATED", {
        operation: "update_gdpr",
        status: "success",
        previousStatus: existing.status,
        nextStatus: updated.status,
        requestType: updated.type,
        resultUrlPresent: Boolean(updated.resultUrl),
      }, "GDPRRequest", data.id);
      return NextResponse.json({ success: true });
    }

    await writeSecurityAudit(session, req, "SECURITY_ACTION_FAILED", {
      operation: typeof action === "string" ? action : "unknown",
      status: "failed",
      reasonCode: "invalid_action",
    });
    return failureResponse(400, "Invalid action");
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (session) {
      await writeSecurityAudit(session, req, "SECURITY_ACTION_FAILED", {
        operation: "security_mutation",
        status: "failed",
        reasonCode: "unexpected_exception",
      }).catch(() => null);
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
