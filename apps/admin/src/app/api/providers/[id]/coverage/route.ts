import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { writeAdminAudit, getAuditRequestMeta } from "@/lib/audit";
import {
  rebuildProviderCoverage,
  getProviderCoverageMetadata,
} from "@locateflow/db";
import { expandCoverageRows, safeJsonArray } from "@locateflow/shared";

// Coverage models the admin editor + matcher understand. Kept in sync with
// apps/web/src/lib/provider-matching.ts (ZipMatchLevel-ish) and the curated
// seed metadata. "zip_exact" is accepted as an alias for "zip_prefix" because
// the underlying ServiceProviderCoverage rows already split exact vs prefix on
// ZIP length — the model field is the *intent* label, not the row shape.
const COVERAGE_MODELS = new Set(["state", "zip_prefix", "polygon", "live_address"]);
const PROVIDER_SCOPES = new Set(["FEDERAL", "STATE"]);
const US_STATE_RE = /^[A-Z]{2}$/;

function normalizeModel(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  if (v === "zip_exact") return "zip_prefix";
  return COVERAGE_MODELS.has(v) ? v : undefined;
}

function coerceStateList(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : safeJsonArray(value);
  return Array.from(
    new Set(
      arr
        .map((s) => (typeof s === "string" ? s.trim().toUpperCase() : ""))
        .filter((s) => US_STATE_RE.test(s)),
    ),
  );
}

function coerceZipList(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : safeJsonArray(value);
  return Array.from(
    new Set(
      arr
        .map((z) => (typeof z === "string" ? z.replace(/\D/g, "") : ""))
        .filter((z) => z.length >= 3 && z.length <= 5),
    ),
  );
}

async function loadCoverageSummary(id: string) {
  const provider = await prisma.serviceProvider.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      scope: true,
      states: true,
      zipCodes: true,
      coverageModel: true,
      version: true,
    },
  });
  if (!provider) return null;

  const coverages = await prisma.serviceProviderCoverage.findMany({
    where: { providerId: id },
    select: { state: true, zipPrefix: true, zipExact: true },
  });

  const metadata = getProviderCoverageMetadata(provider.slug);
  const zipCodes = safeJsonArray(provider.zipCodes);
  const effectiveModel =
    provider.coverageModel ||
    metadata?.coverageModel ||
    (zipCodes.length > 0 ? "zip_prefix" : "state");

  const stateRows = coverages.filter((c) => c.state && !c.zipPrefix && !c.zipExact).length;
  const prefixRows = coverages.filter((c) => c.zipPrefix).length;
  const exactRows = coverages.filter((c) => c.zipExact).length;
  const coverageStates = Array.from(
    new Set(coverages.map((c) => c.state).filter((s): s is string => Boolean(s))),
  ).sort();

  return {
    provider: {
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      category: provider.category,
      scope: provider.scope,
      states: safeJsonArray(provider.states),
      zipCodes,
      coverageModel: provider.coverageModel,
      effectiveModel,
      version: provider.version,
    },
    coverage: {
      totalRows: coverages.length,
      stateRows,
      prefixRows,
      exactRows,
      coverageStates,
    },
    metadata: metadata
      ? {
          coverageModel: metadata.coverageModel,
          note: metadata.note,
          officialUrl: metadata.officialUrl,
          source: metadata.source,
          hasPolygons: Boolean(metadata.polygons && metadata.polygons.length > 0),
        }
      : null,
  };
}

/**
 * GET — read a provider's current coverage state (rows + effective model).
 * Permission-gated read only (no step-up). Powers the coverage editor on the
 * provider detail view.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;
    const summary = await loadCoverageSummary(id);
    if (!summary) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load coverage" }, { status: 500 });
  }
}

/**
 * PATCH — edit a provider's coverage: scope, per-state list, ZIP/prefix lists,
 * and the coverage model. Persists by rewriting (scope, states, zipCodes,
 * coverageModel) on the provider row AND rebuilding just this provider's
 * ServiceProviderCoverage rows via expandCoverageRows -> rebuildProviderCoverage
 * inside one transaction.
 *
 * Mutating where a provider appears in user search is sensitive, so this
 * requires step-up confirmation (password + MFA) and writes an audit row.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("providers", "canUpdate", {
      minimumRole: "MODERATOR",
    });
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid coverage payload" }, { status: 400 });
    }

    const requestMeta = getAuditRequestMeta(request);

    const confirm = await requirePasswordConfirm(session, body.confirmPassword, {
      operation: "provider_coverage_edit",
      requireMfa: true,
      mfaCode: typeof body.mfaCode === "string" ? body.mfaCode : undefined,
      backupCode: typeof body.backupCode === "string" ? body.backupCode : undefined,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const existing = await prisma.serviceProvider.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        scope: true,
        states: true,
        zipCodes: true,
        coverageModel: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const scope =
      body.scope !== undefined
        ? String(body.scope).trim().toUpperCase()
        : existing.scope;
    if (!PROVIDER_SCOPES.has(scope)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const states =
      body.states !== undefined ? coerceStateList(body.states) : safeJsonArray(existing.states);
    const zipCodes =
      body.zipCodes !== undefined ? coerceZipList(body.zipCodes) : safeJsonArray(existing.zipCodes);

    const model = normalizeModel(body.coverageModel);
    if (model === undefined && body.coverageModel !== undefined) {
      return NextResponse.json({ error: "Invalid coverage model" }, { status: 400 });
    }
    const nextModel =
      body.coverageModel !== undefined ? model ?? null : existing.coverageModel;

    // FEDERAL providers cover all states; clear the per-state list so the row
    // shape stays consistent (matching uses scope='FEDERAL' directly).
    const effectiveStates = scope === "FEDERAL" ? [] : states;

    const before = {
      scope: existing.scope,
      states: safeJsonArray(existing.states),
      zipCodes: safeJsonArray(existing.zipCodes),
      coverageModel: existing.coverageModel,
    };

    const rowCount = await prisma.$transaction(async (tx: any) => {
      await tx.serviceProvider.update({
        where: { id },
        data: {
          scope,
          states: JSON.stringify(effectiveStates),
          zipCodes: JSON.stringify(zipCodes),
          coverageModel: nextModel,
        },
      });
      return rebuildProviderCoverage(tx, {
        providerId: id,
        scope,
        states: effectiveStates,
        zipCodes,
      });
    });

    await writeAdminAudit(session, {
      action: "UPDATE_PROVIDER_COVERAGE",
      entityType: "ServiceProvider",
      entityId: id,
      before,
      after: {
        scope,
        states: effectiveStates,
        zipCodes,
        coverageModel: nextModel,
      },
      metadata: { rebuiltRows: rowCount, providerName: existing.name },
      request: requestMeta,
    });

    revalidateTag("providers", "default");

    const summary = await loadCoverageSummary(id);
    return NextResponse.json({ success: true, rebuiltRows: rowCount, ...summary });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update coverage" }, { status: 500 });
  }
}
