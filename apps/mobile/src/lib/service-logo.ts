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
  ]);
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
