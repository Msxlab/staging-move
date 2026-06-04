export type MobileServiceLogoSource = {
  category?: string | null;
  providerName?: string | null;
  provider?: { name?: string | null; logoUrl?: string | null } | null;
  providerLogoUrl?: string | null;
  logoUrl?: string | null;
};

function normalizeLogoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveMobileServiceLogoUrl(service: MobileServiceLogoSource): string | null {
  return (
    normalizeLogoUrl(service.provider?.logoUrl) ||
    normalizeLogoUrl(service.providerLogoUrl) ||
    normalizeLogoUrl(service.logoUrl)
  );
}

export function resolveMobileServiceLogoAltName(service: MobileServiceLogoSource): string {
  return (
    service.provider?.name?.trim() ||
    service.providerName?.trim() ||
    "service provider"
  );
}
