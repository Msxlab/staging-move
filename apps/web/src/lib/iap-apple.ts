/**
 * Apple App Store Server API v2 client + JWS verification.
 *
 * Two roles:
 *   1) Verify a JWS signed transaction/notification locally using Apple's
 *      x5c certificate chain — no API call needed.
 *   2) Call the App Store Server API to look up the latest subscription
 *      status for an `originalTransactionId`, authenticated with a short-
 *      lived ES256 JWT built from the operator's .p8 key.
 *
 * Security notes:
 *   - `verifyJws` validates the full x5c chain up to Apple's AppleRootCA-G3.
 *   - Sandbox and Production have separate hosts; we probe Production first
 *     and fall through to Sandbox on 4960 (per Apple's recommendation).
 *   - Bundle ID and environment from the JWS payload are returned so the
 *     caller can reject cross-app replay.
 */

import { X509Certificate, verify as cryptoVerify } from "crypto";
import { SignJWT, importPKCS8 } from "jose";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { requireAppleEnvironmentForBilling } from "@/lib/billing-config";

// Apple root CA — G3. Embedded to avoid runtime fetches.
// Source: https://www.apple.com/certificateauthority/ (AppleRootCA-G3.cer, base64-encoded DER).
const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(normalized, "base64");
}

function pemFromDerBase64(derBase64: string): string {
  const chunks = derBase64.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${chunks.join("\n")}\n-----END CERTIFICATE-----`;
}

// ────────────────────────────────────────────────────────────────
// JWS verification (used for BOTH Server Notifications v2 and the
// signedTransactionInfo/signedRenewalInfo returned from the API).
// ────────────────────────────────────────────────────────────────

export interface AppleJwsHeader {
  alg: string;
  x5c: string[];
}

export interface AppleTransactionPayload {
  transactionId: string;
  originalTransactionId: string;
  webOrderLineItemId?: string;
  bundleId: string;
  productId: string;
  subscriptionGroupIdentifier?: string;
  purchaseDate: number;
  originalPurchaseDate: number;
  expiresDate?: number;
  quantity: number;
  type: string;
  inAppOwnershipType: string;
  signedDate: number;
  environment: "Sandbox" | "Production";
  transactionReason?: "PURCHASE" | "RENEWAL";
  storefront?: string;
  price?: number;
  currency?: string;
  revocationDate?: number;
  revocationReason?: number;
  offerType?: number;
  appAccountToken?: string;
}

export interface AppleRenewalPayload {
  originalTransactionId: string;
  autoRenewProductId: string;
  productId: string;
  autoRenewStatus: 0 | 1;
  expirationIntent?: number;
  gracePeriodExpiresDate?: number;
  isInBillingRetryPeriod?: boolean;
  priceIncreaseStatus?: 0 | 1;
  renewalDate?: number;
  environment: "Sandbox" | "Production";
}

export interface AppleNotificationPayload {
  notificationType: string;
  subtype?: string;
  notificationUUID: string;
  version: string;
  signedDate: number;
  data?: {
    appAppleId?: number;
    bundleId: string;
    bundleVersion?: string;
    environment: "Sandbox" | "Production";
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
    status?: number;
  };
}

/**
 * Verify a JWS produced by Apple (ES256 with x5c chain) and return the payload.
 * Throws on any verification failure — callers must treat errors as untrusted input.
 */
export function verifyAppleJws<T = unknown>(jws: string): T {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("APPLE_JWS_MALFORMED");

  const header = JSON.parse(base64UrlDecode(parts[0]).toString("utf8")) as AppleJwsHeader;
  if (header.alg !== "ES256") throw new Error("APPLE_JWS_UNSUPPORTED_ALG");
  if (!Array.isArray(header.x5c) || header.x5c.length < 2) {
    throw new Error("APPLE_JWS_MISSING_X5C");
  }

  // 1. Walk the x5c chain: leaf -> intermediate(s) -> root.
  //    Each cert must be signed by the next one.
  const certs = header.x5c.map((der) => new X509Certificate(pemFromDerBase64(der)));
  const appleRoot = new X509Certificate(APPLE_ROOT_CA_G3_PEM);

  for (let i = 0; i < certs.length - 1; i++) {
    const child = certs[i];
    const parent = certs[i + 1];
    if (!child.verify(parent.publicKey)) {
      throw new Error("APPLE_JWS_CHAIN_BROKEN");
    }
  }

  // 2. Top of the x5c chain must be signed by AppleRootCA-G3 (or be it).
  const topCert = certs[certs.length - 1];
  const topIsRoot = topCert.fingerprint256 === appleRoot.fingerprint256;
  if (!topIsRoot && !topCert.verify(appleRoot.publicKey)) {
    throw new Error("APPLE_JWS_UNTRUSTED_ROOT");
  }

  // 3. Time-bound leaf + intermediates.
  const now = new Date();
  for (const cert of certs) {
    const notBefore = new Date(cert.validFrom);
    const notAfter = new Date(cert.validTo);
    if (now < notBefore || now > notAfter) {
      throw new Error("APPLE_JWS_CERT_EXPIRED");
    }
  }

  // 4. Verify the JWS signature using the leaf cert's public key.
  const leaf = certs[0];
  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, "utf8");
  const sigDerJose = base64UrlDecode(parts[2]);
  // ES256 signatures from JOSE are raw r||s (64 bytes). Node's crypto.verify
  // expects DER encoding, so convert.
  const sigDer = joseEcdsaSigToDer(sigDerJose);
  const ok = cryptoVerify("sha256", signingInput, { key: leaf.publicKey, dsaEncoding: "der" } as any, sigDer);
  if (!ok) throw new Error("APPLE_JWS_BAD_SIGNATURE");

  return JSON.parse(base64UrlDecode(parts[1]).toString("utf8")) as T;
}

/**
 * Convert a JOSE ES256 signature (64 bytes = r||s, big-endian) into ASN.1 DER.
 * Node's crypto.verify with dsaEncoding:"der" expects the DER form.
 */
function joseEcdsaSigToDer(sig: Buffer): Buffer {
  if (sig.length !== 64) return sig; // Let verify fail cleanly
  const r = stripLeadingZeros(sig.subarray(0, 32));
  const s = stripLeadingZeros(sig.subarray(32, 64));

  // Prepend 0x00 if high bit set (to keep the integer positive in ASN.1).
  const rEncoded = r[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), r]) : r;
  const sEncoded = s[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), s]) : s;

  const rSeq = Buffer.concat([Buffer.from([0x02, rEncoded.length]), rEncoded]);
  const sSeq = Buffer.concat([Buffer.from([0x02, sEncoded.length]), sEncoded]);
  const body = Buffer.concat([rSeq, sSeq]);

  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

function stripLeadingZeros(buf: Buffer): Buffer {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) i++;
  return buf.subarray(i);
}

// ────────────────────────────────────────────────────────────────
// App Store Server API client — ES256 bearer token.
// ────────────────────────────────────────────────────────────────

interface AppleApiCreds {
  issuerId: string;
  keyId: string;
  bundleId: string;
  privateKeyPem: string;
}

async function loadAppleApiCreds(): Promise<AppleApiCreds | null> {
  const [issuerId, keyId, bundleId, privateKeyPem] = await Promise.all([
    getRuntimeConfigValue("APPLE_APP_STORE_ISSUER_ID"),
    getRuntimeConfigValue("APPLE_APP_STORE_KEY_ID"),
    getRuntimeConfigValue("APPLE_BUNDLE_ID"),
    getRuntimeConfigValue("APPLE_APP_STORE_PRIVATE_KEY"),
  ]);
  if (!issuerId || !keyId || !bundleId || !privateKeyPem) return null;
  return { issuerId, keyId, bundleId, privateKeyPem };
}

async function mintAppleBearerToken(creds: AppleApiCreds): Promise<string> {
  // Apple docs: ES256, audience "appstoreconnect-v1", iss = issuer ID,
  // bid = bundle ID, iat = now, exp ≤ now+20min, kid = key ID in header.
  const pemNormalized = creds.privateKeyPem.includes("-----BEGIN")
    ? creds.privateKeyPem.replace(/\\n/g, "\n")
    : `-----BEGIN PRIVATE KEY-----\n${creds.privateKeyPem}\n-----END PRIVATE KEY-----`;

  const key = await importPKCS8(pemNormalized, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ bid: creds.bundleId })
    .setProtectedHeader({ alg: "ES256", kid: creds.keyId, typ: "JWT" })
    .setIssuer(creds.issuerId)
    .setAudience("appstoreconnect-v1")
    .setIssuedAt(now)
    .setExpirationTime(now + 19 * 60)
    .sign(key);
}

let appleBearerCache:
  | { cacheKey: string; token: string; expiresAtMs: number }
  | null = null;

function getAppleBearerCacheKey(creds: AppleApiCreds) {
  return [creds.issuerId, creds.keyId, creds.bundleId].join(":");
}

async function getAppleBearerToken(creds: AppleApiCreds): Promise<string> {
  const cacheKey = getAppleBearerCacheKey(creds);
  if (
    appleBearerCache &&
    appleBearerCache.cacheKey === cacheKey &&
    appleBearerCache.expiresAtMs > Date.now()
  ) {
    return appleBearerCache.token;
  }

  const token = await mintAppleBearerToken(creds);
  appleBearerCache = {
    cacheKey,
    token,
    expiresAtMs: Date.now() + 18 * 60 * 1000,
  };
  return token;
}

type AppleEnvironment = "Production" | "Sandbox";

async function getDefaultEnvironment(): Promise<AppleEnvironment> {
  const raw = await getRuntimeConfigValue("APPLE_APP_STORE_ENVIRONMENT");
  return requireAppleEnvironmentForBilling(raw);
}

function appleApiBase(env: AppleEnvironment): string {
  return env === "Sandbox"
    ? "https://api.storekit-sandbox.itunes.apple.com"
    : "https://api.storekit.itunes.apple.com";
}

export interface AppleSubscriptionStatusResult {
  environment: AppleEnvironment;
  transaction: AppleTransactionPayload;
  renewal: AppleRenewalPayload | null;
  rawStatus: number;
}

/**
 * Fetch the latest subscription status for an originalTransactionId.
 * Probes Production first; falls through to Sandbox on 4040010 / 4040005
 * (per Apple: "environment mismatch" indicators).
 */
export async function getAppleSubscriptionStatus(
  originalTransactionId: string,
): Promise<AppleSubscriptionStatusResult | null> {
  const creds = await loadAppleApiCreds();
  if (!creds) throw new Error("APPLE_API_CREDS_MISSING");

  const envOrder: AppleEnvironment[] = (await getDefaultEnvironment()) === "Sandbox"
    ? ["Sandbox", "Production"]
    : ["Production", "Sandbox"];

  const bearer = await getAppleBearerToken(creds);

  for (const env of envOrder) {
    const url = `${appleApiBase(env)}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${bearer}` },
    });

    if (res.status === 404) {
      // Unknown in this environment — try the other one.
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // 4040010 = "TransactionIdNotFoundError" when cross-env; fall through.
      if (body.includes("4040010") || body.includes("4040005")) continue;
      throw new Error(`APPLE_API_${res.status}:${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const groups = Array.isArray(json?.data) ? json.data : [];
    if (groups.length === 0) continue;

    // Walk all groups and find the lastTransactions entry matching the ID.
    for (const group of groups) {
      const items: any[] = group?.lastTransactions || [];
      for (const item of items) {
        const txPayload = item?.signedTransactionInfo
          ? verifyAppleJws<AppleTransactionPayload>(item.signedTransactionInfo)
          : null;
        if (!txPayload) continue;
        if (txPayload.originalTransactionId !== originalTransactionId) continue;
        if (txPayload.bundleId !== creds.bundleId) {
          throw new Error("APPLE_JWS_BUNDLE_MISMATCH");
        }

        const renewalPayload = item?.signedRenewalInfo
          ? verifyAppleJws<AppleRenewalPayload>(item.signedRenewalInfo)
          : null;

        return {
          environment: env,
          transaction: txPayload,
          renewal: renewalPayload,
          rawStatus: typeof item?.status === "number" ? item.status : -1,
        };
      }
    }
  }

  return null;
}

