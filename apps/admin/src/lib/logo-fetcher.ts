/**
 * Logo source URL builders. Pure functions — no network I/O.
 *
 * For a given provider website, return an ordered list of candidate logo
 * source URLs. The ingest layer (logo-ingest.ts) tries each in order until
 * one returns a valid image, then uploads the bytes to R2.
 *
 * Sources used (no API key required):
 *   1. Clearbit Logo API — `https://logo.clearbit.com/<domain>` — high quality
 *      branded logos for ~50% of US service providers.
 *   2. DuckDuckGo icon proxy — fetches the site favicon at higher resolution
 *      than Google's S2 endpoint. Works without throttling.
 *   3. Google S2 favicons — last-ditch fallback, always returns *something*
 *      but quality is poor (16-32px).
 */
export type LogoSource = "clearbit" | "duckduckgo" | "google-s2" | "manual-upload";

export interface LogoCandidate {
  source: Exclude<LogoSource, "manual-upload">;
  url: string;
}

const STRIP_PROTOCOL = /^https?:\/\//i;
const STRIP_PATH = /\/.*$/;
const STRIP_PORT = /:\d+$/;
const STRIP_LEADING_WWW = /^www\./i;

/**
 * Extract the bare host from a website URL. Returns null if the input is
 * blank or doesn't contain a parseable hostname.
 *
 * Examples:
 *   "https://www.verizon.com/wireless/" -> "verizon.com"
 *   "spectrum.net"                       -> "spectrum.net"
 *   ""                                   -> null
 */
export function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  const trimmed = website.trim();
  if (!trimmed) return null;

  let host = trimmed
    .replace(STRIP_PROTOCOL, "")
    .replace(STRIP_PATH, "")
    .replace(STRIP_PORT, "")
    .replace(STRIP_LEADING_WWW, "")
    .toLowerCase();

  // Reject anything that doesn't look like a TLD-bearing host.
  if (!host.includes(".") || host.length < 4 || host.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

/**
 * Build candidate URLs for a given website. Returns empty array if domain
 * can't be extracted. Order matters — caller will try each in sequence.
 */
export function buildLogoCandidates(website: string | null | undefined): LogoCandidate[] {
  const domain = extractDomain(website);
  if (!domain) return [];

  return [
    { source: "clearbit", url: `https://logo.clearbit.com/${domain}` },
    { source: "duckduckgo", url: `https://icons.duckduckgo.com/ip3/${domain}.ico` },
    { source: "google-s2", url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128` },
  ];
}
