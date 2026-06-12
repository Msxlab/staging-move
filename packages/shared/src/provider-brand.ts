/**
 * Brand identity for a service provider — used to cluster sibling services of the
 * same company so they read as one brand's offerings instead of accidental
 * duplicates in search (e.g. "Chase" the bank and "Chase Credit Cards" are two
 * real, separate move tasks, but adjacent in a flat search they look like a dumb
 * dupe).
 *
 * - `brandKey` is the stable grouping key: the registrable domain of the
 *   provider's website (chase.com and creditcards.chase.com both map to
 *   "chase.com"), falling back to a normalized brand-from-name when there is no
 *   usable website. This is what the audit's "cluster by data, not by guessing
 *   from the name string" recommendation needs — derived, not hand-maintained.
 * - `brandLabel` is the human display name: the provider name with a trailing
 *   service-type phrase stripped ("Chase Credit Cards" -> "Chase").
 */
export interface ProviderBrand {
  brandKey: string;
  brandLabel: string;
}

// Common 2-part public suffixes. US providers are almost all single-part
// (.com/.org/.net), so this only guards against collapsing foo.co.uk to "co.uk".
const KNOWN_MULTI_PART_SUFFIXES = new Set([
  "co.uk",
  "com.au",
  "co.nz",
  "co.jp",
  "com.br",
  "co.in",
]);

// Trailing service-type words to strip so the brand label is the company, not the
// product line. Order-independent; only the LAST match is removed.
const SERVICE_SUFFIX_RE =
  /\s+(credit cards?|cards?|bank(?:ing)?|insurance|mortgage|home loans?|auto)$/i;

/**
 * The registrable domain (eTLD+1) of a website URL, lower-cased, `www.` stripped.
 * Returns null when there is no usable hostname.
 */
export function registrableDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  let host: string;
  try {
    host = new URL(website.includes("://") ? website : `https://${website}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return host || null;
  const lastTwo = labels.slice(-2).join(".");
  if (KNOWN_MULTI_PART_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

function brandLabelFromName(name: string): string {
  const trimmed = name.trim();
  return trimmed.replace(SERVICE_SUFFIX_RE, "").trim() || trimmed;
}

export function getProviderBrand(input: { website?: string | null; name: string }): ProviderBrand {
  const brandLabel = brandLabelFromName(input.name);
  const domain = registrableDomain(input.website);
  if (domain) return { brandKey: domain, brandLabel };
  // No usable website → group by the normalized brand-from-name, so two services
  // of the same brand still cluster even without a domain.
  const key = brandLabel.toLowerCase().replace(/\s+/g, "-") || "unknown";
  return { brandKey: `name:${key}`, brandLabel };
}
