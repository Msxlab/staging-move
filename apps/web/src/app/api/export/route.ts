import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { decrypt } from "@/lib/shared-encryption";

// GET /api/export?type=addresses|services|budget|moving|full&format=csv|json
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "full";
    const format = searchParams.get("format") || "json";

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
    const maskSensitiveFields = (items: any[]) =>
      items.map((item: any) => ({
        ...item,
        ...(item.accountNumber && { accountNumber: maskValue(decrypt(item.accountNumber)) }),
        ...(item.phone && { phone: maskValue(item.phone) }),
        ...(item.email && { email: maskEmail(item.email) }),
        ...(item.username && { username: maskValue(decrypt(item.username), 2) }),
      }));

    let data: any = {};

    if (type === "addresses" || type === "full") {
      data.addresses = await prisma.address.findMany({
        where: { userId },
        select: { nickname: true, type: true, street: true, street2: true, city: true, state: true, zip: true, ownership: true, isPrimary: true, startDate: true, endDate: true },
      });
    }

    if (type === "services" || type === "full") {
      const rawServices = await prisma.service.findMany({
        where: { userId },
        select: {
          category: true, providerName: true, accountNumber: true, website: true, phone: true, email: true,
          monthlyCost: true, billingDay: true, billingCycle: true, autoRenewal: true, contractEndDate: true,
          isActive: true, notes: true,
          address: { select: { nickname: true, city: true, state: true } },
        },
      });
      data.services = maskSensitiveFields(rawServices);
    }

    if (type === "budget" || type === "full") {
      data.budgets = await prisma.budget.findMany({
        where: { userId },
        select: { month: true, year: true, plannedIncome: true, actualIncome: true, plannedExpenses: true, actualExpenses: true, categoryBreakdown: true, notes: true },
      });
    }

    if (type === "moving" || type === "full") {
      data.movingPlans = await prisma.movingPlan.findMany({
        where: { userId },
        include: {
          fromAddress: { select: { city: true, state: true } },
          toAddress: { select: { city: true, state: true } },
          tasks: { select: { title: true, category: true, priority: true, completed: true, dueDate: true } },
          boxes: { select: { boxNumber: true, label: true, room: true, contents: true, isPacked: true, isFragile: true } },
        },
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
            if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
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
        for (const item of flatItems) Object.keys(item).forEach((k) => headerSet.add(k));
        const headers: string[] = Array.from(headerSet);
        csvContent = headers.join(",") + "\n";
        for (const item of flatItems) {
          csvContent += headers.map((h) => {
            const v = safeCsvValue(item[h] || "");
            return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
          }).join(",") + "\n";
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
