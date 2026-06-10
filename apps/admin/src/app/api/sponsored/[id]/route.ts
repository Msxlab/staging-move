import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

/**
 * Single-placement admin operations: read, edit, hard-delete. Mutations
 * share the collection route's posture — `providers` permission resource,
 * ADMIN minimum, password + MFA step-up, audit row per write. See
 * ../route.ts and docs/sponsored-placements.md for the full model.
 */

const PLACEMENT_KINDS = ["mover", "provider"] as const;
type PlacementKind = (typeof PLACEMENT_KINDS)[number];

/** Mirrors ../route.ts — eligibility ceiling for mover advertisers. */
const MOVER_MAX_COMPLAINTS_2Y = 10;

const CONFLICT_RESPONSE = {
  code: "ACTIVE_PLACEMENT_CONFLICT",
  error:
    "Another active placement already covers this surface and state scope in an overlapping window. Deactivate or end it first — surfaces render at most one placement.",
};

function extractStepUp(body: any) {
  return {
    confirmPassword: typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
    mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
    backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
  };
}

function normalizeStateScope(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Build the partial update payload from the body. Counters (impressions /
 * clicks) and createdByAdminId are deliberately ignored — counters belong
 * to the public fire-and-forget bumps only; an edit must never zero or
 * inflate the measurement record advertisers are billed against.
 */
function mutablePlacementData(body: any): { data?: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};
  if (body.kind !== undefined) {
    if (!PLACEMENT_KINDS.includes(body.kind)) {
      return { error: "Placement kind must be 'mover' or 'provider'." };
    }
    data.kind = body.kind;
  }
  if (body.targetId !== undefined) {
    const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
    if (!targetId || targetId.length > 30) {
      return { error: "A target (mover or provider) is required." };
    }
    data.targetId = targetId;
  }
  if (body.label !== undefined) {
    // FTC disclosure label can be renamed but never blanked.
    const label = normalizeOptionalString(body.label, 60);
    if (!label) {
      return { error: "Disclosure label is required (e.g. 'Sponsored'). FTC labeling is mandatory." };
    }
    data.label = label;
  }
  if (body.categoryScope !== undefined) {
    data.categoryScope = normalizeOptionalString(body.categoryScope, 50);
  }
  if (body.stateScope !== undefined) {
    if (body.stateScope && !normalizeStateScope(body.stateScope)) {
      return { error: "State scope must be a 2-letter state code, or blank for all states." };
    }
    data.stateScope = body.stateScope ? normalizeStateScope(body.stateScope) : null;
  }
  if (body.startsAt !== undefined) {
    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return { error: "A valid start date is required." };
    }
    data.startsAt = startsAt;
  }
  if (body.endsAt !== undefined) {
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (!endsAt || Number.isNaN(endsAt.getTime())) {
      return { error: "A valid end date is required." };
    }
    data.endsAt = endsAt;
  }
  if (body.active !== undefined) data.active = body.active === true;
  return { data };
}

/** Mirrors ../route.ts — target must exist and clear the eligibility gate. */
async function checkTargetEligibility(
  client: any,
  kind: PlacementKind,
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (kind === "mover") {
    const mover = await client.movingCompany.findUnique({
      where: { id: targetId },
      select: { id: true, active: true, hhgAuthorization: true, complaintCount2y: true },
    });
    if (!mover) return { ok: false, error: "Mover not found. Pick a target from the search results." };
    if (!mover.active || !mover.hhgAuthorization) {
      return {
        ok: false,
        error: "This mover is not eligible: it must be active in the FMCSA registry with household-goods authorization.",
      };
    }
    if (mover.complaintCount2y > MOVER_MAX_COMPLAINTS_2Y) {
      return {
        ok: false,
        error: `This mover exceeds the complaint ceiling (${mover.complaintCount2y} complaints in 2 years, max ${MOVER_MAX_COMPLAINTS_2Y}). Eligibility applies even to paying advertisers.`,
      };
    }
    return { ok: true };
  }
  const provider = await client.serviceProvider.findUnique({
    where: { id: targetId },
    select: { id: true, isActive: true },
  });
  if (!provider) return { ok: false, error: "Provider not found. Pick a target from the search results." };
  if (!provider.isActive) {
    return { ok: false, error: "This provider is inactive and cannot be sponsored." };
  }
  return { ok: true };
}

function windowsOverlap(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
) {
  return new Date(aStart).getTime() <= new Date(bEnd).getTime()
    && new Date(bStart).getTime() <= new Date(aEnd).getTime();
}

