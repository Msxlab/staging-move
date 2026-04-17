import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { action, ids, data } = await request.json();

    const session = action === "delete"
      ? await requirePermission("providers", "canDelete", { minimumRole: "ADMIN" })
      : await requirePermission("providers", "canUpdate", { minimumRole: "ADMIN" });

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No items selected" }, { status: 400 });
    }

    let result: any = {};

    switch (action) {
      case "activate":
        result = await prisma.serviceProvider.updateMany({
          where: { id: { in: ids } },
          data: { isActive: true },
        });
        break;

      case "deactivate":
        result = await prisma.serviceProvider.updateMany({
          where: { id: { in: ids } },
          data: { isActive: false },
        });
        break;

      case "delete":
        result = await prisma.serviceProvider.deleteMany({
          where: { id: { in: ids } },
        });
        break;

      case "change_category":
        if (!data?.category) {
          return NextResponse.json({ error: "Category is required" }, { status: 400 });
        }
        result = await prisma.serviceProvider.updateMany({
          where: { id: { in: ids } },
          data: { category: data.category },
        });
        break;

      case "set_score":
        if (data?.score == null) {
          return NextResponse.json({ error: "Score is required" }, { status: 400 });
        }
        result = await prisma.serviceProvider.updateMany({
          where: { id: { in: ids } },
          data: { popularityScore: data.score },
        });
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: `BULK_${action.toUpperCase()}`,
        entityType: "ServiceProvider",
        entityId: "bulk",
        changes: JSON.stringify({ ids, action, data, affected: result.count }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true, affected: result.count || ids.length });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Bulk operation failed:", error);
    return NextResponse.json({ error: "Bulk operation failed" }, { status: 500 });
  }
}
