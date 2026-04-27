import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend uses Svix for webhook signing. Each delivery includes three
 * headers:
 *
 *   svix-id          — unique message id
 *   svix-timestamp   — Unix seconds when Resend sent the request
 *   svix-signature   — space-separated list of `v1,<base64-sig>` pairs;
 *                      multiple entries appear during secret rotation
 *
 * The signed payload is `${svix-id}.${svix-timestamp}.${rawBody}`. We
 * compute HMAC-SHA256 with key = base64decode(secret.replace("whsec_",""))
 * and compare against any provided signature in constant time.
 *
 * Reference: https://docs.svix.com/receiving/verifying-payloads/how-manual
 */

const SIGNATURE_PREFIX = "whsec_";
// Reject events older than 5 minutes (default Svix tolerance) — protects
// against captured-and-replayed deliveries.
const TIMESTAMP_TOLERANCE_SECONDS = 300;

export interface ResendSignatureHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export interface VerifyResult {
  valid: boolean;
  reason?: "missing_headers" | "expired" | "bad_secret" | "no_match";
}

export function verifyResendSignature(
  secret: string,
  headers: ResendSignatureHeaders,
  rawBody: string,
  now: Date = new Date(),
): VerifyResult {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { valid: false, reason: "missing_headers" };
  }

  const ts = Number.parseInt(headers.timestamp, 10);
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: "missing_headers" };
  }
  const driftSeconds = Math.abs(Math.floor(now.getTime() / 1000) - ts);
  if (driftSeconds > TIMESTAMP_TOLERANCE_SECONDS) {
    return { valid: false, reason: "expired" };
  }

  const stripped = secret.startsWith(SIGNATURE_PREFIX) ? secret.slice(SIGNATURE_PREFIX.length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(stripped, "base64");
  } catch {
    return { valid: false, reason: "bad_secret" };
  }
  if (key.length === 0) {
    return { valid: false, reason: "bad_secret" };
  }

  const signedPayload = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = createHmac("sha256", key).update(signedPayload).digest();

  // Resend may rotate keys, sending multiple `v1,sig` entries separated by
  // spaces. Match any one of them.
  const candidates = headers.signature.split(" ");
  for (const candidate of candidates) {
    const [version, encoded] = candidate.split(",");
    if (version !== "v1" || !encoded) continue;
    let provided: Buffer;
    try {
      provided = Buffer.from(encoded, "base64");
    } catch {
      continue;
    }
    if (provided.length !== expected.length) continue;
    if (timingSafeEqual(provided, expected)) {
      return { valid: true };
    }
  }
  return { valid: false, reason: "no_match" };
}

/**
 * The shape of a Resend webhook event. Only the fields we care about
 * are typed; the rest is an open record so we don't fight the provider
 * when they add new payload fields.
 */
export interface ResendEvent {
  type: string;
  data: {
    email_id?: string;
    to?: string[] | string;
    email?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function extractRecipientEmail(event: ResendEvent): string | null {
  const direct = event.data?.email;
  if (typeof direct === "string" && direct.includes("@")) return direct.toLowerCase();
  const to = event.data?.to;
  if (Array.isArray(to) && typeof to[0] === "string") return to[0].toLowerCase();
  if (typeof to === "string" && to.includes("@")) return to.toLowerCase();
  return null;
}