/** Mirrors ../route.ts — one live placement per (kind, exact state scope). */
async function findActivePlacementConflict(
  client: any,
  candidate: { kind: string; stateScope: string | null; startsAt: Date | string; endsAt: Date | string; active: boolean },
  excludeId: string,
) {
  if (!candidate.active) return null;
  const placements = await client.sponsoredPlacement.findMany({
    where: {
      kind: candidate.kind,
      active: true,
      stateScope: candidate.stateScope ?? null,
      id: { not: excludeId },
    },
    select: { id: true, startsAt: true, endsAt: true },
  });
  return (
    placements.find((placement: any) =>
      windowsOverlap(candidate.startsAt, candidate.endsAt, placement.startsAt, placement.endsAt),
    ) || null
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;
    const placement = await (prisma as any).sponsoredPlacement.findUnique({ where: { id } });
    if (!placement) return NextResponse.json({ error: "Placement not found" }, { status: 404 });
    return NextResponse.json({ placement });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to fetch placement" }, { status: 500 });
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

    // Edits rewrite live public ad inventory (target, scope, window, the
    // FTC disclosure label, the active switch) — gate behind admin
    // password + MFA step-up before any mutation.
    const { confirmPassword, mfaCode, backupCode } = extractStepUp(body);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "sponsored_placement_update",
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

    const { data, error } = mutablePlacementData(body);
    if (error || !data) {
      return NextResponse.json({ error: error || "Invalid placement payload." }, { status: 400 });
    }

    const existing = await (prisma as any).sponsoredPlacement.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Placement not found" }, { status: 404 });

    // Validate the MERGED shape — a partial edit must be checked against
    // the resulting record, not just the diff (same lesson as the
    // acquisition-campaigns PATCH).
    const merged = { ...existing, ...data };
    if (new Date(merged.endsAt).getTime() <= new Date(merged.startsAt).getTime()) {
      return NextResponse.json({ error: "End date must be after the start date." }, { status: 400 });
    }
    // Re-check eligibility when the target changes or the placement is
    // being switched on — an ineligible target must not go (back) live.
    const targetChanged = data.targetId !== undefined || data.kind !== undefined;
    const activating = data.active === true && !existing.active;
    if (targetChanged || activating) {
      const eligibility = await checkTargetEligibility(
        prisma as any,
        merged.kind as PlacementKind,
        merged.targetId as string,
      );
      if (!eligibility.ok) {
        return NextResponse.json({ code: "TARGET_NOT_ELIGIBLE", error: eligibility.error }, { status: 422 });
      }
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const conflict = await findActivePlacementConflict(tx, merged as any, id);
      if (conflict) return { conflict };
      const placement = await tx.sponsoredPlacement.update({ where: { id }, data });
      return { placement };
    });
    if (result.conflict) {
      return NextResponse.json(CONFLICT_RESPONSE, { status: 409 });
    }
    await writeAdminAudit(session, {
      action: "SPONSORED_PLACEMENT_UPDATE",
      entityType: "SponsoredPlacement",
      entityId: id,
      before: {
        kind: existing.kind,
        targetId: existing.targetId,
        stateScope: existing.stateScope,
        active: existing.active,
        label: existing.label,
      },
      after: {
        kind: result.placement.kind,
        targetId: result.placement.targetId,
        stateScope: result.placement.stateScope,
        active: result.placement.active,
        label: result.placement.label,
      },
      metadata: { operation: "sponsored_placement_update", changedFields: Object.keys(data) },
      request: requestMeta,
    });
    return NextResponse.json({ placement: result.placement });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2025") return NextResponse.json({ error: "Placement not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to update placement" }, { status: 500 });
  }
}

// Hard delete — refused once the placement has recorded traffic, because
// the impression/click counters are the measurement record advertisers
// are billed against (billing is out-of-band initially; this row is the
// only proof of delivery). Deactivate instead. Untouched drafts and
// mis-creates clean up freely.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("providers", "canDelete", { minimumRole: "ADMIN" });
    const { id } = await params;
    const requestMeta = getAuditRequestMeta(request);

    const body = await request.json().catch(() => ({}));
    const { confirmPassword, mfaCode, backupCode } = extractStepUp(body);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "sponsored_placement_delete",
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

    const existing = await (prisma as any).sponsoredPlacement.findUnique({
      where: { id },
      select: { id: true, kind: true, targetId: true, active: true, impressions: true, clicks: true },
    });
    if (!existing) return NextResponse.json({ error: "Placement not found" }, { status: 404 });

    if (existing.impressions > 0 || existing.clicks > 0) {
      return NextResponse.json(
        {
          code: "PLACEMENT_HAS_TRAFFIC",
          error:
            "Cannot delete a placement that has recorded impressions or clicks — the counters are the billing record. Deactivate it instead.",
        },
        { status: 409 },
      );
    }

    await (prisma as any).sponsoredPlacement.delete({ where: { id } });
    await writeAdminAudit(session, {
      action: "SPONSORED_PLACEMENT_DELETE",
      entityType: "SponsoredPlacement",
      entityId: id,
      before: { kind: existing.kind, targetId: existing.targetId, active: existing.active },
      metadata: { operation: "sponsored_placement_delete" },
      request: requestMeta,
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2025") return NextResponse.json({ error: "Placement not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to delete placement" }, { status: 500 });
  }
}
