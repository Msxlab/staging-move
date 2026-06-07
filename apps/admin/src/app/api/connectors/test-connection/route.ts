export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";
import {
  buildClientCredentialsBody,
  buildUspsAddressValidateUrl,
  parseUspsValidatedAddress,
} from "@locateflow/connectors";

/**
 * POST /api/connectors/test-connection — verify the USPS OAuth CREDENTIALS work
 * (distinct from /healthcheck, which is a tokenless reachability canary). Mints a
 * client_credentials token with the configured creds and runs ONE authenticated
 * sample address validation, so an operator can confirm a fresh credential set
 * before flipping FEATURE_USPS_VALIDATION on. Returns a result (never a 500) and
 * never echoes the secret. canRead — non-mutating.
 */
async function rc(name: string): Promise<string> {
  return (await getAdminRuntimeConfigValue(name)) ?? process.env[name] ?? "";
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("connectors", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });

    // The live credential test is USPS-specific (it mints a client_credentials
    // token and runs a sample USPS address validation). When a connectorKey is
    // supplied, only run for "usps"; any other key is a result, not an error, so
    // the per-connector detail view can show "not supported".
    const body = await req.json().catch(() => ({}));
    const connectorKey = body?.connectorKey;
    if (typeof connectorKey === "string" && connectorKey !== "usps") {
      return NextResponse.json({
        ok: false,
        reason: "NOT_SUPPORTED",
        detail: "Live credential test is only implemented for the USPS connector.",
      });
    }

    const [clientId, clientSecret, tokenUrl] = await Promise.all([
      rc("CONNECTOR_USPS_OAUTH_CLIENT_ID"),
      rc("CONNECTOR_USPS_OAUTH_CLIENT_SECRET"),
      rc("CONNECTOR_USPS_OAUTH_TOKEN_URL"),
    ]);
    if (!clientId || !clientSecret || !tokenUrl) {
      return NextResponse.json({ ok: false, reason: "NOT_CONFIGURED", detail: "USPS OAuth credentials are not set." });
    }
    try {
      const u = new URL(tokenUrl);
      if (u.protocol !== "https:" || u.host.toLowerCase() !== "apis.usps.com") {
        return NextResponse.json({ ok: false, reason: "BAD_TOKEN_URL", detail: "Token URL must be https://apis.usps.com." });
      }
    } catch {
      return NextResponse.json({ ok: false, reason: "BAD_TOKEN_URL", detail: "Token URL is not a valid URL." });
    }

    // 1) Mint a client_credentials token.
    let token: string | null = null;
    try {
      const res = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams(buildClientCredentialsBody({ clientId, clientSecret, scope: "addresses" })).toString(),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return NextResponse.json({ ok: false, reason: "TOKEN_REJECTED", detail: `Token endpoint returned ${res.status}. Check the client id/secret.` });
      }
      const json = (await res.json()) as { access_token?: unknown };
      token = typeof json.access_token === "string" ? json.access_token : null;
    } catch {
      return NextResponse.json({ ok: false, reason: "TOKEN_UNREACHABLE", detail: "Could not reach the USPS token endpoint." });
    }
    if (!token) return NextResponse.json({ ok: false, reason: "NO_TOKEN", detail: "Token endpoint returned no access_token." });

    // 2) Run one authenticated sample validation.
    try {
      const url = buildUspsAddressValidateUrl({ street1: "1 N Glebe Rd", city: "Arlington", state: "VA", zip: "22201" });
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return NextResponse.json({ ok: false, reason: "VALIDATE_REJECTED", detail: `Address API returned ${res.status} with a valid token. Check the OAuth scope/agreement.` });
      }
      const sample = parseUspsValidatedAddress(await res.json());
      return NextResponse.json({
        ok: true,
        reason: "OK",
        detail: "Token minted and a sample address validated successfully.",
        sample,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      return NextResponse.json({ ok: false, reason: "VALIDATE_UNREACHABLE", detail: "Token minted but the Address API was unreachable." });
    }
  } catch (e: any) {
    if (e?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ ok: false, reason: "ERROR", detail: "Test failed to run." }, { status: 200 });
  }
}
