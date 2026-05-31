/**
 * USPS connector — the reference implementation.
 *
 * This is the template every other connector copies: a manifest, a pure request
 * mapping, a side-effecting `push`, a read-back `verify`, and a `healthCheck`
 * canary. It demonstrates the real server-side push path end-to-end.
 *
 * Reality check (kept honest on purpose): filing a consumer Change-of-Address
 * through an API requires authorized-agent status with USPS, and the consumer
 * COA flow mandates identity verification on USPS's side. In production this
 * connector is gated behind per-user consent and the FEATURE_API_CONNECTORS
 * flag, and its declared `fallbackActionKey` points at the deep-link COA flow
 * so that — if licensing is unavailable or anything fails — the user is handed
 * the manual path and is never blocked. Flip `addressUpdatePush` to false to run
 * USPS as fallback-only without touching any other code.
 */

import type {
  AddressConnector,
  CanonicalAddressChange,
  ConnectorContext,
  ConnectorHttpResponse,
  ConnectorManifest,
  ConnectorResult,
} from "../core";
import { buildUspsCoaRequest } from "./request";

const COA_STATUS_ENDPOINT = "https://apis.usps.com/addresses/v3/change-of-address";
const VALIDATE_ENDPOINT =
  "https://apis.usps.com/addresses/v3/address?streetAddress=1+Test+St&state=DC&ZIPCode=20260";

export const uspsManifest: ConnectorManifest = {
  key: "usps",
  version: "1.0.0",
  displayName: "USPS Change of Address",
  auth: { type: "OAUTH", scopes: ["addresses", "change-of-address"] },
  allowedHosts: ["apis.usps.com"],
  requiredFields: [],
  capabilities: {
    addressValidate: true,
    addressUpdatePush: true,
    readBackVerify: true,
    asyncConfirm: false,
    household: true,
    business: true,
  },
  // COA is a fraud-controlled action — cap how many a single user can file.
  rateLimit: { perUserPerDay: 2, perConnectorPerMinute: 60 },
  // A COA must know the FROM address; never file one without an origin.
  requiresOrigin: true,
  fallbackActionKey: "usps:MAIL_FORWARDING:DEEP_LINK",
};

/** Map a partner HTTP status onto a normalized connector result. */
function resultFromStatus(res: ConnectorHttpResponse): ConnectorResult {
  if (res.ok) {
    const confirmationNumber = readConfirmation(res.body);
    // USPS confirms a COA out of band (mailed validation letter), so a 2xx is
    // "submitted", not yet "confirmed" — verify() reconciles it.
    return { outcome: "SUBMITTED", confirmationNumber, metadata: { status: res.status } };
  }
  if (res.status === 401 || res.status === 403) {
    return { outcome: "FAILED", errorCode: "AUTH_EXPIRED", retryable: false };
  }
  if (res.status === 409) {
    // Already on file — idempotent success, not an error.
    return { outcome: "CONFIRMED", metadata: { reason: "ALREADY_ON_FILE" } };
  }
  if (res.status === 429) {
    return { outcome: "FAILED", errorCode: "RATE_LIMITED", retryable: true };
  }
  if (res.status >= 500) {
    return { outcome: "FAILED", errorCode: "PARTNER_DOWN", retryable: true };
  }
  if (res.status === 400 || res.status === 422) {
    return {
      outcome: "FAILED",
      errorCode: "VALIDATION_REJECTED",
      retryable: false,
      metadata: { status: res.status },
    };
  }
  return { outcome: "FAILED", errorCode: "UNKNOWN", retryable: false, metadata: { status: res.status } };
}

function readConfirmation(body: unknown): string | null {
  if (body && typeof body === "object" && "confirmationNumber" in body) {
    const value = (body as { confirmationNumber?: unknown }).confirmationNumber;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function authHeaders(ctx: ConnectorContext): Record<string, string> {
  return {
    Authorization: `Bearer ${ctx.accessToken}`,
    "Idempotency-Key": ctx.idempotencyKey,
  };
}

export const uspsConnector: AddressConnector = {
  manifest: uspsManifest,

  buildRequest: buildUspsCoaRequest,

  async push(request, ctx): Promise<ConnectorResult> {
    if (!ctx.accessToken) {
      // No live grant → cannot push. Caller prompts reconnect (or falls back).
      return { outcome: "FAILED", errorCode: "AUTH_EXPIRED", retryable: false };
    }
    const res = await ctx.http.request({
      ...request,
      headers: { ...(request.headers ?? {}), ...authHeaders(ctx) },
    });
    return resultFromStatus(res);
  },

  async verify(input: CanonicalAddressChange, ctx): Promise<ConnectorResult> {
    if (!ctx.accessToken) return { outcome: "SUBMITTED" };
    const res = await ctx.http.request({
      method: "GET",
      url: `${COA_STATUS_ENDPOINT}?eventRef=${encodeURIComponent(input.eventId)}`,
      headers: authHeaders(ctx),
    });
    if (res.ok && bodyStatus(res.body) === "ACTIVE") {
      return { outcome: "CONFIRMED", confirmationNumber: readConfirmation(res.body) };
    }
    // Not yet active — leave it submitted for the reconciliation sweep.
    return { outcome: "SUBMITTED" };
  },

  async healthCheck(ctx) {
    try {
      const res = await ctx.http.request({
        method: "GET",
        url: VALIDATE_ENDPOINT,
        headers: ctx.accessToken ? authHeaders(ctx) : undefined,
      });
      // A healthy USPS Addresses API echoes a normalized address object. A
      // missing shape means the contract drifted — surface it, don't guess.
      const ok = res.ok && !!res.body && typeof res.body === "object" && "address" in res.body;
      return ok ? { ok: true } : { ok: false, reason: "SCHEMA_DRIFT", detail: `status ${res.status}` };
    } catch {
      return { ok: false, reason: "PARTNER_DOWN" };
    }
  },
};

function bodyStatus(body: unknown): string | null {
  if (body && typeof body === "object" && "status" in body) {
    const value = (body as { status?: unknown }).status;
    return typeof value === "string" ? value : null;
  }
  return null;
}
