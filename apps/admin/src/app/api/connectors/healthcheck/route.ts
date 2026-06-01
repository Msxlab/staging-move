export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import {
  createConnectorHttpClient,
  uspsConnector,
  type AddressConnector,
  type ConnectorContext,
  type ConnectorLogger,
} from "@locateflow/connectors";

const KEY_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Built-in connector adapters the ops console can canary. This mirrors the set
 * the web app wires into its dispatch registry; extend it as new connector
 * packages land. (Live, per-user-token dispatch runs web-side — this admin
 * endpoint is the TOKENLESS drift canary the `healthCheck()` hook is designed
 * for: "is the partner API reachable and is its contract still the shape we
 * mapped?", answerable without anyone's grant.)
 */
const CONNECTORS: Record<string, AddressConnector> = {
  usps: uspsConnector,
};

// Health checks must not leak partner detail into admin logs; the canary needs
// no logging of its own, so feed the connector a silent logger.
const silentLogger: ConnectorLogger = { info() {}, warn() {}, error() {} };

/**
 * POST — run a connector's health-check canary and return the normalized
 * result. Read-only/non-mutating, so it needs `canRead` but no step-up: an
 * operator clicks "Test" often and the endpoint changes nothing.
 *
 * No SSRF surface: the operator only picks a connectorKey from a fixed set; the
 * URL hit is the connector's own hard-coded, allowlisted endpoint, and the
 * injected client rejects egress to anything outside `manifest.allowedHosts`.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission("connectors", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });

    const body = await req.json().catch(() => ({}));
    const connectorKey = body?.connectorKey;
    if (typeof connectorKey !== "string" || !KEY_RE.test(connectorKey)) {
      return NextResponse.json({ error: "connectorKey is required" }, { status: 400 });
    }

    const connector = CONNECTORS[connectorKey];
    if (!connector?.healthCheck) {
      // Either no built-in adapter, or the adapter declares no canary. Report it
      // as a result (not an error) so the UI can show "no health check".
      return NextResponse.json({
        connectorKey,
        ok: false,
        reason: "NOT_SUPPORTED",
        detail: connector ? "Connector has no health check." : "No built-in adapter for this key.",
        checkedAt: new Date().toISOString(),
      });
    }

    const http = createConnectorHttpClient({
      allowedHosts: connector.manifest.allowedHosts,
      timeoutMs: 10_000,
    });
    const ctx: ConnectorContext = {
      accessToken: null,
      idempotencyKey: `healthcheck:${connectorKey}:${Date.now()}`,
      http,
      logger: silentLogger,
    };

    const result = await connector.healthCheck(ctx);
    return NextResponse.json({ connectorKey, checkedAt: new Date().toISOString(), ...result });
  } catch (e: any) {
    if (e?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // A throw from the canary itself is a health signal, not a 500 — surface it.
    return NextResponse.json(
      { ok: false, reason: "PARTNER_DOWN", detail: "Health check failed to run.", checkedAt: new Date().toISOString() },
      { status: 200 },
    );
  }
}
