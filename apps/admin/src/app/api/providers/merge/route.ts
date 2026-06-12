import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta } from "@/lib/audit";
import { revalidateProvidersCatalog } from "@/lib/providers-revalidate";

/**
 * POST /api/providers/merge
 *
 * Merge a duplicate provider into a keeper: re-point every reference
 * (services, coverage, affiliate clicks/conversions, move tasks, governance
 * issues, logo candidates, custom-provider links, saved/feedback rows) from the
 * duplicate to the keeper, fold the duplicate's userCount into the keeper, and
 * soft-delete the duplicate. Turns the duplicate_domain governance signal into a
 * safe, audited cleanup instead of a bare delete that orphans coverage rows and
 * affiliate attribution.
 *
 * ADMIN + password/MFA step-up (destructive). All re-pointing happens in one
 * transaction, so any constraint violation rolls the whole merge back.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("providers", "canDelete", { minimumRole: "ADMIN" });

    let keepId: string | undefined;
    let duplicateId: string | undefined;
    let confirmPassword: string | undefined;
    let mfaCode: string | undefined;
    let backupCode: string | undefined;
    try {
      const body = await request.json();
      keepId = typeof body?.keepId === "string" ? body.keepId : undefined;
      duplicateId = typeof body?.duplicateId === "string" ? body.duplicateId : undefined;
      confirmPassword = body?.confirmPassword;
      mfaCode = typeof body?.mfaCode === "string" ? body.mfaCode : undefined;
      backupCode = typeof body?.backupCode === "string" ? body.backupCode : undefined;
    } catch {
      /* no body — validation below returns 400 / step-up returns 403 */
    }

    if (!keepId || !duplicateId) {
      return NextResponse.json({ error: "keepId and duplicateId are required" }, { status: 400 });
    }
    if (keepId === duplicateId) {
      return NextResponse.json({ error: "keepId and duplicateId must differ" }, { status: 400 });
    }

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "provider_merge",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: getAuditRequestMeta(request).ipAddress || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const [keeper, duplicate] = await Promise.all([
      prisma.serviceProvider.findFirst({ where: { id: keepId, deletedAt: null }, select: { id: true, name: true } }),
      prisma.serviceProvider.findFirst({ where: { id: duplicateId, deletedAt: null }, select: { id: true, name: true, userCount: true } }),
    ]);
    if (!keeper) return NextResponse.json({ error: "Keeper provider not found" }, { status: 404 });
    if (!duplicate) return NextResponse.json({ error: "Duplicate provider not found" }, { status: 404 });

    const dupId = duplicate.id;
    const keepIdResolved = keeper.id;

    await prisma.$transaction(async (tx: any) => {
      // (userId, providerId)-unique tables: drop the duplicate's rows for users
      // who already have a keeper row, then re-point the remainder.
      for (const model of ["savedProvider", "recommendationFeedback"] as const) {
        const keeperUserIds = (
          await tx[model].findMany({ where: { providerId: keepIdResolved }, select: { userId: true } })
        ).map((r: { userId: string }) => r.userId);
        if (keeperUserIds.length) {
          await tx[model].deleteMany({ where: { providerId: dupId, userId: { in: keeperUserIds } } });
        }
        await tx[model].updateMany({ where: { providerId: dupId }, data: { providerId: keepIdResolved } });
      }

      // No-conflict re-points.
      await tx.service.updateMany({ where: { providerId: dupId }, data: { providerId: keepIdResolved } });
      await tx.serviceProviderCoverage.updateMany({ where: { providerId: dupId }, data: { providerId: keepIdResolved } });
      await tx.affiliateClick.updateMany({ where: { providerId: dupId }, data: { providerId: keepIdResolved } });
      await tx.affiliateConversion.updateMany({ where: { providerId: dupId }, data: { providerId: keepIdResolved } });
      await tx.providerGovernanceIssue.updateMany({ where: { providerId: dupId }, data: { providerId: keepIdResolved } });
      await tx.providerLogoCandidate.updateMany({ where: { providerId: dupId }, data: { providerId: keepIdResolved } });
      await tx.moveTask.updateMany({ where: { providerId: dupId }, data: { providerId: keepIdResolved } });
      await tx.moveTask.updateMany({ where: { destinationProviderId: dupId }, data: { destinationProviderId: keepIdResolved } });
      await tx.userCustomProvider.updateMany({ where: { linkedServiceProviderId: dupId }, data: { linkedServiceProviderId: keepIdResolved } });

      // Fold the duplicate's adoption count into the keeper, then soft-delete it.
      await tx.serviceProvider.update({
        where: { id: keepIdResolved },
        data: { userCount: { increment: duplicate.userCount || 0 } },
      });
      await tx.serviceProvider.update({
        where: { id: dupId },
        data: { deletedAt: new Date(), isActive: false },
      });
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "MERGE_PROVIDER",
        entityType: "ServiceProvider",
        entityId: keepIdResolved,
        changes: JSON.stringify({
          keptId: keepIdResolved,
          keptName: keeper.name,
          mergedId: dupId,
          mergedName: duplicate.name,
          mergedUserCount: duplicate.userCount || 0,
        }),
        ipAddress: getAuditRequestMeta(request).ipAddress || "unknown",
      },
    });

    revalidateProvidersCatalog();

    return NextResponse.json({ success: true, keptId: keepIdResolved, mergedId: dupId });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to merge providers:", error);
    return NextResponse.json({ error: "Failed to merge providers" }, { status: 500 });
  }
}
