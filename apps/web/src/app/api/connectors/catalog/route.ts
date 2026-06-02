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

  const connectors = adapters
    .map((adapter) => {
      const cfg = configByKey.get(adapter.manifest.key);
      const resolved = resolveConnectorMode({
        addressUpdatePush: adapter.manifest.capabilities.addressUpdatePush,
        agreementStatus: "NONE",
        credentialsPresent: false,
        enabled: cfg?.enabled ?? false,
        stage: cfg?.stage ?? "SHADOW",
      });
      return { connectorKey: adapter.manifest.key, displayName: adapter.manifest.displayName, mode: resolved.mode };
    })
    .filter((c) => c.mode !== "DISABLED");

  return NextResponse.json({ connectors }, { headers: { "Cache-Control": "no-store" } });
}
