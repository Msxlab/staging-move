"use client";

import { useState } from "react";
import { getMergedDisplayCategoryIcon } from "@/lib/recommendation-engine";

export interface LogoServiceItem {
  category: string;
  providerName: string;
  website?: string | null;
  provider?: { name?: string | null; logoUrl?: string | null; website?: string | null } | null;
  customProvider?: { id?: string; name?: string | null; website?: string | null } | null;
  providerLogoUrl?: string | null;
  logoUrl?: string | null;
}

function faviconUrlForWebsite(website: string | null | undefined): string | null {
  const raw = website?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");
    return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : null;
  } catch {
    return null;
  }
}

export function resolveServiceLogoUrl(service: LogoServiceItem): string | null {
  return (
    service.provider?.logoUrl ||
    service.providerLogoUrl ||
    service.logoUrl ||
    faviconUrlForWebsite(service.website) ||
    faviconUrlForWebsite(service.provider?.website) ||
    faviconUrlForWebsite(service.customProvider?.website)
  );
}

export function shouldShowServiceLogo(
  logoUrl: string | null | undefined,
  failedLogoUrl: string | null,
): logoUrl is string {
  return Boolean(logoUrl && logoUrl !== failedLogoUrl);
}

export function ServiceLogoMark({
  service,
  className = "w-10 h-10 rounded-xl",
}: {
  service: LogoServiceItem;
  className?: string;
}) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoUrl = resolveServiceLogoUrl(service);
  const showLogo = shouldShowServiceLogo(logoUrl, failedLogoUrl);
  const altName = service.provider?.name || service.providerName;

  return (
    <div className={`${className} bg-foreground/5 border border-border flex items-center justify-center text-lg shrink-0 overflow-hidden`}>
      {showLogo ? (
        <img
          src={logoUrl}
          alt={`${altName} logo`}
          className="h-full w-full rounded-[inherit] object-contain p-1"
          loading="lazy"
          decoding="async"
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <span aria-hidden="true">{getMergedDisplayCategoryIcon(service.category)}</span>
      )}
    </div>
  );
}
