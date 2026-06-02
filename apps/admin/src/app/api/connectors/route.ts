export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { resolveConnectorMode, uspsConnector, type AddressConnector } from "@locateflow/connectors";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";

/**
 * The two facts that gate API_SYNC, read from runtime-config (operator-set, no
 * schema migration): the signed-agreement posture and whether real OAuth
 * credentials are configured. Both default to the safe value, so a connector
 * stays GUIDED until an operator records a PRODUCTION agreement AND credentials.
 */
async function connectorGateInputs(
  key: string,
): Promise<{ agreementStatus: "NONE" | "SANDBOX" | "PRODUCTION"; credentialsPresent: boolean }> {
  const k = key.toUpperCase().replace(/-/g, "_");
  const rc = async (name: string) => (await getAdminRuntimeConfigValue(name)) ?? process.env[name] ?? "";
  const agreementRaw = await rc(`CONNECTOR_${k}_AGREEMENT_STATUS`);
  const agreementStatus = agreementRaw === "PRODUCTION" || agreementRaw === "SANDBOX" ? agreementRaw : "NONE";
  const credentialsPresent = Boolean((await rc(`CONNECTOR_${k}_OAUTH_CLIENT_ID`)) && (await rc(`CONNECTOR_${k}_OAUTH_CLIENT_SECRET`)));
  return { agreementStatus, credentialsPresent };
}

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

// Most-recent errored dispatches scanned for the per-connector "last failure"
// readout. Bounded so the query stays cheap — an operator wants the latest
// error per connector, not a full history (that's what dispatch logs are for).
const RECENT_FAILURE_SCAN = 200;

// Built-in connector adapters (same set the web app dispatches through). Their
// manifest carries the one fact code contributes to mode resolution: whether
// the connector can push server-side at all. A control-plane row with no
// adapter resolves to GUIDED_UPDATE/DISABLED — honest, never API_SYNC.
const CONNECTOR_ADAPTERS: Record<string, AddressConnector> = {
  usps: uspsConnector,
};

/** GET — list the connector control-plane rows + per-connector ops health. */
export async function GET() {
  try {
    await requirePermission("connectors", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const [connectors, dispatchCounts, dispatchByConnectorRows, consentRows, recentFailures] = await Promise.all([
      prisma.connectorConfig.findMany({ orderBy: { connectorKey: "asc" } }),
      prisma.connectorDispatch.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.connectorDispatch.groupBy({ by: ["connectorKey", "status"], _count: { _all: true } }),
      prisma.partnerConsent.groupBy({ by: ["connectorKey", "status"], _count: { _all: true } }),
      prisma.connectorDispatch.findMany({
        where: { lastErrorCode: { not: null } },
        select: { connectorKey: true, lastErrorCode: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: RECENT_FAILURE_SCAN,
      }),
    ]);

    // Global dispatch (outbox) health for the summary strip — kept for
    // backward-compat with the existing client.
    const dispatchHealth = Object.fromEntries(dispatchCounts.map((c) => [c.status, c._count._all]));

    // Per-connector dispatch breakdown: { [connectorKey]: { [status]: count } }
    // so a single failing connector is visible instead of being averaged into
    // the global strip.
    const dispatchByConnector: Record<string, Record<string, number>> = {};
    for (const row of dispatchByConnectorRows) {
      (dispatchByConnector[row.connectorKey] ??= {})[row.status] = row._count._all;
    }

    // Per-connector consent counts by status (GRANTED/REVOKED/EXPIRED) — shows
    // real adoption + how many grants a kill-switch would revoke.
    const consentsByConnector: Record<string, Record<string, number>> = {};
    for (const row of consentRows) {
      (consentsByConnector[row.connectorKey] ??= {})[row.status] = row._count._all;
    }

    // Latest errored dispatch per connector (first wins — rows are newest-first).
    const lastFailureByConnector: Record<string, { errorCode: string; status: string; at: Date }> = {};
    for (const f of recentFailures) {
      if (!lastFailureByConnector[f.connectorKey] && f.lastErrorCode) {
        lastFailureByConnector[f.connectorKey] = { errorCode: f.lastErrorCode, status: f.status, at: f.updatedAt };
      }
    }

    // Honest, derived operating mode per connector — via the single source of
    // truth (resolveConnectorMode) the user Connections screen + marketing copy
    // will also read. agreementStatus + credentialsPresent get wired from the
    // DB field + the OAuth config loader once the connector work lands; until a
    // real partner agreement exists, NONE is the honest value, which forces
    // GUIDED_UPDATE — so a connector can never show "automatic sync" without a
    // signed deal.
    const modeByConnector: Record<string, { mode: string; reason: string }> = {};
    for (const c of connectors) {
      const adapter = CONNECTOR_ADAPTERS[c.connectorKey];
      const gate = await connectorGateInputs(c.connectorKey);
      const resolved = resolveConnectorMode({
        addressUpdatePush: adapter?.manifest.capabilities.addressUpdatePush ?? false,
        agreementStatus: gate.agreementStatus,
        credentialsPresent: gate.credentialsPresent,
        enabled: c.enabled,
        stage: c.stage,
      });
      modeByConnector[c.connectorKey] = { mode: resolved.mode, reason: resolved.reason };
    }

    return NextResponse.json({
      connectors,
      dispatchHealth,
      dispatchByConnector,
      consentsByConnector,
      lastFailureByConnector,
      modeByConnector,
    });
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
