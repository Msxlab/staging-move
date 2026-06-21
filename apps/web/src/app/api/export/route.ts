import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { decrypt } from "@/lib/shared-encryption";
import { LEGAL_CONSENT_EVENT } from "@/lib/legal";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { emitSecurityEvent } from "@/lib/security-events";
import { verifyUserStepUp } from "@/lib/user-step-up";
import { planFeatures } from "@locateflow/shared";
import { buildTaxReportData } from "@/lib/tax-report-data";
import { getRequestEntitlement } from "@/lib/request-entitlements";
import { contentDispositionAttachment } from "@/lib/http-download";

// POST /api/export
// Body: { type, format, includeNotes, confirmPassword?, mfaCode?, backupCode? }
//
// `notes` is a free-form, encrypted field; decrypting it into the export
// default would produce an exported plaintext copy that can easily leak via
// logs, proxies, or email attachments. We require an explicit opt-in via
// `?includeNotes=true` to return decrypted notes; otherwise notes are omitted.
export async function GET() {
  return NextResponse.json(
    {
      code: "STEP_UP_REQUIRED",
      error: "Use POST with step-up verification to export account data.",
    },
    { status: 403 },
  );
}

const ALLOWED_TYPES = new Set([
  "addresses",
  "services",
  "budget",
  "moving",
  "moveTasks",
  "customProviders",
  "legal",
  "support",
  "notifications",
  "subscription",
  "workspace",
  "analytics",
  "tax",
  "full",
]);
const ALLOWED_FORMATS = new Set(["csv", "json"]);

// Export types that are a paid (Pro) capability rather than a GDPR data dump.
// "full"/"addresses"/etc. remain available to everyone for data portability;
// the tax/property report is a Pro deliverable gated on advancedExport.
const ADVANCED_EXPORT_TYPES = new Set(["tax"]);

