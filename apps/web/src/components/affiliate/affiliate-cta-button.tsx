"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AFFILIATE_DISCLOSURE_SHORT } from "./affiliate-disclosure";

type AffiliateSource = "provider_detail" | "services" | "recommendation" | "providers" | "moving";

type AffiliateCtaButtonProps = {
  providerId: string;
  source: AffiliateSource;
  /** Attribution context — the address the user is acting on, when known. */
  addressId?: string | null;
  label?: string;
  className?: string;
  iconClassName?: string;
  /**
   * Set when the CTA is rendered inside a clickable parent (e.g. a card wrapped
   * in a <Link>) so the click doesn't also navigate.
   */
  stopPropagation?: boolean;
};

const DEFAULT_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-60";

/**
 * Shared "Get started" affiliate CTA. POSTs the click to the server, which
 * resolves the provider's stored https URL (the browser never holds or trusts
 * the affiliate link) and opens it in a new tab. Tracking failures never block
 * the surface. One component for every web surface so the behavior can't drift.
 */
export function AffiliateCtaButton({
  providerId,
  source,
  addressId,
  label = "Get started",
  className,
  iconClassName = "h-3.5 w-3.5",
  stopPropagation = false,
}: AffiliateCtaButtonProps) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        if (stopPropagation) {
          e.preventDefault();
          e.stopPropagation();
        }
        setBusy(true);
        try {
          const res = await fetch("/api/affiliate/click", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ providerId, source, addressId: addressId ?? undefined }),
          });
          const data = await res.json().catch(() => null);
          if (res.ok && data?.url) {
            window.open(data.url, "_blank", "noopener,noreferrer");
          }
        } catch {
          // Non-critical CTA — never block the page on a tracking failure.
        } finally {
          setBusy(false);
        }
      }}
      className={className ?? DEFAULT_CLASS}
      aria-label={`${label} (opens in a new tab)`}
      // FTC material-connection disclosure adjacent to every affiliate CTA; the
      // visible <AffiliateDisclosure /> carries the conspicuous on-surface copy.
      title={AFFILIATE_DISCLOSURE_SHORT}
    >
      <Sparkles className={iconClassName} aria-hidden />
      {label}
    </button>
  );
}
