import { NextResponse } from "next/server";
import { tokenExpiryFrom } from "@locateflow/connectors";
import { prisma } from "@/lib/db";
import { getConnectorOAuthConfig, refreshConnectorToken } from "@/lib/connector-oauth";
import { decrypt, encrypt } from "@/lib/shared-encryption";

export async function refreshPartnerConsentById(id: string) {
  const consent = await prisma.partnerConsent.findUnique({
    where: { id },
    select: { id: true, connectorKey: true, status: true, refreshTokenEncrypted: true },
  });
  if (!consent || consent.status !== "GRANTED" || !consent.refreshTokenEncrypted) {
    return NextResponse.json({ error: "No refreshable consent" }, { status: 404 });
  }

  const config = await getConnectorOAuthConfig(consent.connectorKey, "");
  if (!config) {
    return NextResponse.json({ error: "Connector OAuth is not configured." }, { status: 503 });
  }

  const refreshToken = decrypt(consent.refreshTokenEncrypted);
  const tokens = await refreshConnectorToken(config, refreshToken);
  if (!tokens?.accessToken) {
    await prisma.partnerConsent.update({
      where: { id: consent.id },
      data: {
        status: "EXPIRED",
        tokenEncrypted: null,
        refreshTokenEncrypted: null,
        tokenExpiresAt: null,
        activeGrantKey: null,
        revocationReason: "AUTO_EXPIRED",
        revokedAt: new Date(),
      },
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
