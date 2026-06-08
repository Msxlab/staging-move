import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { writeAdminAudit, getAuditRequestMeta } from "@/lib/audit";
import { rebuildProviderCoverage } from "@locateflow/db";
import { safeJsonArray } from "@locateflow/shared";

/**
 * POST — recompute coverage rows for a single provider FROM its already-stored
 * (scope, states, zipCodes), without changing any of those inputs. This repairs
 * drift between the stored definition and the expanded ServiceProviderCoverage
 * rows (e.g. after a ZIP-prefix table change or a partially-failed prior write)
 * by re-running expandCoverageRows -> rebuildProviderCoverage.
 *
 * It is a no-input rebuild, but it still rewrites the rows users are matched
 * against, so it requires step-up (password + MFA) and writes an audit row.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("providers", "canUpdate", {
      minimumRole: "MODERATOR",
    });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestMeta = getAuditRequestMeta(request);

    const confirm = await requirePasswordConfirm(session, body?.confirmPassword, {
      operation: "provider_coverage_recompute",
      requireMfa: true,
      mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
      backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const provider = await prisma.serviceProvider.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, scope: true, states: true, zipCodes: true },
    });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const before = await prisma.serviceProviderCoverage.count({ where: { providerId: id } });

    const rowCount = await prisma.$transaction((tx: any) =>
      rebuildProviderCoverage(tx, {
        providerId: id,
        scope: provider.scope,
        states: safeJsonArray(provider.states),
        zipCodes: safeJsonArray(provider.zipCodes),
      }),
    );

    await writeAdminAudit(session, {
      action: "RECOMPUTE_PROVIDER_COVERAGE",
      entityType: "ServiceProvider",
      entityId: id,
      metadata: {
        providerName: provider.name,
        previousRows: before,
        rebuiltRows: rowCount,
      },
      request: requestMeta,
    });

    revalidateTag("providers", "default");

    return NextResponse.json({ success: true, previousRows: before, rebuiltRows: rowCount });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to recompute coverage" }, { status: 500 });
  }
}
