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

function toUspsAddress(address: CanonicalAddress) {
  return {
    streetAddress: address.street1,
    secondaryAddress: address.street2 ?? undefined,
    city: address.city,
    state: address.state,
    ZIPCode: address.zip,
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
