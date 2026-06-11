// FMCSA QCMobile carrier cross-check for the admin mover-verification queue.
// =============================================================================
// Given a USDOT number, look up the carrier in the live FMCSA register so a
// reviewer can confirm a mover application before listing it: is the carrier
// allowed to operate, does it hold household-goods (HHG) authority, and what is
// its safety rating. KEYED — needs the free FMCSA QCMobile web key (runtime
// config FMCSA_WEBKEY). Unset key → graceful `not_configured` (the reviewer
// verifies manually); the queue never depends on this call succeeding.
//
// ENDPOINTS (base https://mobile.fmcsa.dot.gov/qc/services), webKey query param:
//   • carriers/{dot}                  → content.carrier { legalName, dbaName,
//                                        allowedToOperate (Y/N), safetyRating
//                                        (S/C/U), phyState }
//   • carriers/{dot}/cargo-carried    → cargo classes; "Household Goods" present
//                                        ⇒ HHG-authorized.
//
// Field names VERIFIED 2026-06-11 from the FMCSA developer docs + the public Go
// wrapper (github.com/brandenc40/qcmobile): legalName / dbaName /
// allowedToOperate / safetyRating / phyState on the carrier; cargo classes on
// cargo-carried. The exact response NESTING can vary, so every extractor reads
// defensively and the whole lookup degrades to `error` on anything unexpected —
// confirm the mapping with one live call when the key is issued.
//
// GRACEFUL DEGRADATION CONTRACT (same shape as the web dossier libs): never
// throws into a caller. Missing key → not_configured; carrier not in register →
// not_found; network/parse/HTTP error → error.

import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";

export type FmcsaLookupStatus = "ok" | "not_found" | "not_configured" | "error";

export interface FmcsaCarrierResult {
  status: FmcsaLookupStatus;
  usdotNumber: number;
  legalName: string | null;
  dbaName: string | null;
  /** FMCSA "allowed to operate" flag (Y → true). Also our authority-active signal. */
  authorityActive: boolean | null;
  /** Holds household-goods authority (from the cargo-carried classes). */
  hhgAuthorized: boolean | null;
  /** Normalized safety rating: Satisfactory | Conditional | Unsatisfactory | raw. */
  safetyRating: string | null;
  /** Physical state of the carrier, when reported. */
  phyState: string | null;
  reason: string | null;
  source: { name: "FMCSA QCMobile"; url: "https://mobile.fmcsa.dot.gov/" };
}

const BASE = "https://mobile.fmcsa.dot.gov/qc/services";
const REQUEST_TIMEOUT_MS = 5000;

const SOURCE = { name: "FMCSA QCMobile", url: "https://mobile.fmcsa.dot.gov/" } as const;

function degraded(status: FmcsaLookupStatus, usdotNumber: number, reason: string): FmcsaCarrierResult {
  return {
    status,
    usdotNumber,
    legalName: null,
    dbaName: null,
    authorityActive: null,
    hhgAuthorized: null,
    safetyRating: null,
    phyState: null,
    reason,
    source: SOURCE,
  };
}

/** "Y"/"N" (case-insensitive) → boolean; anything else → null. */
export function parseYesNo(raw: unknown): boolean | null {
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  if (v === "Y" || v === "YES" || v === "TRUE") return true;
  if (v === "N" || v === "NO" || v === "FALSE") return false;
  return null;
}

/** FMCSA safety-rating code → plain English; unknown codes pass through trimmed. */
export function normalizeSafetyRating(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  switch (v.toUpperCase()) {
    case "S":
      return "Satisfactory";
    case "C":
      return "Conditional";
    case "U":
      return "Unsatisfactory";
    case "N":
    case "NOT RATED":
    case "NONE":
      return null;
    default:
      return v;
  }
}

interface RawCarrier {
  legalName?: unknown;
  dbaName?: unknown;
  allowedToOperate?: unknown;
  safetyRating?: unknown;
  phyState?: unknown;
}

