import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { connectorRegistry } from "@/lib/connector-registry";
import { userHasApiConnectorEntitlement } from "@/lib/connector-oauth";
import { getGuidedConnectorAction, type GuidedConnectorAction } from "@/lib/guided-connector-actions";
import { resolveConnectorMode, type AddressConnector, type ConnectorMode } from "@locateflow/connectors";

export const runtime = "nodejs";

async function isApiConnectorsEnabled(): Promise<boolean> {
  const value = (await getRuntimeConfigValue("FEATURE_API_CONNECTORS")) ?? process.env.FEATURE_API_CONNECTORS ?? "";
  return value === "true" || value === "1";
}

async function safeApiSyncEntitlement(userId: string): Promise<boolean> {
  try {
    return await userHasApiConnectorEntitlement(userId);
  } catch {
    return false;
  }
}

// The facts that gate API_SYNC, read from runtime-config (operator-set). Default
// to safe values so a connector stays GUIDED until a PRODUCTION agreement AND
// credentials are recorded — the legal gate, enforced in code.
async function connectorGateInputs(
  adapter: AddressConnector,
  key: string,
): Promise<{ agreementStatus: "NONE" | "SANDBOX" | "PRODUCTION"; credentialsPresent: boolean }> {
  const k = key.toUpperCase().replace(/-/g, "_");
  const rc = async (name: string) => (await getRuntimeConfigValue(name)) ?? process.env[name] ?? "";
  const [agreementRaw, clientId, clientSecret, authorizeUrl, tokenUrl] = await Promise.all([
    rc(`CONNECTOR_${k}_AGREEMENT_STATUS`),
    rc(`CONNECTOR_${k}_OAUTH_CLIENT_ID`),
    rc(`CONNECTOR_${k}_OAUTH_CLIENT_SECRET`),
    rc(`CONNECTOR_${k}_OAUTH_AUTHORIZE_URL`),
    rc(`CONNECTOR_${k}_OAUTH_TOKEN_URL`),
  ]);
  const agreementStatus = agreementRaw === "PRODUCTION" || agreementRaw === "SANDBOX" ? agreementRaw : "NONE";
  const credentialsPresent = Boolean(
    clientId &&
      clientSecret &&
      isAllowedConnectorUrl(authorizeUrl, adapter.manifest.allowedHosts) &&
      isAllowedConnectorUrl(tokenUrl, adapter.manifest.allowedHosts),
  );
  return { agreementStatus, credentialsPresent };
}

function isAllowedConnectorUrl(rawUrl: string, allowedHosts: readonly string[]): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && allowedHosts.includes(url.host.toLowerCase());
  } catch {
    return false;
  }
}

interface GuidedPartnerEntry {
  key: string;
  name: string;
  category?: string;
  comingSoon?: boolean;
}

/**
 * No-code GUIDED partners — operator-defined via the GUIDED_PARTNERS runtime-
 * config JSON (an array of { key, name, comingSoon? }). No adapter code, no DB
 * migration: a guided partner has no API, so it surfaces as "Guided update"
 * (or "Coming soon"), letting the partner network grow without engineering per
 * partner. Malformed JSON yields nothing rather than crashing the catalog.
 */
async function guidedPartners(): Promise<Array<{ connectorKey: string; displayName: string; mode: ConnectorMode; guidedAction: null }>> {
  const raw = (await getRuntimeConfigValue("GUIDED_PARTNERS")) ?? process.env.GUIDED_PARTNERS ?? "";
  if (!raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Array<{ connectorKey: string; displayName: string; mode: ConnectorMode; guidedAction: null }> = [];
  for (const p of parsed as GuidedPartnerEntry[]) {
    if (!p || typeof p.key !== "string" || !/^[a-z][a-z0-9-]*$/.test(p.key) || typeof p.name !== "string") continue;
    out.push({ connectorKey: p.key, displayName: p.name, mode: p.comingSoon ? "COMING_SOON" : "GUIDED_UPDATE", guidedAction: null });
  }
  return out;
}

function guidedActionFor(adapter: AddressConnector, mode: ConnectorMode): GuidedConnectorAction | null {
  if (mode !== "GUIDED_UPDATE") return null;
  return getGuidedConnectorAction(adapter.manifest.fallbackActionKey);
}

/**
 * GET /api/connectors/catalog
 *
 * The honest partner catalog for the Connections screen: every registered
 * connector with its DERIVED operating mode (resolveConnectorMode — the single
 * source of truth), never a hand-set claim. agreementStatus + credentialsPresent
 * wire in from the DB field + the OAuth loader later; until a real production
 * agreement exists they are NONE/false, so a partner shows as "Guided update" /
 * "Coming soon", never "API sync". Kill-switched/retired (DISABLED) connectors
 * are omitted — we don't advertise something a user can't use. No user data
 * here; the caller's own consents come from /api/partner-consents.
 */
export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  // Master flag off -> the surface is inert; offer nothing.
  if (!(await isApiConnectorsEnabled())) {
    return NextResponse.json({ connectors: [], entitlement: { apiSync: false } }, { headers: { "Cache-Control": "no-store" } });
  }
  const apiSyncEntitled = await safeApiSyncEntitlement(session.userId);

  const adapters = connectorRegistry.list();
  const configs = await prisma.connectorConfig.findMany({
    where: { connectorKey: { in: adapters.map((a) => a.manifest.key) } },
    select: { connectorKey: true, enabled: true, stage: true },
  });
  const configByKey = new Map(configs.map((c) => [c.connectorKey, c]));

  const resolvedAll = await Promise.all(
    adapters.map(async (adapter) => {
      const cfg = configByKey.get(adapter.manifest.key);
      const gate = await connectorGateInputs(adapter, adapter.manifest.key);
      const r = resolveConnectorMode({
        addressUpdatePush: adapter.manifest.capabilities.addressUpdatePush,
        agreementStatus: gate.agreementStatus,
        credentialsPresent: gate.credentialsPresent,
        enabled: cfg?.enabled ?? false,
        stage: cfg?.stage ?? "SHADOW",
      });
      return {
        connectorKey: adapter.manifest.key,
        displayName: adapter.manifest.displayName,
        mode: r.mode,
        guidedAction: guidedActionFor(adapter, r.mode),
      };
    }),
  );
  const connectors = resolvedAll.filter((c) => c.mode !== "DISABLED");

  // Merge operator-defined no-code GUIDED partners. A guided entry never
  // overrides a real registered connector that shares its key.
  const present = new Set(connectors.map((c) => c.connectorKey));
  for (const g of await guidedPartners()) {
    if (!present.has(g.connectorKey)) connectors.push(g);
  }

  return NextResponse.json(
    { connectors, entitlement: { apiSync: apiSyncEntitled } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
