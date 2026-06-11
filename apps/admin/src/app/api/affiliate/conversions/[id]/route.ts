import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

/**
 * PATCH /api/affiliate/conversions/:id — advance an affiliate conversion through
 * its reconciliation lifecycle. Touches the revenue ledger, so it's gated at
 * providers:canUpdate (ADMIN) with password+MFA step-up + an audit row.
 *
 * Allowed transitions:
 *   PENDING  → APPROVED | REJECTED
 *   APPROVED → PAID      | REJECTED
 * (REJECTED and PAID are terminal.)
 */

const ALLOWED: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["PAID", "REJECTED"],
};

function extractStepUp(body: any) {
  return {
    confirmPassword: typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
    mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
    backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("providers", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestMeta = getAuditRequestMeta(request);

    const next = String(body?.status ?? "");
    if (!["APPROVED", "REJECTED", "PAID"].includes(next)) {
      return NextResponse.json({ error: "Invalid target status." }, { status: 400 });
    }

    const { confirmPassword, mfaCode, backupCode } = extractStepUp(body);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "affiliate_conversion_status",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const existing = await prisma.affiliateConversion.findUnique({
      where: { id },
      select: { id: true, status: true, network: true, amountCents: true },
    });
    if (!existing) return NextResponse.json({ error: "Conversion not found" }, { status: 404 });

    if (!(ALLOWED[existing.status] ?? []).includes(next)) {
      return NextResponse.json(
        { code: "INVALID_TRANSITION", error: `Cannot move a ${existing.status} conversion to ${next}.` },
        { status: 409 },
      );
    }

    const updated = await prisma.affiliateConversion.update({
      where: { id },
      data: { status: next },
      select: { id: true, status: true },
    });

    await writeAdminAudit(session, {
      action: "AFFILIATE_CONVERSION_STATUS",
      entityType: "AffiliateConversion",
      entityId: id,
      before: { status: existing.status },
      after: { status: updated.status },
      metadata: { operation: "affiliate_conversion_status", network: existing.network, amountCents: existing.amountCents },
      request: requestMeta,
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2025") return NextResponse.json({ error: "Conversion not found" }, { status: 404 });
    console.error("Failed to update affiliate conversion:", error);
    return NextResponse.json({ error: "Failed to update conversion" }, { status: 500 });
  }
}