/** Pull the carrier object out of a `carriers/{dot}` response, defensively. */
export function extractCarrier(payload: unknown): RawCarrier | null {
  if (!payload || typeof payload !== "object") return null;
  const content = (payload as { content?: unknown }).content;
  if (!content || typeof content !== "object") return null;
  // Documented shape: content.carrier. Some responses wrap content as an array.
  const carrier = Array.isArray(content)
    ? (content[0] as { carrier?: unknown })?.carrier
    : (content as { carrier?: unknown }).carrier;
  if (!carrier || typeof carrier !== "object") return null;
  return carrier as RawCarrier;
}

/**
 * Detect household-goods authority from a `cargo-carried` response. The class
 * list lives under content (array) or content.cargoClassList; an entry whose
 * description mentions "Household Goods" means HHG-authorized. Returns null when
 * the shape is unrecognized (so the caller leaves HHG unknown, never false).
 */
export function extractHhgAuthorized(payload: unknown): boolean | null {
  if (!payload || typeof payload !== "object") return null;
  const content = (payload as { content?: unknown }).content;
  const list: unknown[] = Array.isArray(content)
    ? content
    : Array.isArray((content as { cargoClassList?: unknown[] })?.cargoClassList)
      ? (content as { cargoClassList: unknown[] }).cargoClassList
      : [];
  if (list.length === 0) return null;
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const desc = [o.cargoClassDesc, o.cargoClassName, o.description, (o.cargoClass as Record<string, unknown>)?.cargoClassDesc]
      .map((v) => (typeof v === "string" ? v.toLowerCase() : ""))
      .join(" ");
    if (desc.includes("household goods")) return true;
  }
  return false;
}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cross-check a USDOT number against the FMCSA QCMobile register.
 *
 * GRACEFUL DEGRADATION: never throws. not_configured (no key), not_found (no
 * carrier), error (network/parse/HTTP), or ok with the parsed fields.
 */
export async function lookupFmcsaCarrier(usdotNumber: number): Promise<FmcsaCarrierResult> {
  if (!Number.isFinite(usdotNumber) || usdotNumber <= 0) {
    return degraded("error", usdotNumber, "invalid_usdot");
  }
  const key = (await getAdminRuntimeConfigValue("FMCSA_WEBKEY").catch(() => null))?.trim() || null;
  if (!key) return degraded("not_configured", usdotNumber, "fmcsa_webkey_missing");

  const q = encodeURIComponent(key);
  try {
    const carrierRes = await fetchJson(`${BASE}/carriers/${usdotNumber}?webKey=${q}`);
    if (!carrierRes.ok) return degraded("error", usdotNumber, `http_${carrierRes.status}`);
    const carrier = extractCarrier(carrierRes.body);
    if (!carrier) return degraded("not_found", usdotNumber, "carrier_not_found");

    // HHG authority is a second, independent call — best-effort: if it fails we
    // still return the carrier with hhgAuthorized = null (unknown, not false).
    let hhgAuthorized: boolean | null = null;
    try {
      const cargoRes = await fetchJson(`${BASE}/carriers/${usdotNumber}/cargo-carried?webKey=${q}`);
      if (cargoRes.ok) hhgAuthorized = extractHhgAuthorized(cargoRes.body);
    } catch {
      hhgAuthorized = null;
    }

    return {
      status: "ok",
      usdotNumber,
      legalName: typeof carrier.legalName === "string" ? carrier.legalName.trim() || null : null,
      dbaName: typeof carrier.dbaName === "string" ? carrier.dbaName.trim() || null : null,
      authorityActive: parseYesNo(carrier.allowedToOperate),
      hhgAuthorized,
      safetyRating: normalizeSafetyRating(carrier.safetyRating),
      phyState: typeof carrier.phyState === "string" ? carrier.phyState.trim().toUpperCase() || null : null,
      reason: null,
      source: SOURCE,
    };
  } catch (error) {
    return degraded("error", usdotNumber, error instanceof Error ? error.message : "fmcsa_request_failed");
  }
}
