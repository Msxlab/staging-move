/**
 * Google Play Developer API v3 client.
 *
 * Auth flow:
 *   1) Build a JWT assertion signed with the service account's RS256 key,
 *      audience = token endpoint, scope = androidpublisher.
 *   2) POST it to https://oauth2.googleapis.com/token to get an access token.
 *   3) Call androidpublisher.googleapis.com with that token.
 *
 * Tokens are cached in memory until 60s before expiry to avoid minting one
 * per verification request.
 */

import { SignJWT, importPKCS8, createRemoteJWKSet, jwtVerify } from "jose";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

interface GoogleCreds {
  clientEmail: string;
  privateKeyPem: string;
  packageName: string;
}

async function loadGoogleCreds(): Promise<GoogleCreds | null> {
  const [clientEmail, privateKeyPem, packageName] = await Promise.all([
    getRuntimeConfigValue("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL"),
    getRuntimeConfigValue("GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY"),
    getRuntimeConfigValue("GOOGLE_PLAY_PACKAGE_NAME"),
  ]);
  if (!clientEmail || !privateKeyPem || !packageName) return null;
  return { clientEmail, privateKeyPem, packageName };
}

interface CachedToken {
  value: string;
  expiresAt: number;
}
let tokenCache: CachedToken | null = null;

async function getGoogleAccessToken(creds: GoogleCreds): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > now + 60) {
    return tokenCache.value;
  }

  const pemNormalized = creds.privateKeyPem.includes("-----BEGIN")
    ? creds.privateKeyPem.replace(/\\n/g, "\n")
    : `-----BEGIN PRIVATE KEY-----\n${creds.privateKeyPem}\n-----END PRIVATE KEY-----`;

  const key = await importPKCS8(pemNormalized, "RS256");

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/androidpublisher",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(creds.clientEmail)
    .setSubject(creds.clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GOOGLE_OAUTH_${res.status}:${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const expiresIn = typeof json?.expires_in === "number" ? json.expires_in : 3600;

  tokenCache = {
    value: String(json.access_token),
    expiresAt: now + expiresIn,
  };
  return tokenCache.value;
}

// ────────────────────────────────────────────────────────────────
// subscriptionsv2.get — current source of truth for subscription state.
// ────────────────────────────────────────────────────────────────

export interface GoogleSubscriptionV2LineItem {
  productId: string;
  expiryTime?: string;
  autoRenewingPlan?: {
    autoRenewEnabled?: boolean;
    priceChangeDetails?: unknown;
  };
  prepaidPlan?: { allowExtendAfterTime?: string };
  offerDetails?: { basePlanId?: string; offerId?: string };
}

export interface GoogleSubscriptionV2Response {
  kind?: string;
  regionCode?: string;
  lineItems?: GoogleSubscriptionV2LineItem[];
  startTime?: string;
  subscriptionState?: string;
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  pausedStateContext?: { autoResumeTime?: string };
  canceledStateContext?: { userInitiatedCancellation?: unknown; systemInitiatedCancellation?: unknown };
  testPurchase?: Record<string, unknown>;
  acknowledgementState?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
}

export interface GoogleSubscriptionResult {
  packageName: string;
  purchaseToken: string;
  response: GoogleSubscriptionV2Response;
}

export async function getGoogleSubscription(
  purchaseToken: string,
): Promise<GoogleSubscriptionResult | null> {
  const creds = await loadGoogleCreds();
  if (!creds) throw new Error("GOOGLE_API_CREDS_MISSING");

  const access = await getGoogleAccessToken(creds);
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(creds.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${access}` },
  });

  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GOOGLE_API_${res.status}:${txt.slice(0, 200)}`);
  }

  const response = (await res.json()) as GoogleSubscriptionV2Response;
  return { packageName: creds.packageName, purchaseToken, response };
}

/**
 * Acknowledge a subscription purchase. Required by Google within 3 days
 * of a new purchase/renewal, otherwise the purchase is refunded.
 *
 * Idempotent: Google returns 400 if already acknowledged — we swallow.
 */
export async function acknowledgeGoogleSubscription(opts: {
  purchaseToken: string;
  productId: string;
}): Promise<void> {
  const creds = await loadGoogleCreds();
  if (!creds) throw new Error("GOOGLE_API_CREDS_MISSING");

  const access = await getGoogleAccessToken(creds);
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(creds.packageName)}/purchases/subscriptions/${encodeURIComponent(opts.productId)}/tokens/${encodeURIComponent(opts.purchaseToken)}:acknowledge`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (res.ok || res.status === 400 /* already acknowledged */) return;
  const txt = await res.text().catch(() => "");
  throw new Error(`GOOGLE_ACK_${res.status}:${txt.slice(0, 200)}`);
}

/**
 * Map Google Play's `subscriptionState` enum to our internal status.
 * Reference: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2#SubscriptionState
 */
export function mapGoogleSubscriptionState(
  state: string | undefined | null,
): "ACTIVE" | "TRIALING" | "GRACE_PERIOD" | "PAST_DUE" | "CANCELED" | "EXPIRED" | "PENDING_VALIDATION" | "UNKNOWN" {
  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "ACTIVE";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "GRACE_PERIOD";
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "PAST_DUE";
    case "SUBSCRIPTION_STATE_PAUSED":
      return "PAST_DUE";
    case "SUBSCRIPTION_STATE_CANCELED":
      return "CANCELED";
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "EXPIRED";
    case "SUBSCRIPTION_STATE_PENDING":
      return "PENDING_VALIDATION";
    default:
      return "UNKNOWN";
  }
}

// ────────────────────────────────────────────────────────────────
// Pub/Sub RTDN OIDC verification.
// Cloud Pub/Sub pushes include an OIDC bearer token proving the caller
// is the configured service account. Verified against Google's JWKS.
// ────────────────────────────────────────────────────────────────

const GOOGLE_OIDC_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export interface VerifiedPubsubPush {
  audience: string;
  issuer: string;
  email: string;
  emailVerified: boolean;
}

export async function verifyPubsubOidcToken(
  token: string,
  expectedAudience: string | null,
): Promise<VerifiedPubsubPush> {
  const { payload } = await jwtVerify(token, GOOGLE_OIDC_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    ...(expectedAudience ? { audience: expectedAudience } : {}),
  });

  const email = typeof payload.email === "string" ? payload.email : "";
  const emailVerified = payload.email_verified === true;
  return {
    audience: String(payload.aud || ""),
    issuer: String(payload.iss || ""),
    email,
    emailVerified,
  };
}
