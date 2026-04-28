"use client";

import { useState } from "react";
import { getMergedDisplayCategoryIcon } from "@/lib/recommendation-engine";

export interface LogoServiceItem {
  category: string;
  providerName: string;
  provider?: { name?: string | null; logoUrl?: string | null } | null;
  providerLogoUrl?: string | null;
  logoUrl?: string | null;
}

export function resolveServiceLogoUrl(service: LogoServiceItem): string | null {
  return service.provider?.logoUrl || service.providerLogoUrl || service.logoUrl || null;
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
