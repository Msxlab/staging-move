export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { resolveConnectorMode, uspsConnector, type AddressConnector } from "@locateflow/connectors";
import { maskRuntimeConfigValue } from "@locateflow/shared";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";

const KEY_RE = /^[a-z][a-z0-9-]*$/;

// Built-in connector adapters the detail view can describe. Mirrors the set the
// list route and healthcheck route wire up; extend together as connectors land.
const CONNECTOR_ADAPTERS: Record<string, AddressConnector> = {
  usps: uspsConnector,
};

// Most-recent dispatch rows surfaced as the connector's call log. Bounded so the
// query stays cheap — the detail view shows the latest activity, not history.
const RECENT_DISPATCH_LIMIT = 25;

/**
 * The two operator-set facts that gate API_SYNC, read from runtime-config (no
 * schema migration): the signed-agreement posture and whether real OAuth
 * credentials are configured. Also returns the MASKED credential previews so the
 * detail view can show configuration without ever echoing a secret. Mirrors the
 * resolver in ../route.ts; kept local so the detail route is self-contained.
 */
async function connectorGate(
  adapter: AddressConnector | undefined,
  key: string,
): Promise<{
  agreementStatus: "NONE" | "SANDBOX" | "PRODUCTION";
  credentialsPresent: boolean;
  credentials: Array<{ key: string; label: string; configured: boolean; masked: string | null }>;
}> {
  const k = key.toUpperCase().replace(/-/g, "_");
  const rc = async (name: string) => (await getAdminRuntimeConfigValue(name)) ?? process.env[name] ?? "";
  const [agreementRaw, clientId, clientSecret, authorizeUrl, tokenUrl] = await Promise.all([
    rc(`CONNECTOR_${k}_AGREEMENT_STATUS`),
    rc(`CONNECTOR_${k}_OAUTH_CLIENT_ID`),
    rc(`CONNECTOR_${k}_OAUTH_CLIENT_SECRET`),
    rc(`CONNECTOR_${k}_OAUTH_AUTHORIZE_URL`),
    rc(`CONNECTOR_${k}_OAUTH_TOKEN_URL`),
  ]);
  const agreementStatus = agreementRaw === "PRODUCTION" || agreementRaw === "SANDBOX" ? agreementRaw : "NONE";
  const hosts = adapter?.manifest.allowedHosts ?? [];
  const credentialsPresent = Boolean(
    adapter &&
      clientId &&
      clientSecret &&
      isAllowedConnectorUrl(authorizeUrl, hosts) &&
      isAllowedConnectorUrl(tokenUrl, hosts),
  );

  // Mask every credential with the shared runtime-config masker — the same
  // truncation the Runtime Config screen uses — so secrets never leave the
  // server in plaintext. Client id/url use lighter strategies; the secret uses
  // the default secret strategy.
  const credentials = [
    { key: `CONNECTOR_${k}_OAUTH_CLIENT_ID`, label: "OAuth client ID", value: clientId, strategy: "id" as const },
    { key: `CONNECTOR_${k}_OAUTH_CLIENT_SECRET`, label: "OAuth client secret", value: clientSecret, strategy: "secret" as const },
    { key: `CONNECTOR_${k}_OAUTH_AUTHORIZE_URL`, label: "OAuth authorize URL", value: authorizeUrl, strategy: "url" as const },
    { key: `CONNECTOR_${k}_OAUTH_TOKEN_URL`, label: "OAuth token URL", value: tokenUrl, strategy: "url" as const },
  ].map((c) => ({
    key: c.key,
    label: c.label,
    configured: Boolean(c.value),
    masked: c.value ? maskRuntimeConfigValue(c.value, c.strategy) : null,
  }));

  return { agreementStatus, credentialsPresent, credentials };
}

