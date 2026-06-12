import { NextRequest, NextResponse } from "next/server";
import { tokenExpiryFrom } from "@locateflow/connectors";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/shared-encryption";
import { getConnectorOAuthConfig, refreshConnectorToken } from "@/lib/connector-oauth";
import { guardCronRequest } from "@/lib/cron-guard";

export const runtime = "nodejs";

/**
 * POST /api/partner-consents/[id]/refresh
 *
 * Refreshes a consent's access token using the stored refresh token. Called by
 * the scheduler. On unrecoverable failure the consent is marked EXPIRED so the
 * connections UI prompts the user to reconnect rather than silently failing.
 *
 * NOTE: the entire partner-consent/connector surface is gated behind
 * FEATURE_API_CONNECTORS (currently OFF), and this path lives under
 * /api/partner-consents/, which the web middleware treats as user-authenticated
 * — so a Bearer-CRON_SECRET scheduler call is rejected at the edge today (this is
 * effectively dormant until connectors launch). When they launch, relocate this
 * route under /api/cron/ (or allowlist it in middleware) so the scheduler can
 * actually reach it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Constant-time CRON_SECRET auth + per-route rate limit, consistent with every
  // other scheduled route (replaces a bespoke, non-constant-time === compare).
  const guard = await guardCronRequest(request, "partner-consent-refresh", { limit: 60 });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const consent = await prisma.partnerConsent.findUnique({
    where: { id },
    select: { id: true, connectorKey: true, status: true, refreshTokenEncrypted: true },
  });
  if (!consent || consent.status !== "GRANTED" || !consent.refreshTokenEncrypted) {
    return NextResponse.json({ error: "No refreshable consent" }, { status: 404 });
  }

  // redirectUri is irrelevant for the refresh grant; pass an empty placeholder.
  const config = await getConnectorOAuthConfig(consent.connectorKey, "");
  if (!config) {
    return NextResponse.json({ error: "Connector OAuth is not configured." }, { status: 503 });
  }

  const refreshToken = decrypt(consent.refreshTokenEncrypted);
  const tokens = await refreshConnectorToken(config, refreshToken);
  if (!tokens?.accessToken) {
    await prisma.partnerConsent.update({
      where: { id: consent.id },
      data: { status: "EXPIRED", revocationReason: "AUTO_EXPIRED", revokedAt: new Date() },
    });
    return NextResponse.json({ refreshed: false }, { status: 502 });
  }

  await prisma.partnerConsent.update({
    where: { id: consent.id },
    data: {
      tokenEncrypted: encrypt(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
      tokenExpiresAt: tokenExpiryFrom(tokens.expiresInSeconds, Date.now()),
    },
  });
  return NextResponse.json({ refreshed: true });
}
