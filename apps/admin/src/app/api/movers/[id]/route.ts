import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

/**
 * Single-mover admin operations: read + corrections PATCH.
 *
 * The MovingCompany catalog is owned by `scripts/etl-fmcsa-movers.mjs`
 * (FMCSA census snapshot, upserted on usdotNumber). Identity fields are
 * therefore NOT editable here — a hand-edit would silently be overwritten
 * (or worse, fight) the next ETL run. Only the three fields the ETL cannot
 * authoritatively fill are correctable:
 *
 *   - `active`            — catalog visibility switch (the ETL also flips
 *                           this for carriers that drop out of a snapshot;
 *                           rows are never deleted so links never 404).
 *   - `complaintCount2y`  — the NCCDB has no public bulk feed (per DOT's
 *                           PIA), so the ETL leaves 0; operators may enter
 *                           a count verified on protectyourmove.gov.
 *   - `safetyRating`      — present only in some census extracts; closed
 *                           FMCSA enum, correctable from the carrier's
 *                           official record.
 *
 * Posture mirrors the sponsored module (same `providers` resource, same
 * catalog surface): VIEWER reads, mutations require ADMIN + password/MFA
 * step-up, and every write lands an audit row.
 */

const SAFETY_RATINGS = ["Satisfactory", "Conditional", "Unsatisfactory"] as const;

/**
 * Fields owned by the FMCSA census snapshot. Rejected explicitly (not
 * silently dropped) so an operator/integration learns the correct fix —
 * rerun the ETL — instead of believing the edit stuck.
 */
const ETL_OWNED_FIELDS = [
  "usdotNumber",
  "legalName",
  "dbaName",
  "state",
  "city",
  "phone",
  "hhgAuthorization",
  "fleetSize",
  "dataAsOf",
] as const;

function extractStepUp(body: any) {
  return {
    confirmPassword: typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
    mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
    backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
  };
}

function mutableMoverData(body: any): { data?: Record<string, unknown>; error?: string } {
  for (const field of ETL_OWNED_FIELDS) {
    if (body?.[field] !== undefined) {
      return {
        error: `"${field}" comes from the FMCSA census snapshot — rerun scripts/etl-fmcsa-movers.mjs with a fresh CSV instead of editing it here.`,
      };
    }
  }
  const data: Record<string, unknown> = {};
  if (body?.active !== undefined) data.active = body.active === true;
  if (body?.complaintCount2y !== undefined) {
    const count = Number(body.complaintCount2y);
    if (!Number.isInteger(count) || count < 0 || count > 100000) {
      return { error: "Complaint count must be a whole number of 0 or more." };
    }
    data.complaintCount2y = count;
  }
  if (body?.safetyRating !== undefined) {
    if (body.safetyRating === null || body.safetyRating === "") {
      data.safetyRating = null;
    } else if (
      typeof body.safetyRating === "string"
      && (SAFETY_RATINGS as readonly string[]).includes(body.safetyRating)
    ) {
      data.safetyRating = body.safetyRating;
    } else {
      return { error: "Safety rating must be Satisfactory, Conditional, Unsatisfactory, or blank." };
    }
  }
  if (Object.keys(data).length === 0) {
    return { error: "No editable fields in payload — only active, complaintCount2y, and safetyRating can be corrected here." };
  }
  return { data };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;
    const mover = await (prisma as any).movingCompany.findUnique({ where: { id } });
    if (!mover) return NextResponse.json({ error: "Mover not found" }, { status: 404 });
    return NextResponse.json({ mover });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to fetch mover" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("providers", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestMeta = getAuditRequestMeta(request);

    // Corrections rewrite the public record for a licensed carrier
    // (complaint count and safety rating render on public mover surfaces)
    // — gate behind admin password + MFA step-up, the same bar the
    // sponsored module clears for this catalog.
    const { confirmPassword, mfaCode, backupCode } = extractStepUp(body);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "mover_catalog_update",
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

    const { data, error } = mutableMoverData(body);
    if (error || !data) {
      return NextResponse.json({ error: error || "Invalid mover payload." }, { status: 400 });
    }

    const existing = await (prisma as any).movingCompany.findUnique({
      where: { id },
      select: {
        id: true,
        usdotNumber: true,
        legalName: true,
        active: true,
        complaintCount2y: true,
        safetyRating: true,
      },
    });
    if (!existing) return NextResponse.json({ error: "Mover not found" }, { status: 404 });

    const mover = await (prisma as any).movingCompany.update({ where: { id }, data });

    await writeAdminAudit(session, {
      action: "MOVER_CATALOG_UPDATE",
      entityType: "MovingCompany",
      entityId: id,
      before: {
        active: existing.active,
        complaintCount2y: existing.complaintCount2y,
        safetyRating: existing.safetyRating,
      },
      after: {
        active: mover.active,
        complaintCount2y: mover.complaintCount2y,
        safetyRating: mover.safetyRating,
      },
      metadata: {
        operation: "mover_catalog_update",
        usdotNumber: existing.usdotNumber,
        changedFields: Object.keys(data),
      },
      request: requestMeta,
    });

    return NextResponse.json({ mover });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2025") return NextResponse.json({ error: "Mover not found" }, { status: 404 });
    console.error("Failed to update mover:", error);
    return NextResponse.json({ error: "Failed to update mover" }, { status: 500 });
  }
}

// No POST/PUT/DELETE: rows are created and retired exclusively by the ETL
// (deactivation, never deletion, keeps public links alive). Next.js
// returns 405 for the missing methods automatically.