function isAllowedConnectorUrl(rawUrl: string, allowedHosts: readonly string[]): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && allowedHosts.includes(url.host.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * GET /api/connectors/[connectorKey] — the full per-connector detail bundle the
 * admin detail view renders: identity + manifest, the control-plane row, honest
 * mode + gate inputs, MASKED credential previews, the per-status dispatch
 * breakdown, the latest dispatch rows (call log, token/payload columns never
 * selected), consent adoption, the last failure, and any fallback actions.
 *
 * Read-only — `connectors:canRead` (ADMIN floor), same as the list route. Every
 * mutation still goes through the existing step-up + audited routes.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ connectorKey: string }> }) {
  try {
    await requirePermission("connectors", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });

    const { connectorKey } = await params;
    if (typeof connectorKey !== "string" || !KEY_RE.test(connectorKey)) {
      return NextResponse.json({ error: "connectorKey is required" }, { status: 400 });
    }

    const adapter = CONNECTOR_ADAPTERS[connectorKey];
    const [config, dispatchByStatus, recentDispatches, consentRows, lastFailureRow, fallbacks] = await Promise.all([
      prisma.connectorConfig.findUnique({ where: { connectorKey } }),
      prisma.connectorDispatch.groupBy({
        by: ["status"],
        where: { connectorKey, isShadow: false },
        _count: { _all: true },
      }),
      prisma.connectorDispatch.findMany({
        where: { connectorKey },
        // Safe columns only — never the encrypted token, confirmation, or payload.
        select: {
          id: true,
          status: true,
          isShadow: true,
          attemptCount: true,
          lastErrorCode: true,
          eventId: true,
          nextRetryAt: true,
          dispatchedAt: true,
          confirmedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: RECENT_DISPATCH_LIMIT,
      }),
      prisma.partnerConsent.groupBy({
        by: ["status"],
        where: { connectorKey },
        _count: { _all: true },
      }),
      prisma.connectorDispatch.findFirst({
        where: { connectorKey, lastErrorCode: { not: null }, isShadow: false },
        select: { lastErrorCode: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.connectorFallbackAction.findMany({
        where: { connectorKey },
        orderBy: { actionKey: "asc" },
      }),
    ]);

    // A connector unknown to both the registry and the control plane is a 404 —
    // there is nothing to show.
    if (!adapter && !config) {
      return NextResponse.json({ error: "Connector not found" }, { status: 404 });
    }

    const gate = await connectorGate(adapter, connectorKey);
    const resolved = resolveConnectorMode({
      addressUpdatePush: adapter?.manifest.capabilities.addressUpdatePush ?? false,
      agreementStatus: gate.agreementStatus,
      credentialsPresent: gate.credentialsPresent,
      enabled: config?.enabled ?? false,
      stage: config?.stage ?? "SHADOW",
    });

    const dispatchCounts: Record<string, number> = {};
    for (const row of dispatchByStatus) dispatchCounts[row.status] = row._count._all;

    const consentCounts: Record<string, number> = {};
    for (const row of consentRows) consentCounts[row.status] = row._count._all;

    const manifest = adapter
      ? {
          key: adapter.manifest.key,
          version: adapter.manifest.version,
          displayName: adapter.manifest.displayName,
          authType: adapter.manifest.auth.type,
          authScopes: adapter.manifest.auth.scopes ?? [],
          allowedHosts: adapter.manifest.allowedHosts,
          requiredFields: adapter.manifest.requiredFields,
          capabilities: adapter.manifest.capabilities,
          rateLimit: adapter.manifest.rateLimit ?? null,
          requiresOrigin: adapter.manifest.requiresOrigin ?? false,
          fallbackActionKey: adapter.manifest.fallbackActionKey ?? null,
          hasHealthCheck: typeof adapter.healthCheck === "function",
        }
      : null;

    return NextResponse.json({
      connectorKey,
      registered: Boolean(config),
      displayName: adapter?.manifest.displayName ?? connectorKey,
      hasAdapter: Boolean(adapter),
      manifest,
      config: config
        ? {
            id: config.id,
            connectorKey: config.connectorKey,
            version: config.version,
            enabled: config.enabled,
            rolloutPercent: config.rolloutPercent,
            circuitState: config.circuitState,
            stage: config.stage,
            notes: config.notes,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
          }
        : null,
      mode: resolved.mode,
      modeReason: resolved.reason,
      gate: { agreementStatus: gate.agreementStatus, credentialsPresent: gate.credentialsPresent },
      credentials: gate.credentials,
      dispatchCounts,
      recentDispatches,
      consentCounts,
      lastFailure: lastFailureRow?.lastErrorCode
        ? { errorCode: lastFailureRow.lastErrorCode, status: lastFailureRow.status, at: lastFailureRow.updatedAt }
        : null,
      fallbacks: fallbacks.map((f) => ({
        id: f.id,
        actionKey: f.actionKey,
        type: f.type,
        label: f.label,
        helperText: f.helperText,
        urlTemplate: f.urlTemplate,
        locale: f.locale,
        enabled: f.enabled,
      })),
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
