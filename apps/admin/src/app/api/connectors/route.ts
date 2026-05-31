export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";

// Connector config changes are reversible by the same operator (flip enabled
// back, re-PUT the rollout %), so — like feature flags — step-up is required
// but the cache TTL is wider so an operator working an incident enters their
// password once, not every ten minutes.
const CONNECTOR_STEP_UP_GRACE_MS = 60 * 60 * 1000;

const KEY_RE = /^[a-z][a-z0-9-]*$/;
const STAGES = ["SHADOW", "ROLLOUT", "GA", "RETIRED"] as const;
const CIRCUIT_STATES = ["CLOSED", "OPEN", "HALF_OPEN", "DISABLED"] as const;

function clampPercent(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** GET — list the connector control-plane rows. */
export async function GET() {
  try {
    await requirePermission("connectors", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const [connectors, dispatchCounts] = await Promise.all([
      prisma.connectorConfig.findMany({ orderBy: { connectorKey: "asc" } }),
      prisma.connectorDispatch.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    // Dispatch (outbox) health for ops: how many syncs are queued / confirmed /
    // stuck needing the user — so a failing connector is visible, not silent.
    const dispatchHealth = Object.fromEntries(dispatchCounts.map((c) => [c.status, c._count._all]));
    return NextResponse.json({ connectors, dispatchHealth });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST — register a connector in the control plane (starts disabled/SHADOW). */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("connectors", "canCreate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { connectorKey, version, enabled, stage, rolloutPercent, notes, confirmPassword } = await req.json();

    if (typeof connectorKey !== "string" || !KEY_RE.test(connectorKey)) {
      return NextResponse.json({ error: "connectorKey must be lowercase kebab-case" }, { status: 400 });
    }
    if (typeof version !== "string" || !version.trim()) {
      return NextResponse.json({ error: "version is required" }, { status: 400 });
    }

    const confirm = await requirePasswordConfirm(session, confirmPassword, { operation: "connector_config_write", maxAgeMs: CONNECTOR_STEP_UP_GRACE_MS });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const existing = await prisma.connectorConfig.findUnique({ where: { connectorKey } });
    if (existing) return NextResponse.json({ error: "Connector already registered" }, { status: 409 });

    const connector = await prisma.connectorConfig.create({
      data: {
        connectorKey,
        version,
        enabled: enabled === true,
        stage: STAGES.includes(stage) ? stage : "SHADOW",
        rolloutPercent: clampPercent(rolloutPercent) ?? 0,
        notes: typeof notes === "string" ? notes : null,
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE_CONNECTOR_CONFIG",
        entityType: "ConnectorConfig",
        entityId: connector.id,
        changes: JSON.stringify({ connectorKey, version, enabled: connector.enabled, stage: connector.stage }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json(connector);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** PUT — toggle the kill switch / rollout / stage / circuit for one connector. */
export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermission("connectors", "canUpdate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { connectorKey, enabled, rolloutPercent, stage, circuitState, notes, confirmPassword } = await req.json();
    if (typeof connectorKey !== "string" || !KEY_RE.test(connectorKey)) {
      return NextResponse.json({ error: "connectorKey is required" }, { status: 400 });
    }

    const confirm = await requirePasswordConfirm(session, confirmPassword, { operation: "connector_config_write", maxAgeMs: CONNECTOR_STEP_UP_GRACE_MS });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const existing = await prisma.connectorConfig.findUnique({ where: { connectorKey } });
    if (!existing) return NextResponse.json({ error: "Connector not found" }, { status: 404 });

    const pct = clampPercent(rolloutPercent);
    const connector = await prisma.connectorConfig.update({
      where: { connectorKey },
      data: {
        enabled: typeof enabled === "boolean" ? enabled : undefined,
        rolloutPercent: pct,
        stage: STAGES.includes(stage) ? stage : undefined,
        circuitState: CIRCUIT_STATES.includes(circuitState) ? circuitState : undefined,
        notes: typeof notes === "string" ? notes : undefined,
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE_CONNECTOR_CONFIG",
        entityType: "ConnectorConfig",
        entityId: connector.id,
        changes: JSON.stringify({
          connectorKey,
          before: { enabled: existing.enabled, rolloutPercent: existing.rolloutPercent, stage: existing.stage, circuitState: existing.circuitState },
          after: { enabled: connector.enabled, rolloutPercent: connector.rolloutPercent, stage: connector.stage, circuitState: connector.circuitState },
        }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json(connector);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
