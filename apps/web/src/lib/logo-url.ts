export function normalizeLogoUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    const isGoogleFavicon = (host === "google.com" || host === "www.google.com") && path.startsWith("/s2/favicons");
    const isGstaticFavicon = (host === "gstatic.com" || host.endsWith(".gstatic.com")) && path.includes("favicon");

    return isGoogleFavicon || isGstaticFavicon ? null : raw;
  } catch {
    return raw;
  }
}

export function resolveLogoUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const logoUrl = normalizeLogoUrl(candidate);
    if (logoUrl) return logoUrl;
  }
  return null;
}
