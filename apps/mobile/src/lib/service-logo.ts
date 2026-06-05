export type MobileServiceLogoSource = {
  category?: string | null;
  providerName?: string | null;
  website?: string | null;
  provider?: { name?: string | null; logoUrl?: string | null; website?: string | null } | null;
  customProvider?: { name?: string | null; website?: string | null } | null;
  providerLogoUrl?: string | null;
  logoUrl?: string | null;
};

function normalizeLogoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// React Native's <Image> cannot decode these formats, even though a browser
// <img> renders them fine. Most provider logos are auto-ingested from favicons,
// which are frequently .ico — so without this gate the stored logo URL fails
// onError and the card silently falls back to the category emoji on mobile.
const NON_RENDERABLE_EXTENSIONS = new Set([".ico", ".svg", ".bmp", ".tif", ".tiff"]);

/**
 * A candidate is usable on mobile only when RN's <Image> can actually load it:
 * an absolute http(s) URL (host-less/relative paths have no origin to resolve
 * against) whose extension isn't one RN cannot decode. URLs with no file
 * extension (e.g. the Google favicon proxy, which returns PNG) are allowed.
 */
function isRenderableLogoUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const dot = parsed.pathname.lastIndexOf(".");
  if (dot === -1) return true;
  return !NON_RENDERABLE_EXTENSIONS.has(parsed.pathname.slice(dot).toLowerCase());
}

function extractDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!hostname || !hostname.includes(".")) return null;
    return hostname;
  } catch {
    return null;
  }
}

function unique(values: Array<string | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function resolveMobileServiceLogoUrls(service: MobileServiceLogoSource): string[] {
  const domain = extractDomain(
    service.provider?.website ||
      service.website ||
      service.customProvider?.website,
  );

  return unique([
    normalizeLogoUrl(service.provider?.logoUrl),
    normalizeLogoUrl(service.providerLogoUrl),
    normalizeLogoUrl(service.logoUrl),
    domain ? `https://logo.clearbit.com/${domain}` : null,
    domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null,
  ]).filter(isRenderableLogoUrl);
}

export function resolveMobileServiceLogoUrl(service: MobileServiceLogoSource): string | null {
  return resolveMobileServiceLogoUrls(service)[0] || null;
}

export function resolveMobileServiceLogoAltName(service: MobileServiceLogoSource): string {
  return (
    service.provider?.name?.trim() ||
    service.customProvider?.name?.trim() ||
    service.providerName?.trim() ||
    "service provider"
  );
}
