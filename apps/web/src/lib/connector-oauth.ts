/**
 * Web bridge for the connector OAuth flow.
 *
 * Glues @locateflow/connectors (pure OAuth/PKCE helpers) to this app's
 * conventions: runtime config for per-connector credentials, the field
 * encryption module for the token vault, and Prisma for PartnerConsent.
 *
 * Everything here is gated by FEATURE_API_CONNECTORS (default OFF) and by a
 * per-connector ConnectorConfig.enabled row. With no partner OAuth credentials
 * configured, every entry point degrades to a 503 — the surface is inert by
 * default and cannot lock or change existing behavior.
 */

import {
  buildRefreshBody,
  buildTokenExchangeBody,
  parseTokenResponse,
  tokenExpiryFrom,
  type OAuthProviderConfig,
  type OAuthTokens,
} from "@locateflow/connectors";
import { getEffectiveEntitlement, planFeatures } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/shared-encryption";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

const FEATURE_FLAG_KEY = "FEATURE_API_CONNECTORS";

/** Master gate. Default OFF — the entire connector OAuth surface stays inert. */
export async function isApiConnectorsEnabled(): Promise<boolean> {
  const value = (await getRuntimeConfigValue(FEATURE_FLAG_KEY)) ?? process.env.FEATURE_API_CONNECTORS ?? "";
  return value === "true" || value === "1";
}

/**
 * Plan-level entitlement gate: whether a user's effective plan unlocks API
 * connectors (PRO per the entitlement matrix). The master flag turns the
 * surface ON; THIS gates WHO may use it, so Free/Individual/Family users cannot
 * connect a partner or trigger a sync even when the flag is on.
 */
export async function userHasApiConnectorEntitlement(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const plan = String(getEffectiveEntitlement(sub).effectivePlan);
  return planFeatures(plan).apiConnectors === true;
}

/** Lowercase kebab-case connector keys only (matches the manifest contract). */
export function isValidConnectorKey(key: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(key);
}

function envKey(connectorKey: string, suffix: string): string {
  // e.g. CONNECTOR_USPS_OAUTH_CLIENT_ID
  return `CONNECTOR_${connectorKey.toUpperCase().replace(/-/g, "_")}_OAUTH_${suffix}`;
}

/**
 * Per-connector OAuth client config from runtime config / env. Returns null
 * when not fully configured so callers can answer 503 (inert by default).
 */
export async function getConnectorOAuthConfig(
  connectorKey: string,
  redirectUri: string,
): Promise<OAuthProviderConfig | null> {
  const [clientId, clientSecret, authorizeUrl, tokenUrl, scopesRaw] = await Promise.all([
    getRuntimeConfigValue(envKey(connectorKey, "CLIENT_ID")),
    getRuntimeConfigValue(envKey(connectorKey, "CLIENT_SECRET")),
    getRuntimeConfigValue(envKey(connectorKey, "AUTHORIZE_URL")),
    getRuntimeConfigValue(envKey(connectorKey, "TOKEN_URL")),
    getRuntimeConfigValue(envKey(connectorKey, "SCOPES")),
  ]);
  if (!clientId || !clientSecret || !authorizeUrl || !tokenUrl) return null;
  const scopes = (scopesRaw ?? "").split(/[\s,]+/).filter(Boolean);
  return { clientId, clientSecret, authorizeUrl, tokenUrl, redirectUri, scopes };
}

/** Whether the admin control plane has switched this connector on. */
export async function isConnectorEnabled(connectorKey: string): Promise<boolean> {
  const row = await prisma.connectorConfig.findUnique({ where: { connectorKey } });
  return Boolean(row?.enabled);
}

/** Server-to-server authorization_code → token exchange (back-channel). */
export async function exchangeConnectorCode(
  config: OAuthProviderConfig,
  code: string,
  codeVerifier: string,
): Promise<OAuthTokens | null> {
  const body = new URLSearchParams(buildTokenExchangeBody({ config, code, codeVerifier }));
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  try {
    return parseTokenResponse(await res.json());
  } catch {
    return null;
  }
}

