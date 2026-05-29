import { NextRequest, NextResponse } from "next/server";
import { tokenExpiryFrom } from "@locateflow/connectors";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/shared-encryption";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { getConnectorOAuthConfig, refreshConnectorToken } from "@/lib/connector-oauth";

export const runtime = "nodejs";

/** Cron/system auth: Bearer CRON_SECRET. Token refresh is a background job. */
async function isCronAuthorized(request: NextRequest): Promise<boolean> {
  const secret = (await getRuntimeConfigValue("CRON_SECRET")) ?? process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return bearer.length > 0 && bearer === secret;
}

/**
 * POST /api/partner-consents/[id]/refresh
 *
 * Refreshes a consent's access token using the stored refresh token. Called by
 * the scheduler. On unrecoverable failure the consent is marked EXPIRED so the
 * connections UI prompts the user to reconnect rather than silently failing.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const consent = await prisma.partnerConsent.findUnique({
    where: { id },
    select: { id: true, connectorKey: true, status: true, tokenEncrypted: true },
  });
  if (!consent || consent.status !== "GRANTED" || !consent.tokenEncrypted) {
    return NextResponse.json({ error: "No refreshable consent" }, { status: 404 });
  }

  // redirectUri is irrelevant for the refresh grant; pass an empty placeholder.
  const config = await getConnectorOAuthConfig(consent.connectorKey, "");
  if (!config) {
    return NextResponse.json({ error: "Connector OAuth is not configured." }, { status: 503 });
  }

  const refreshToken = decrypt(consent.tokenEncrypted);
  const tokens = await refreshConnectorToken(config, refreshToken);
  if (!tokens) {
    await prisma.partnerConsent.update({
      where: { id: consent.id },
      data: { status: "EXPIRED", revocationReason: "AUTO_EXPIRED", revokedAt: new Date() },
    });
    return NextResponse.json({ refreshed: false }, { status: 502 });
  }

  const newToken = tokens.refreshToken ?? refreshToken;
  await prisma.partnerConsent.update({
    where: { id: consent.id },
    data: {
      tokenEncrypted: encrypt(newToken),
      tokenExpiresAt: tokenExpiryFrom(tokens.expiresInSeconds, Date.now()),
    },
  });
  return NextResponse.json({ refreshed: true });
}
