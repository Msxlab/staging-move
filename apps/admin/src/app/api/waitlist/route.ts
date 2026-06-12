export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta } from "@/lib/audit";

const TARGETS = [
  "MOBILE_IOS",
  "MOBILE_ANDROID",
  "MOBILE_ANY",
  "PLAN_FAMILY",
  "PLAN_PRO",
  "API_ACCESS",
] as const;

type Target = (typeof TARGETS)[number];

function isTarget(value: string | null): value is Target {
  return value !== null && (TARGETS as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission("settings", "canRead", {
      minimumRole: "ADMIN",
      fallbackResources: ["audit_logs"],
    });

    const url = new URL(req.url);
    const target = url.searchParams.get("target");
    const notified = url.searchParams.get("notified"); // "true" | "false" | null
    const converted = url.searchParams.get("converted"); // "true" | "false" | null
    const source = url.searchParams.get("source");
    const search = url.searchParams.get("q")?.toLowerCase().trim() || null;

    const where: Record<string, unknown> = {};
    if (isTarget(target)) where.target = target;
    if (notified === "true") where.notifiedAt = { not: null };
    if (notified === "false") where.notifiedAt = null;
    if (converted === "true") where.convertedAt = { not: null };
    if (converted === "false") where.convertedAt = null;
    if (source) where.source = source;
    if (search) where.email = { contains: search };

    const [signups, totalsByTarget, totalAll, pendingCount, notifiedCount, convertedCount, sources] = await Promise.all([
      prisma.waitlistSignup.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.waitlistSignup.groupBy({
        by: ["target"],
        _count: { _all: true },
      }),
      prisma.waitlistSignup.count(),
      prisma.waitlistSignup.count({ where: { notifiedAt: null } }),
      prisma.waitlistSignup.count({ where: { notifiedAt: { not: null } } }),
      prisma.waitlistSignup.count({ where: { convertedAt: { not: null } } }),
      prisma.waitlistSignup.groupBy({
        by: ["source"],
        _count: { _all: true },
      }),
    ]);

    const stats = Object.fromEntries(
      TARGETS.map((t) => {
        const row = totalsByTarget.find((r: any) => r.target === t);
        return [t, row?._count._all ?? 0];
      }),
    );

    return NextResponse.json({
      signups,
      stats,
      total: signups.length,
      summary: {
        totalAll,
        pendingCount,
        notifiedCount,
        convertedCount,
      },
      sources: sources
        .filter((row: any) => row.source)
        .map((row: any) => ({
          source: row.source,
          count: row._count._all,
        })),
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canUpdate", {
      minimumRole: "ADMIN",
      fallbackResources: ["audit_logs"],
    });
    const { id, notified, converted } = (await req.json()) as {
      id?: string;
      notified?: boolean;
      converted?: boolean;
    };
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const updated = await prisma.waitlistSignup.update({
      where: { id },
      data: {
        notifiedAt:
          notified === true ? new Date() : notified === false ? null : undefined,
        convertedAt:
          converted === true ? new Date() : converted === false ? null : undefined,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE",
        entityType: "WaitlistSignup",
        entityId: updated.id,
        changes: JSON.stringify({
          notified,
          converted,
          email: updated.email,
          target: updated.target,
        }),
        ipAddress: getAuditRequestMeta(req).ipAddress || "unknown",
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
