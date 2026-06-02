import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { PROVIDER_CATEGORY_VALUES } from "@locateflow/shared";
import { z } from "zod";

const providerCategorySchema = z.enum(
  [...PROVIDER_CATEGORY_VALUES] as [string, ...string[]],
);

const bulkSchema = z.object({
  action: z.enum(["activate", "deactivate", "delete", "change_category", "set_score"]),
  ids: z.array(z.string().trim().min(1).max(30)).min(1).max(200),
  data: z
    .object({
      category: providerCategorySchema.optional(),
      score: z.number().int().min(0).max(100).optional(),
    })
    .strict()
    .optional(),
  confirmPassword: z.string().optional(),
  mfaCode: z.string().trim().max(16).optional(),
  backupCode: z.string().trim().max(64).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bulkSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid bulk request" }, { status: 400 });
    }
    const { action, data, confirmPassword, mfaCode, backupCode } = parsed.data;
    const ids = Array.from(new Set(parsed.data.ids));

    const session = action === "delete"
      ? await requirePermission("providers", "canDelete", { minimumRole: "ADMIN" })
      : await requirePermission("providers", "canUpdate", { minimumRole: "ADMIN" });

    if (action === "delete") {
      const confirm = await requirePasswordConfirm(session, confirmPassword, {
        operation: "provider_delete",
        requireMfa: true,
        mfaCode,
        backupCode,
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      });
      if (!confirm.confirmed) {
        return NextResponse.json(
          { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
          { status: 403 },
        );
      }
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
        result = await prisma.serviceProvider.updateMany({
          where: { id: { in: ids }, deletedAt: null },
          data: { deletedAt: new Date(), isActive: false },
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
        if (data?.score === undefined) {
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

    revalidateTag("providers", "default");

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
