import { NextRequest, NextResponse } from "next/server";
import { getEffectiveEntitlement, seatLimitForPlan } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { parsePaginationParams } from "@/lib/pagination";
import { maskEmail } from "@/lib/privacy";

export const dynamic = "force-dynamic";

/** Plan → admin-facing workspace label. */
function planLabel(plan: string): string {
  if (plan === "FAMILY") return "Household";
  if (plan === "PRO") return "Workspace";
  return "Solo";
}

/**
 * Admin read of Family/Pro households. Lists workspaces with owner, plan,
 * seat usage and member count. Gated at users:canRead (VIEWER floor) so support
 * roles can investigate a household without mutation rights.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("users", "canRead", { minimumRole: "VIEWER" });

    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = parsePaginationParams(searchParams, { defaultPerPage: 20 });
    const search = (searchParams.get("search") || "").trim();
    const multiOnly = searchParams.get("multiOnly") === "1";

    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.owner = {
        OR: [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      prisma.workspace.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: perPage,
        select: {
          id: true,
          name: true,
          createdAt: true,
          ownerUserId: true,
          owner: { select: { id: true, email: true, firstName: true, lastName: true, deletedAt: true } },
          _count: { select: { members: true } },
        },
      }),
      prisma.workspace.count({ where }),
    ]);

    const ownerIds = [...new Set(rows.map((w) => w.ownerUserId))];
    const subs = ownerIds.length
      ? await prisma.subscription.findMany({ where: { userId: { in: ownerIds } } })
      : [];
    const subByUser = new Map(subs.map((s) => [s.userId, s]));

    let workspaces = rows.map((w) => {
      const plan = String(getEffectiveEntitlement(subByUser.get(w.ownerUserId) ?? null).effectivePlan);
      const owner = w.owner;
      return {
        id: w.id,
        name: w.name,
        createdAt: w.createdAt,
        memberCount: w._count.members,
        plan,
        planLabel: planLabel(plan),
        seatLimit: seatLimitForPlan(plan),
        owner: owner?.deletedAt
          ? { id: owner.id, email: null, name: null, deleted: true }
          : {
              id: owner?.id ?? null,
              email: owner?.email ? maskEmail(owner.email) : null,
              name: [owner?.firstName, owner?.lastName].filter(Boolean).join(" ") || null,
            },
      };
    });

    // Default to real multi-seat households (Family/Pro); a solo Individual
    // workspace is noise in the admin household view.
    if (multiOnly) workspaces = workspaces.filter((w) => w.seatLimit > 1);

    return NextResponse.json(
      { workspaces, page, perPage, total },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to list workspaces:", error);
    return NextResponse.json({ error: "Failed to list workspaces" }, { status: 500 });
  }
}
