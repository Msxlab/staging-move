/**
 * USPS connector — request mapping (pure).
 *
 * Maps LocateFlow's canonical address change onto a USPS Change-of-Address
 * request. This is a pure, deterministic function so it can be locked down with
 * recorded fixtures in contract tests — building a request never sends it.
 *
 * NOTE: the exact endpoint/payload shape below mirrors the modern USPS APIs
 * platform (`apis.usps.com`, OAuth2) and is illustrative — it is finalized
 * against USPS's published spec during partner onboarding. Filing a consumer
 * COA programmatically also requires authorized-agent status; see ./index.ts.
 */

import type { CanonicalAddress, CanonicalAddressChange, ConnectorRequest } from "../core";

const COA_ENDPOINT = "https://apis.usps.com/addresses/v3/change-of-address";

/** Split a display name into first / last for partner forms that demand both. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export function toUspsAddress(address: CanonicalAddress) {
  return {
    streetAddress: address.street1,
    secondaryAddress: address.street2 ?? undefined,
    city: address.city,
    state: address.state,
    ZIPCode: address.zip,
  };
}

// ── USPS Addresses 3.0 validation (Tier 2) — pure URL builder + parser ──

const VALIDATE_BASE = "https://apis.usps.com/addresses/v3/address";

export interface UspsAddressFields {
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
}

/** Build the GET URL for the USPS address-validation endpoint. Pure (no send). */
export function buildUspsAddressValidateUrl(addr: UspsAddressFields): string {
  const q = new URLSearchParams();
  if (addr.street1) q.set("streetAddress", addr.street1);
  if (addr.street2) q.set("secondaryAddress", addr.street2);
  if (addr.city) q.set("city", addr.city);
  if (addr.state) q.set("state", addr.state);
  if (addr.zip) q.set("ZIPCode", addr.zip.slice(0, 5));
  return `${VALIDATE_BASE}?${q.toString()}`;
}

export interface UspsValidatedAddress {
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  zipPlus4: string | null;
  deliverable: boolean | null;
}

/**
 * Parse a USPS Addresses 3.0 response into a normalized address. Lenient on
 * purpose — the exact field casing is finalized at partner onboarding, so we
 * accept the documented shape and fall back to null (caller treats as NO_MATCH).
 */
export function parseUspsValidatedAddress(body: unknown): UspsValidatedAddress | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, any>;
  const a = (root.address && typeof root.address === "object" ? root.address : root) as Record<string, any>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const street1 = str(a.streetAddress);
  const city = str(a.city);
  const state = str(a.state);
  const zip = str(a.ZIPCode) || str(a.zipCode);
  if (!street1 || !city || !state || !zip) return null;
  const info = (root.additionalInfo && typeof root.additionalInfo === "object" ? root.additionalInfo : {}) as Record<string, any>;
  const dpv = str(info.DPVConfirmation);
  return {
    street1,
    street2: str(a.secondaryAddress) || null,
    city,
    state,
    zip: zip.slice(0, 5),
    zipPlus4: str(a.ZIPPlus4) || null,
    deliverable: dpv ? dpv === "Y" : null,
  };
}

/** Build the USPS COA outbound request from a canonical change. */
export function buildUspsCoaRequest(input: CanonicalAddressChange): ConnectorRequest {
  const { firstName, lastName } = splitName(input.fullName);

  return {
    method: "POST",
    url: COA_ENDPOINT,
    headers: { "Content-Type": "application/json" },
    body: {
      contact: { firstName, lastName, email: input.fields.accountEmail ?? undefined },
      // USPS distinguishes individual / family / business moves. We default to
      // INDIVIDUAL; household/business selection is layered in upstream from the
      // address label and is out of scope for this reference template.
      moveType: "INDIVIDUAL",
      // `from` is null only on a user's first-ever address; COA needs an origin,
      // so the dispatcher never routes a null-origin change to USPS.
      oldAddress: input.from ? toUspsAddress(input.from) : undefined,
      newAddress: toUspsAddress(input.to),
      moveEffectiveDate: input.effectiveDate ?? undefined,
    },
  };
}