/**
 * Convenience helper — given a JWS signed transaction from the client
 * (StoreKit2 `JWSRepresentation`), verify locally, then pivot to the
 * Server API to get the authoritative latest status.
 *
 * Returns null if the transaction is valid but no subscription matches
 * (e.g. consumable purchase).
 */
export async function verifyAndLookupSignedTransaction(
  signedTransaction: string,
): Promise<AppleSubscriptionStatusResult | null> {
  const payload = verifyAppleJws<AppleTransactionPayload>(signedTransaction);
  const creds = await loadAppleApiCreds();
  if (!creds) throw new Error("APPLE_API_CREDS_MISSING");
  if (payload.bundleId !== creds.bundleId) {
    throw new Error("APPLE_JWS_BUNDLE_MISMATCH");
  }
  return getAppleSubscriptionStatus(payload.originalTransactionId);
}

export function mapAppleStatus(rawStatus: number): "ACTIVE" | "EXPIRED" | "PAST_DUE" | "CANCELED" | "UNKNOWN" {
  // Per Apple: 1=active, 2=expired, 3=in-billing-retry, 4=grace-period, 5=revoked.
  switch (rawStatus) {
    case 1:
      return "ACTIVE";
    case 2:
      return "EXPIRED";
    case 3:
      return "PAST_DUE";
    case 4:
      return "PAST_DUE";
    case 5:
      return "CANCELED";
    default:
      return "UNKNOWN";
  }
}
