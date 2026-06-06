/**
 * USPS Addresses 3.0 validation (Tier 2) — server-side orchestrator.
 *
 * The ONLY place the USPS client secret + token live. The route + UI never see
 * them. Built so it works the instant the operator sets the runtime-config keys
 * (CONNECTOR_USPS_OAUTH_CLIENT_ID / _SECRET / _TOKEN_URL) and flips
 * FEATURE_USPS_VALIDATION on — no code change. Until then every call returns the
 * safe "unavailable" response. EVERY failure path fails OPEN (never throws,
 * never blocks saving an address).
 */

import {
  buildClientCredentialsBody,
  buildUspsAddressValidateUrl,
  parseUspsValidatedAddress,
} from "@locateflow/connectors";
import {
  type AddressValidationInput,
  type AddressValidationResponse,
  type ValidatedAddress,
  ADDRESS_VALIDATION_UNAVAILABLE,
} from "@locateflow/shared";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

async function rc(name: string): Promise<string> {
  try {
    return (await getRuntimeConfigValue(name)) ?? process.env[name] ?? "";
  } catch {
    return process.env[name] ?? "";
  }
}

export async function isUspsValidationFeatureOn(): Promise<boolean> {
  const v = await rc("FEATURE_USPS_VALIDATION");
  return v === "true" || v === "1";
}

interface UspsCreds {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
}

async function resolveCreds(): Promise<UspsCreds | null> {
  const [clientId, clientSecret, tokenUrl] = await Promise.all([
    rc("CONNECTOR_USPS_OAUTH_CLIENT_ID"),
    rc("CONNECTOR_USPS_OAUTH_CLIENT_SECRET"),
    rc("CONNECTOR_USPS_OAUTH_TOKEN_URL"),
  ]);
  if (!clientId || !clientSecret || !tokenUrl) return null;
  try {
    const u = new URL(tokenUrl);
    // Host allow-list: only ever talk to USPS, only over https.
    if (u.protocol !== "https:" || u.host.toLowerCase() !== "apis.usps.com") return null;
  } catch {
    return null;
  }
  return { clientId, clientSecret, tokenUrl };
}

/** Configured = feature on AND creds present. Used by the route to set `enabled`. */
export async function isAddressValidationConfigured(): Promise<boolean> {
  if (!(await isUspsValidationFeatureOn())) return false;
  return (await resolveCreds()) !== null;
}

// client_credentials token cache (USPS tokens last ~8h). Single-flight so a
// burst of address saves mints at most one token.
let cachedToken: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

async function fetchToken(creds: UspsCreds): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const body = buildClientCredentialsBody({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        scope: "addresses",
      });
      const res = await fetch(creds.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams(body).toString(),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
      const token = typeof json.access_token === "string" ? json.access_token : null;
      const ttl = typeof json.expires_in === "number" ? json.expires_in : 3600;
      if (token) cachedToken = { token, expiresAt: now + ttl * 1000 };
      return token;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function differs(input: AddressValidationInput, s: ValidatedAddress): boolean {
  const norm = (x: string | null | undefined) => (x ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return (
    norm(input.street1) !== norm(s.street1) ||
    norm(input.street2) !== norm(s.street2) ||
    norm(input.city) !== norm(s.city) ||
    norm(input.state) !== norm(s.state) ||
    norm(input.zip).slice(0, 5) !== norm(s.zip).slice(0, 5)
  );
}

/**
 * Validate one address with USPS. Returns the standardized suggestion when
 * available; ALWAYS resolves (never throws) and never blocks the caller.
 */
export async function validateAddressWithUsps(input: AddressValidationInput): Promise<AddressValidationResponse> {
  try {
    if (!(await isUspsValidationFeatureOn())) return ADDRESS_VALIDATION_UNAVAILABLE;
    const creds = await resolveCreds();
    if (!creds) return ADDRESS_VALIDATION_UNAVAILABLE;

    const token = await fetchToken(creds);
    // Configured but the token mint failed → enabled (don't hide the feature)
    // but no suggestion this time. The UI shows nothing; the save is unaffected.
    if (!token) return { enabled: true, status: "UNAVAILABLE", suggestion: null, changed: false };

    const url = buildUspsAddressValidateUrl({
      street1: input.street1,
      street2: input.street2 ?? null,
      city: input.city,
      state: input.state,
      zip: input.zip,
    });
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      const status = res.status === 400 || res.status === 404 ? "NO_MATCH" : "UNAVAILABLE";
      return { enabled: true, status, suggestion: null, changed: false };
    }
    const parsed = parseUspsValidatedAddress(await res.json());
    if (!parsed) return { enabled: true, status: "NO_MATCH", suggestion: null, changed: false };
    const suggestion: ValidatedAddress = {
      street1: parsed.street1,
      street2: parsed.street2,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      zipPlus4: parsed.zipPlus4,
      deliverable: parsed.deliverable,
    };
    const changed = differs(input, suggestion);
    return { enabled: true, status: changed ? "CORRECTED" : "VALIDATED", suggestion, changed };
  } catch {
    // Fail open — USPS down / timeout / parse error must never break address entry.
    return ADDRESS_VALIDATION_UNAVAILABLE;
  }
}
