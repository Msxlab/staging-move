import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

/**
 * Admin CRUD for SponsoredPlacement rows — the labeled ad slots rendered
 * by directory surfaces (licensed-movers list today; provider catalog
 * later). Placements never touch organic rankings: the public reader
 * (apps/web/src/lib/movers.ts) renders at most one active placement in a
 * SEPARATE labeled slot, gated by the SPONSORED_ENABLED runtime flag.
 *
 * Permission resource: `providers` — placements live in the same catalog
 * surface the providers module governs and target ServiceProvider /
 * MovingCompany rows. Reads sit at the VIEWER floor; every mutation
 * requires ADMIN + password/MFA step-up (a placement is paid public ad
 * inventory — same blast radius class as acquisition campaigns).
 */

const PLACEMENT_KINDS = ["mover", "provider"] as const;
type PlacementKind = (typeof PLACEMENT_KINDS)[number];

/**
 * Eligibility gate for mover placements — even paying advertisers must be
 * FMCSA-licensed for household goods, active in the registry, and under
 * the complaint ceiling. Mirrors docs/sponsored-placements.md; the public
 * reader independently re-checks active + hhgAuthorization at render time.
 */
const MOVER_MAX_COMPLAINTS_2Y = 10;

const CONFLICT_RESPONSE = {
  code: "ACTIVE_PLACEMENT_CONFLICT",
  error:
    "Another active placement already covers this surface and state scope in an overlapping window. Deactivate or end it first — surfaces render at most one placement.",
};

/**
 * Step-up credentials ride in the same JSON body as the placement payload
 * (the client merges them in before submit). Strip them here so they are
 * never treated as placement columns.
 */
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
 * Build + validate the full create payload. Returns either `{ data }` or
 * `{ error }` with a human-readable 400 message. Counters (impressions /
 * clicks) are deliberately NOT read from the body — they are written only
 * by the fire-and-forget public counters.
 */
function placementData(
  body: any,
  adminId?: string,
): { data?: Record<string, unknown>; error?: string } {
  const kind = body?.kind;
  if (!PLACEMENT_KINDS.includes(kind)) {
    return { error: "Placement kind must be 'mover' or 'provider'." };
  }
  const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : "";
  if (!targetId || targetId.length > 30) {
    return { error: "A target (mover or provider) is required." };
  }
  // FTC clear-and-conspicuous disclosure: a placement can never persist
  // with a blank label. Default is "Sponsored"; an explicit empty string
  // is rejected rather than silently coerced so the operator notices.
  const label =
    body?.label === undefined ? "Sponsored" : normalizeOptionalString(body.label, 60);
  if (!label) {
    return { error: "Disclosure label is required (e.g. 'Sponsored'). FTC labeling is mandatory." };
  }
  if (body?.stateScope && !normalizeStateScope(body.stateScope)) {
    return { error: "State scope must be a 2-letter state code, or blank for all states." };
  }
  const startsAt = body?.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body?.endsAt ? new Date(body.endsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime()) || !endsAt || Number.isNaN(endsAt.getTime())) {
    return { error: "A valid start and end date are required." };
  }
  if (endsAt <= startsAt) {
    return { error: "End date must be after the start date." };
  }
  const data: Record<string, unknown> = {
    kind,
    targetId,
    label,
    categoryScope: kind === "provider" ? normalizeOptionalString(body?.categoryScope, 50) : null,
    stateScope: body?.stateScope ? normalizeStateScope(body.stateScope) : null,
    startsAt,
    endsAt,
    active: body?.active === true,
  };
  if (adminId) data.createdByAdminId = adminId;
  return { data };
}

/**
 * Verify the target exists and clears the eligibility gate. Applies to
 * BOTH kinds: a placement pointing at a missing/ineligible target would
 * silently render nothing (the public reader fails closed), so refuse it
 * here where the operator can see why.
 */
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

/**
 * Surfaces render at most ONE placement, so two active placements with the
 * same kind + same state scope (exact match, null = national) overlapping
 * in time means one of them silently never renders. Refuse with 409 — the
 * operator should end the old one first. A national (null-scope) and a
 * state-targeted placement may coexist: the reader prefers the targeted one.
 */
async function findActivePlacementConflict(
  client: any,
  candidate: { kind: string; stateScope: string | null; startsAt: Date | string; endsAt: Date | string; active: boolean },
  excludeId?: string,
) {
  if (!candidate.active) return null;
  const placements = await client.sponsoredPlacement.findMany({
    where: {
      kind: candidate.kind,
      active: true,
      stateScope: candidate.stateScope ?? null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, startsAt: true, endsAt: true },
  });
  return (
    placements.find((placement: any) =>
      windowsOverlap(candidate.startsAt, candidate.endsAt, placement.startsAt, placement.endsAt),
    ) || null
  );
}

/**
 * Attach a display summary of each placement's target. Loose refs (no FK)
 * mean the target may have vanished — return `target: null` rather than
 * dropping the row so the admin can see and clean up the orphan.
 */
