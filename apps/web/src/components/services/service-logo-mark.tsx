"use client";

import { useState } from "react";
import { CategoryIcon } from "@/components/ui/category-icon";
import { resolveLogoUrl } from "@/lib/logo-url";

export interface LogoServiceItem {
  category: string;
  providerName: string;
  website?: string | null;
  provider?: { name?: string | null; logoUrl?: string | null; website?: string | null } | null;
  customProvider?: { id?: string; name?: string | null; website?: string | null } | null;
  providerLogoUrl?: string | null;
  logoUrl?: string | null;
}

export function resolveServiceLogoUrl(service: LogoServiceItem): string | null {
  return resolveLogoUrl(
    service.provider?.logoUrl,
    service.providerLogoUrl,
    service.logoUrl,
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
        <CategoryIcon category={service.category} className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}
