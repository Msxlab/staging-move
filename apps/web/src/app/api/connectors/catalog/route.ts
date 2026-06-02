import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { connectorRegistry } from "@/lib/connector-registry";
import { resolveConnectorMode } from "@locateflow/connectors";

export const runtime = "nodejs";

async function isApiConnectorsEnabled(): Promise<boolean> {
  const value = (await getRuntimeConfigValue("FEATURE_API_CONNECTORS")) ?? process.env.FEATURE_API_CONNECTORS ?? "";
  return value === "true" || value === "1";
}

// The facts that gate API_SYNC, read from runtime-config (operator-set). Default
// to safe values so a connector stays GUIDED until a PRODUCTION agreement AND
// credentials are recorded — the legal gate, enforced in code.
async function connectorGateInputs(
  key: string,
): Promise<{ agreementStatus: "NONE" | "SANDBOX" | "PRODUCTION"; credentialsPresent: boolean }> {
  const k = key.toUpperCase().replace(/-/g, "_");
  const rc = async (name: string) => (await getRuntimeConfigValue(name)) ?? process.env[name] ?? "";
  const agreementRaw = await rc(`CONNECTOR_${k}_AGREEMENT_STATUS`);
  const agreementStatus = agreementRaw === "PRODUCTION" || agreementRaw === "SANDBOX" ? agreementRaw : "NONE";
  const credentialsPresent = Boolean((await rc(`CONNECTOR_${k}_OAUTH_CLIENT_ID`)) && (await rc(`CONNECTOR_${k}_OAUTH_CLIENT_SECRET`)));
  return { agreementStatus, credentialsPresent };
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

  // Master flag off → the surface is inert; offer nothing.
  if (!(await isApiConnectorsEnabled())) {
    return NextResponse.json({ connectors: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const adapters = connectorRegistry.list();
  const configs = await prisma.connectorConfig.findMany({
    where: { connectorKey: { in: adapters.map((a) => a.manifest.key) } },
    select: { connectorKey: true, enabled: true, stage: true },
  });
  const configByKey = new Map(configs.map((c) => [c.connectorKey, c]));

  const resolvedAll = await Promise.all(
    adapters.map(async (adapter) => {
      const cfg = configByKey.get(adapter.manifest.key);
      const gate = await connectorGateInputs(adapter.manifest.key);
      const r = resolveConnectorMode({
        addressUpdatePush: adapter.manifest.capabilities.addressUpdatePush,
        agreementStatus: gate.agreementStatus,
        credentialsPresent: gate.credentialsPresent,
        enabled: cfg?.enabled ?? false,
        stage: cfg?.stage ?? "SHADOW",
      });
      return { connectorKey: adapter.manifest.key, displayName: adapter.manifest.displayName, mode: r.mode };
    }),
  );
  const connectors = resolvedAll.filter((c) => c.mode !== "DISABLED");

  return NextResponse.json({ connectors }, { headers: { "Cache-Control": "no-store" } });
}