async function hydrateTargets(placements: any[]) {
  const moverIds = placements.filter((p) => p.kind === "mover").map((p) => p.targetId);
  const providerIds = placements.filter((p) => p.kind === "provider").map((p) => p.targetId);
  const [movers, providers] = await Promise.all([
    moverIds.length
      ? (prisma as any).movingCompany.findMany({
          where: { id: { in: moverIds } },
          select: { id: true, legalName: true, dbaName: true, usdotNumber: true, state: true, active: true },
        })
      : [],
    providerIds.length
      ? (prisma as any).serviceProvider.findMany({
          where: { id: { in: providerIds } },
          select: { id: true, name: true, category: true, isActive: true },
        })
      : [],
  ]);
  const moverMap = new Map<string, any>(movers.map((m: any) => [m.id, m] as [string, any]));
  const providerMap = new Map<string, any>(providers.map((p: any) => [p.id, p] as [string, any]));
  return placements.map((placement) => {
    if (placement.kind === "mover") {
      const mover: any = moverMap.get(placement.targetId);
      return {
        ...placement,
        target: mover
          ? { name: mover.dbaName || mover.legalName, detail: `USDOT ${mover.usdotNumber} · ${mover.state}`, active: mover.active }
          : null,
      };
    }
    const provider: any = providerMap.get(placement.targetId);
    return {
      ...placement,
      target: provider
        ? { name: provider.name, detail: provider.category, active: provider.isActive }
        : null,
    };
  });
}

/** Target picker search — movers by USDOT number or name, providers by name. */
async function searchTargets(kind: PlacementKind, q: string) {
  const query = q.trim();
  if (!query) return [];
  if (kind === "mover") {
    const usdot = /^\d+$/.test(query) ? Number.parseInt(query, 10) : null;
    const movers = await (prisma as any).movingCompany.findMany({
      where: {
        active: true,
        hhgAuthorization: true,
        OR: [
          ...(usdot !== null && Number.isSafeInteger(usdot) ? [{ usdotNumber: usdot }] : []),
          { legalName: { contains: query } },
          { dbaName: { contains: query } },
        ],
      },
      orderBy: [{ fleetSize: "desc" }, { legalName: "asc" }],
      take: 10,
      select: {
        id: true,
        usdotNumber: true,
        legalName: true,
        dbaName: true,
        state: true,
        city: true,
        complaintCount2y: true,
        safetyRating: true,
      },
    });
    return movers.map((mover: any) => ({
      id: mover.id,
      name: mover.dbaName || mover.legalName,
      detail: `USDOT ${mover.usdotNumber} · ${mover.city ? `${mover.city}, ` : ""}${mover.state} · ${mover.complaintCount2y} complaints (2y)`,
      eligible: mover.complaintCount2y <= MOVER_MAX_COMPLAINTS_2Y,
    }));
  }
  const providers = await (prisma as any).serviceProvider.findMany({
    where: { isActive: true, name: { contains: query } },
    orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
    take: 10,
    select: { id: true, name: true, category: true },
  });
  return providers.map((provider: any) => ({
    id: provider.id,
    name: provider.name,
    detail: provider.category,
    eligible: true,
  }));
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { searchParams } = new URL(request.url);

    // Target-picker mode: /api/sponsored?targetSearch=acme&kind=mover
    const targetSearch = searchParams.get("targetSearch");
    if (targetSearch !== null) {
      const kind = searchParams.get("kind") === "provider" ? "provider" : "mover";
      const targets = await searchTargets(kind, targetSearch);
      return NextResponse.json({ targets });
    }

    const status = searchParams.get("status"); // active | scheduled | expired | inactive
    const kind = searchParams.get("kind");
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number.parseInt(searchParams.get("pageSize") || "50", 10) || 50),
    );

    const now = new Date();
    const where: Record<string, unknown> = {};
    if (kind && PLACEMENT_KINDS.includes(kind as PlacementKind)) where.kind = kind;
    if (status === "active") {
      where.active = true;
      where.startsAt = { lte: now };
      where.endsAt = { gte: now };
    } else if (status === "scheduled") {
      where.active = true;
      where.startsAt = { gt: now };
    } else if (status === "expired") {
      where.endsAt = { lt: now };
    } else if (status === "inactive") {
      where.active = false;
    }

    const [placements, total] = await Promise.all([
      (prisma as any).sponsoredPlacement.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      (prisma as any).sponsoredPlacement.count({ where }),
    ]);
    const hydrated = await hydrateTargets(placements);
    return NextResponse.json({ placements: hydrated, total, page, pageSize });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to fetch sponsored placements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("providers", "canCreate", { minimumRole: "ADMIN" });
    const body = await request.json().catch(() => ({}));
    const requestMeta = getAuditRequestMeta(request);

    // Creating a placement publishes paid ad inventory to a public surface
    // (once SPONSORED_ENABLED is on) — gate behind admin password + MFA
    // step-up, the same bar acquisition campaigns clear.
    const { confirmPassword, mfaCode, backupCode } = extractStepUp(body);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "sponsored_placement_create",
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

    const { data, error } = placementData(body, session.adminId);
    if (error || !data) {
      return NextResponse.json({ error: error || "Invalid placement payload." }, { status: 400 });
    }

    const eligibility = await checkTargetEligibility(
      prisma as any,
      data.kind as PlacementKind,
      data.targetId as string,
    );
    if (!eligibility.ok) {
      return NextResponse.json({ code: "TARGET_NOT_ELIGIBLE", error: eligibility.error }, { status: 422 });
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const conflict = await findActivePlacementConflict(tx, data as any);
      if (conflict) return { conflict };
      const placement = await tx.sponsoredPlacement.create({ data });
      return { placement };
    });
    if (result.conflict) {
      return NextResponse.json(CONFLICT_RESPONSE, { status: 409 });
    }
    await writeAdminAudit(session, {
      action: "SPONSORED_PLACEMENT_CREATE",
      entityType: "SponsoredPlacement",
      entityId: result.placement.id,
      after: {
        kind: result.placement.kind,
        targetId: result.placement.targetId,
        stateScope: result.placement.stateScope,
        active: result.placement.active,
      },
      metadata: { operation: "sponsored_placement_create" },
      request: requestMeta,
    });
    return NextResponse.json({ placement: result.placement }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to create sponsored placement" }, { status: 500 });
  }
}
