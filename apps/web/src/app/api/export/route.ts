import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { decrypt } from "@/lib/shared-encryption";
import { LEGAL_CONSENT_EVENT } from "@/lib/legal";

// GET /api/export?type=addresses|services|budget|moving|moveTasks|customProviders|legal|full&format=csv|json&includeNotes=true
//
// `notes` is a free-form, encrypted field; decrypting it into the export
// default would produce an exported plaintext copy that can easily leak via
// logs, proxies, or email attachments. We require an explicit opt-in via
// `?includeNotes=true` to return decrypted notes; otherwise notes are omitted.
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "full";
    const format = searchParams.get("format") || "json";
    const includeNotes = searchParams.get("includeNotes") === "true";

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
        if (item.email) out.email = maskEmail(item.email);
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
        where: { userId },
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
        where: { userId },
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
          where: { userId },
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
        notes: exportPlainNotes(provider.notes),
      }));
    }

    if (type === "budget" || type === "full") {
      data.budgets = await prisma.budget.findMany({
        where: { userId },
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
        where: { userId },
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

    if (format === "csv") {
      // Convert to CSV - flatten the primary data type
      let csvContent = "";
      const dataKey = type === "full" ? "services" : type;
      const items = data[dataKey as keyof typeof data] || [];

      // Prevent CSV formula injection: prefix dangerous characters with a single quote
      const safeCsvValue = (v: string): string => {
        const trimmed = v.trimStart();
        if (trimmed.length > 0 && "=+-@".includes(trimmed[0])) {
          return "'" + v;
        }
        return v;
      };

      if (items.length > 0) {
        const flatItems = items.map((item: any) => {
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
          "Content-Disposition": `attachment; filename="locateflow-${type}-export.csv"`,
        },
      });
    }

    // JSON format
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="locateflow-${type}-export.json"`,
      },
    });
  } catch (error) {
    console.error("Export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