export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const body = await request.json().catch(() => ({}));
    const type = typeof body?.type === "string" && ALLOWED_TYPES.has(body.type) ? body.type : "full";
    const rawFormat = typeof body?.format === "string" ? body.format.toLowerCase() : "json";
    const format = ALLOWED_FORMATS.has(rawFormat) ? rawFormat : "json";
    const includeNotes = body?.includeNotes === true;
    const meta = extractRequestMeta(request);
    emitSecurityEvent({
      type: "EXPORT_ATTEMPT",
      severity: "info",
      group: "export_data",
      context: { userId, type, format, includeNotes },
    });

    const rl = await enforceRateLimitPolicy(request, "export_data", {
      userId,
      routeId: `export:${type}:${format}`,
    });
    if (!rl.success) {
      await createAuditLog({
        userId,
        action: "EXPORT_LIMIT",
        entityType: "User",
        entityId: userId,
        changes: { type, format, code: rl.policy.userFacingErrorCode },
        ...meta,
      });
      return NextResponse.json(
        {
          code: rl.policy.userFacingErrorCode,
          error: "Too many export attempts. Please wait and try again.",
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    const stepUp = await verifyUserStepUp({
      userId,
      confirmPassword: typeof body?.confirmPassword === "string" ? body.confirmPassword : null,
      mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : null,
      backupCode: typeof body?.backupCode === "string" ? body.backupCode : null,
    });
    if (!stepUp.ok) {
      await createAuditLog({
        userId,
        action: "EXPORT_BLOCK",
        entityType: "User",
        entityId: userId,
        changes: { type, format, code: stepUp.code },
        ...meta,
      });
      return NextResponse.json(
        {
          error: stepUp.code === "STEP_UP_REQUIRED"
            ? "Enter your password or a valid MFA code before exporting data."
            : stepUp.code === "STEP_UP_METHOD_UNAVAILABLE"
              ? "Set a password or enable MFA before exporting data."
              : "Password or MFA verification failed.",
          code: stepUp.code,
        },
        { status: stepUp.code === "STEP_UP_REQUIRED" ? 403 : 401 },
      );
    }

    // Pro-gated reports: the tax/property export is an entitlement, not a GDPR
    // data dump, so it requires an active plan whose features include
    // advancedExport (Pro). Inactive/expired Pro resolves to FREE_TRIAL here.
    if (ADVANCED_EXPORT_TYPES.has(type)) {
      const { plan: userPlan } = await getRequestEntitlement(request, userId);
      if (!planFeatures(userPlan.plan).advancedExport) {
        await createAuditLog({
          userId,
          action: "EXPORT_BLOCK",
          entityType: "User",
          entityId: userId,
          changes: { type, format, code: "UPGRADE_REQUIRED", plan: userPlan.plan },
          ...meta,
        });
        return NextResponse.json(
          {
            error: "Tax & property export is a Pro feature. Upgrade to Pro to export tax and property reports.",
            code: "UPGRADE_REQUIRED",
          },
          { status: 403 },
        );
      }
    }

    await createAuditLog({
      userId,
      action: "EXPORT_DATA",
      entityType: "User",
      entityId: userId,
      changes: { type, format, includeNotes, stepUpMethod: stepUp.method },
      ...meta,
    });

    // Mask sensitive fields in export data
    const maskValue = (val: string, visibleEnd = 4): string => {
      if (!val || val.length <= visibleEnd) return "****";
      return "****" + val.slice(-visibleEnd);
    };
    const maskEmail = (email: string): string => {
      if (!email) return "";
      const [local, domain] = email.split("@");
      if (!domain) return "****";
      return local.slice(0, 2) + "****@" + domain;
    };
    const readEncrypted = (value: string | null | undefined): string => {
      if (!value) return "";
      return decrypt(value);
    };
    const exportPlainNotes = (value: string | null | undefined): string | null =>
      includeNotes ? value || "" : null;
    const maskSensitiveFields = (items: any[]) =>
      items.map((item: any) => {
        const out = { ...item };
        if (item.accountNumber)
          out.accountNumber = maskValue(readEncrypted(item.accountNumber));
        if (item.phone) out.phone = maskValue(readEncrypted(item.phone));
        if (item.email) out.email = maskEmail(readEncrypted(item.email));
        if (item.username)
          out.username = maskValue(readEncrypted(item.username), 2);
        if ("notes" in item) {
          out.notes = includeNotes ? readEncrypted(item.notes) : null;
        }
        return out;
      });

    let data: any = {};

    if (type === "addresses" || type === "full") {
      data.addresses = await prisma.address.findMany({
        where: { userId, deletedAt: null },
        select: {
          nickname: true,
          type: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          zip: true,
          ownership: true,
          isPrimary: true,
          startDate: true,
          endDate: true,
        },
      });
    }

    if (type === "services" || type === "full") {
      const rawServices = await prisma.service.findMany({
        where: { userId, deletedAt: null },
        select: {
          category: true,
          providerName: true,
          accountNumber: true,
          website: true,
          phone: true,
          email: true,
          monthlyCost: true,
          billingDay: true,
          billingCycle: true,
          autoRenewal: true,
          contractEndDate: true,
          isActive: true,
          notes: true,
          provider: { select: { name: true, category: true, scope: true } },
          customProvider: { select: { name: true, category: true, providerType: true, trustStatus: true } },
          address: { select: { nickname: true, city: true, state: true } },
        },
      });
      data.services = maskSensitiveFields(rawServices);
    }

    if (type === "customProviders" || type === "full") {
      data.customProviders = (
        await prisma.userCustomProvider.findMany({
          where: { userId, deletedAt: null },
          select: {
            name: true,
            category: true,
            description: true,
            website: true,
            phone: true,
            email: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            zipCode: true,
            notes: true,
            providerType: true,
            trustStatus: true,
            adminReviewStatus: true,
            linkedServiceProvider: { select: { name: true, category: true } },
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
          orderBy: { createdAt: "desc" },
        })
      ).map((provider) => ({
        ...provider,
        phone: provider.phone ? maskValue(provider.phone) : provider.phone,
        email: provider.email ? maskEmail(provider.email) : provider.email,
        notes: exportPlainNotes(provider.notes),
      }));
    }

    if (type === "budget" || type === "full") {
      data.budgets = await prisma.budget.findMany({
        where: { userId, deletedAt: null },
        select: {
          month: true,
          year: true,
          plannedIncome: true,
          actualIncome: true,
          plannedExpenses: true,
          actualExpenses: true,
          categoryBreakdown: true,
          notes: true,
        },
      });
    }

    if (type === "moving" || type === "full") {
      data.movingPlans = await prisma.movingPlan.findMany({
        where: { userId, deletedAt: null },
        include: {
          fromAddress: { select: { city: true, state: true } },
          toAddress: { select: { city: true, state: true } },
        },
      });
    }

    if (type === "moveTasks" || type === "moving" || type === "full") {
      data.moveTasks = (
        await prisma.moveTask.findMany({
          where: { userId, deletedAt: null },
          select: {
            title: true,
            description: true,
            actionType: true,
            status: true,
            source: true,
            reason: true,
            caveats: true,
            confidence: true,
            dueDate: true,
            acceptedAt: true,
            completedAt: true,
            dismissedAt: true,
            reopenedAt: true,
            lastStatusChangedAt: true,
            localEffect: true,
            metadata: true,
            notes: true,
            movingPlan: {
              select: {
                moveDate: true,
                status: true,
                fromAddress: { select: { city: true, state: true } },
                toAddress: { select: { city: true, state: true } },
              },
            },
            service: { select: { category: true, providerName: true, isActive: true } },
            provider: { select: { name: true, category: true, scope: true } },
            customProvider: { select: { name: true, category: true, providerType: true } },
            destinationProvider: { select: { name: true, category: true, scope: true } },
            originAddress: { select: { nickname: true, city: true, state: true } },
            destinationAddress: { select: { nickname: true, city: true, state: true } },
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        })
      ).map((task) => ({
        ...task,
        notes: exportPlainNotes(task.notes),
      }));
    }

    if (type === "legal" || type === "full") {
      data.legalConsents = (
        await prisma.userEvent.findMany({
          where: { userId, event: LEGAL_CONSENT_EVENT },
          select: {
            event: true,
            page: true,
            metadata: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        })
      ).map((event) => {
        let metadata: unknown = event.metadata;
        if (typeof event.metadata === "string") {
          try {
            metadata = JSON.parse(event.metadata);
          } catch {
            metadata = event.metadata;
          }
        }
        return { ...event, metadata };
      });
    }

    if (type === "legal" || type === "full") {
      data.dataConsents = await prisma.dataConsent.findMany({
        where: { userId },
        select: {
          category: true,
          granted: true,
          version: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (type === "support" || type === "full") {
      data.supportTickets = await prisma.supportTicket.findMany({
        where: { userId },
        select: {
          subject: true,
          category: true,
          priority: true,
          status: true,
          platform: true,
          resolvedAt: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            where: { isInternal: false },
            select: {
              senderType: true,
              content: true,
              attachmentUrl: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (type === "notifications" || type === "full") {
      const [notifications, notificationPreferences, pushDevices] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          select: {
            type: true,
            title: true,
            body: true,
            href: true,
            channel: true,
            read: true,
            readAt: true,
            sent: true,
            sentAt: true,
            sendAt: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.notificationPreference.findMany({
          where: { userId },
          select: {
            channel: true,
            type: true,
            enabled: true,
            frequency: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ channel: "asc" }, { type: "asc" }],
        }),
        prisma.pushDevice.findMany({
          where: { userId },
          select: {
            platform: true,
            deviceName: true,
            lastSeenAt: true,
            createdAt: true,
          },
          orderBy: { lastSeenAt: "desc" },
        }),
      ]);
      data.notifications = notifications;
      data.notificationPreferences = notificationPreferences;
      data.pushDevices = pushDevices;
    }

    if (type === "subscription" || type === "full") {
      data.subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: {
          plan: true,
          status: true,
          provider: true,
          platform: true,
          billingProductId: true,
          appStoreEnvironment: true,
          currentPeriodEndsAt: true,
          gracePeriodEndsAt: true,
          trialEndsAt: true,
          canceledAt: true,
          cancelAtPeriodEnd: true,
          accessType: true,
          billingInterval: true,
          campaignCode: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    if (type === "analytics" || type === "full") {
      const [sessions, events] = await Promise.all([
        prisma.userSession.findMany({
          where: { userId },
          select: {
            browser: true,
            os: true,
            device: true,
            deviceType: true,
            platform: true,
            language: true,
            pageViews: true,
            sessionStart: true,
            sessionEnd: true,
            lastActivity: true,
          },
          orderBy: { sessionStart: "desc" },
          take: 500,
        }),
        prisma.userEvent.findMany({
          where: { userId },
          select: {
            event: true,
            page: true,
            metadata: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1000,
        }),
      ]);
      data.analyticsSessions = sessions;
      data.analyticsEvents = events;
    }

    if (type === "workspace" || type === "full") {
      // The requester's own shared-workspace context (GDPR Art. 15): which
      // workspaces they belong to and their role, plus invitations they sent
      // or received. Other members' personal data is never included; emails on
      // sent invitations are masked.
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      const [memberships, invitationsSent, invitationsReceived] = await Promise.all([
        prisma.workspaceMember.findMany({
          where: { userId },
          select: {
            role: true,
            status: true,
            joinedAt: true,
            workspace: { select: { name: true, ownerUserId: true, createdAt: true } },
          },
          orderBy: { joinedAt: "asc" },
        }),
        prisma.workspaceInvitation.findMany({
          where: { invitedByUserId: userId },
          select: {
            invitedEmail: true,
            role: true,
            status: true,
            createdAt: true,
            expiresAt: true,
            workspace: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        me?.email
          ? prisma.workspaceInvitation.findMany({
              where: { invitedEmail: me.email },
              select: {
                role: true,
                status: true,
                createdAt: true,
                expiresAt: true,
                workspace: { select: { name: true } },
              },
              orderBy: { createdAt: "desc" },
            })
          : Promise.resolve([]),
      ]);
      data.workspaceMemberships = memberships.map((m) => ({
        workspaceName: m.workspace?.name ?? null,
        isOwner: m.workspace?.ownerUserId === userId,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        workspaceCreatedAt: m.workspace?.createdAt ?? null,
      }));
      data.workspaceInvitationsSent = invitationsSent.map((i) => ({
        workspaceName: i.workspace?.name ?? null,
        invitedEmail: maskEmail(i.invitedEmail),
        role: i.role,
        status: i.status,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
      }));
      data.workspaceInvitationsReceived = invitationsReceived.map((i) => ({
        workspaceName: i.workspace?.name ?? null,
        role: i.role,
        status: i.status,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
      }));
    }

    if (type === "tax") {
      // Pro "Tax & property export": a per-property summary suitable for tax
      // prep (rental/home-office expenses, moving expenses). Distinct from the
      // raw addresses/services dumps — it joins services to their property,
      // annualizes recurring cost, and lists move events touching each address.
      const taxData = await buildTaxReportData(userId);
      data.tax = taxData.tax;
      data.taxByProperty = taxData.taxByProperty;
      data.taxTotals = taxData.taxTotals;
    }

    emitSecurityEvent({
      type: "EXPORT_ATTEMPT",
      severity: "info",
      group: "export_data",
      context: { userId, type, format, includeNotes, outcome: "success", stepUpMethod: stepUp.method },
    });
    await createAuditLog({
      userId,
      action: "EXPORT",
      entityType: "User",
      entityId: userId,
      changes: { status: "success", type, format, includeNotes, stepUpMethod: stepUp.method },
      ...meta,
    });

    if (format === "csv") {
      // Convert to CSV - flatten the primary data type
      let csvContent = "";
      const dataKeyMap: Record<string, string> = {
        budget: "budgets",
        moving: "movingPlans",
        support: "supportTickets",
        notifications: "notifications",
        subscription: "subscription",
        analytics: "analyticsEvents",
        legal: "legalConsents",
        workspace: "workspaceMemberships",
      };
      const dataKey = type === "full" ? "services" : (dataKeyMap[type] || type);
      const items = data[dataKey as keyof typeof data] || [];
      const listItems = Array.isArray(items) ? items : items ? [items] : [];

      // Prevent CSV formula injection: prefix dangerous characters with a single quote
      const safeCsvValue = (v: string): string => {
        const trimmed = v.trimStart();
        if (trimmed.length > 0 && "=+-@".includes(trimmed[0])) {
          return "'" + v;
        }
        return v;
      };

      // The tax report needs the per-property roll-ups + grand total an
      // accountant wants, which the single-array flattener can't express. Emit a
      // multi-section CSV: property summary, grand total, then detailed line items.
      if (type === "tax") {
        const esc = (value: unknown): string => {
          const s = safeCsvValue(String(value ?? ""));
          return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const row = (values: unknown[]): string => values.map(esc).join(",") + "\n";
        const dateOnly = (d: unknown): string => (d ? new Date(d as string).toISOString().split("T")[0] : "");
        const byProperty = (data.taxByProperty as any[]) || [];
        const lineItems = (data.tax as any[]) || [];
        const totals = (data.taxTotals as any) || {};

        let csv = "PROPERTY SUMMARY\n";
        csv += row(["property", "propertyType", "ownership", "isPrimary", "occupancyStart", "occupancyEnd", "serviceCount", "totalMonthlyEquivalent", "totalAnnualizedCost"]);
        for (const p of byProperty) {
          csv += row([p.property, p.propertyType, p.ownership, p.isPrimary, dateOnly(p.occupancyStart), dateOnly(p.occupancyEnd), p.serviceCount, p.totalMonthlyEquivalent, p.totalAnnualizedCost]);
        }
        csv += row(["GRAND TOTAL", "", "", "", "", "", totals.serviceCount ?? "", totals.totalMonthlyEquivalent ?? "", totals.totalAnnualizedCost ?? ""]);

        csv += "\nLINE ITEMS\n";
        csv += row(["property", "propertyType", "ownership", "serviceProvider", "serviceCategory", "billingCycle", "oneTime", "active", "cycleAmount", "monthlyEquivalent", "annualizedCost"]);
        for (const it of lineItems) {
          csv += row([it.property, it.propertyType, it.ownership, it.serviceProvider, it.serviceCategory, it.billingCycle, it.oneTime, it.active, it.cycleAmount, it.monthlyEquivalent, it.annualizedCost]);
        }

        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": contentDispositionAttachment("locateflow-tax-export.csv"),
          },
        });
      }

      if (listItems.length > 0) {
        const flatItems = listItems.map((item: any) => {
          const flat: Record<string, string> = {};
          for (const [key, val] of Object.entries(item)) {
            if (
              val &&
              typeof val === "object" &&
              !Array.isArray(val) &&
              !(val instanceof Date)
            ) {
              for (const [k2, v2] of Object.entries(val as any)) {
                flat[`${key}_${k2}`] = String(v2 ?? "");
              }
            } else if (val instanceof Date) {
              flat[key] = (val as Date).toISOString().split("T")[0];
            } else {
              flat[key] = String(val ?? "");
            }
          }
          return flat;
        });

        const headerSet = new Set<string>();
        for (const item of flatItems)
          Object.keys(item).forEach((k) => headerSet.add(k));
        const headers: string[] = Array.from(headerSet);
        csvContent = headers.join(",") + "\n";
        for (const item of flatItems) {
          csvContent +=
            headers
              .map((h) => {
                const v = safeCsvValue(item[h] || "");
                return v.includes(",") || v.includes('"')
                  ? `"${v.replace(/"/g, '""')}"`
                  : v;
              })
              .join(",") + "\n";
        }
      }

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": contentDispositionAttachment(`locateflow-${type}-export.csv`),
        },
      });
    }

    // JSON format
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": contentDispositionAttachment(`locateflow-${type}-export.json`),
      },
    });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
