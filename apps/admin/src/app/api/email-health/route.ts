import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export const runtime = "nodejs";

const WINDOW_HOURS = 24;
const TOP_FAILURES = 5;

export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "MODERATOR", fallbackResources: ["audit_logs"] });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  try {
    const [byStatus, byTemplate, recentFailures] = await Promise.all([
      prisma.emailLog.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.emailLog.groupBy({
        by: ["templateId", "status"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.emailLog.findMany({
        where: { createdAt: { gte: since }, status: { in: ["FAILED", "BOUNCED"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, error: true, status: true, createdAt: true, templateId: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
    }
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    const templateMap: Record<string, { sent: number; failed: number; pending: number; bounced: number; total: number }> = {};
    for (const row of byTemplate) {
      const id = row.templateId ?? "(no-template)";
      if (!templateMap[id]) templateMap[id] = { sent: 0, failed: 0, pending: 0, bounced: 0, total: 0 };
      const count = row._count._all;
      templateMap[id].total += count;
      if (row.status === "SENT") templateMap[id].sent += count;
      else if (row.status === "FAILED") templateMap[id].failed += count;
      else if (row.status === "PENDING") templateMap[id].pending += count;
      else if (row.status === "BOUNCED") templateMap[id].bounced += count;
    }

    const templateIds = Object.keys(templateMap).filter((id) => id !== "(no-template)");
    const templates = templateIds.length
      ? await prisma.emailTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, slug: true, name: true },
        })
      : [];
    const templateLookup = new Map(templates.map((t) => [t.id, t]));

    const byTemplateRows = Object.entries(templateMap)
      .map(([id, counts]) => ({
        templateId: id === "(no-template)" ? null : id,
        slug: id === "(no-template)" ? null : templateLookup.get(id)?.slug ?? null,
        name: id === "(no-template)" ? "(unspecified)" : templateLookup.get(id)?.name ?? "(unknown)",
        ...counts,
      }))
      .sort((a, b) => b.total - a.total);

    const failureMessages: Record<string, number> = {};
    for (const f of recentFailures) {
      const key = (f.error || "(no message)").slice(0, 200);
      failureMessages[key] = (failureMessages[key] || 0) + 1;
    }
    const topFailures = Object.entries(failureMessages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_FAILURES)
      .map(([message, count]) => ({ message, count }));

    return NextResponse.json({
      windowHours: WINDOW_HOURS,
      since: since.toISOString(),
      total,
      statusCounts,
      byTemplate: byTemplateRows,
      topFailures,
    });
  } catch (error: any) {
    console.error("[EMAIL_HEALTH GET] failed", error?.message);
    return NextResponse.json({ error: "Failed to load email health" }, { status: 500 });
  }
}