/** Refresh an access token using the stored refresh token. */
export async function refreshConnectorToken(
  config: OAuthProviderConfig,
  refreshToken: string,
): Promise<OAuthTokens | null> {
  const body = new URLSearchParams(buildRefreshBody({ config, refreshToken }));
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  try {
    return parseTokenResponse(await res.json());
  } catch {
    return null;
  }
}

/**
 * Refresh + persist a consent's ACCESS token from its stored refresh token.
 * Returns the fresh access token, or null when config/refresh is unavailable
 * (the dispatcher then degrades to NEEDS_USER). Rotates the refresh token if the
 * provider returns a new one.
 */
export async function refreshConsentAccessToken(
  consentId: string,
  connectorKey: string,
  refreshTokenEncrypted: string,
): Promise<string | null> {
  const config = await getConnectorOAuthConfig(connectorKey, "");
  if (!config) return null;
  let refreshToken: string;
  try {
    refreshToken = decrypt(refreshTokenEncrypted);
  } catch {
    return null;
  }
  const tokens = await refreshConnectorToken(config, refreshToken);
  if (!tokens?.accessToken) return null;
  await prisma.partnerConsent.update({
    where: { id: consentId },
    data: {
      tokenEncrypted: encrypt(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
      tokenExpiresAt: tokenExpiryFrom(tokens.expiresInSeconds, Date.now()),
    },
  });
  return tokens.accessToken;
}

/**
 * Persist a granted consent, encrypting the long-lived token at rest. One
 * active consent per (user, connector) — a new grant supersedes the old.
 */
export async function upsertGrantedConsent(input: {
  userId: string;
  connectorKey: string;
  tokens: OAuthTokens;
  consentSnapshot: unknown;
  now: Date;
}): Promise<string> {
  const { userId, connectorKey, tokens, consentSnapshot, now } = input;
  const tokenEncrypted = tokens.accessToken ? encrypt(tokens.accessToken) : null;
  const refreshTokenEncrypted = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;
  const tokenExpiresAt = tokenExpiryFrom(tokens.expiresInSeconds, now.getTime());
  const scopesJson = JSON.stringify(tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : []);
  const consentSnapshotJson = JSON.stringify(consentSnapshot);

  const existing = await prisma.partnerConsent.findFirst({
    where: { userId, connectorKey, status: "GRANTED" },
    select: { id: true },
  });
  if (existing) {
    await prisma.partnerConsent.update({
      where: { id: existing.id },
      data: {
        status: "GRANTED",
        scopesJson,
        consentSnapshotJson,
        tokenEncrypted,
        refreshTokenEncrypted: refreshTokenEncrypted ?? undefined,
        tokenExpiresAt,
        grantedAt: now,
        revokedAt: null,
        revocationReason: null,
      },
    });
    return existing.id;
  }

  const created = await prisma.partnerConsent.create({
    data: {
      userId,
      connectorKey,
      scopesJson,
      status: "GRANTED",
      grantedAt: now,
      tokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt,
      consentSnapshotJson,
    },
    select: { id: true },
  });
  return created.id;
}

/** Revoke a consent the caller owns. Zeroes the stored token. */
export async function revokeConsent(input: {
  id: string;
  userId: string;
  reason: string;
}): Promise<boolean> {
  const consent = await prisma.partnerConsent.findFirst({
    where: { id: input.id, userId: input.userId },
    select: { id: true },
  });
  if (!consent) return false;
  await prisma.partnerConsent.update({
    where: { id: consent.id },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revocationReason: input.reason,
      tokenEncrypted: null,
      refreshTokenEncrypted: null,
    },
  });
  // Cancel the consent's queued/in-flight dispatches so a revoked partner is
  // never (re)attempted; NEEDS_USER is the terminal manual-fallback state.
  await prisma.connectorDispatch.updateMany({
    where: { consentId: consent.id, status: { in: ["QUEUED", "DISPATCHING"] } },
    data: { status: "NEEDS_USER", lastErrorCode: "REVOKED" },
  });
  return true;
}
