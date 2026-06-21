"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Cookie, X } from "lucide-react";
import { getStoredCookieConsent, setStoredCookieConsent } from "@/lib/consent";
import { consentDenied, consentGranted } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export default function CookieConsent({ analyticsNonce }: { analyticsNonce?: string }) {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const compactSurface = ["/sign-in", "/sign-up", "/verify-email", "/reset-password"].some(
    (path) => pathname === path || pathname?.startsWith(`${path}/`),
  );

  useEffect(() => {
    const existing = getStoredCookieConsent();
    if (!existing) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    setStoredCookieConsent("accepted");
    consentGranted(analyticsNonce);
    setVisible(false);
  };

  const handleDecline = () => {
    setStoredCookieConsent("declined");
    consentDenied();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      aria-live="polite"
      className={cn(
        "fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-[22rem] animate-in slide-in-from-bottom-5 duration-300 sm:bottom-4 sm:left-auto sm:right-4 sm:mx-0 sm:max-w-sm",
        compactSurface && "sm:max-w-xs",
      )}
    >
      <div className="max-h-[calc(100svh-1.5rem)] overflow-y-auto rounded-lg border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-2.5">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="flex-1 min-w-0">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Cookie Preferences</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              We use necessary storage to run the site and optional analytics to understand usage. You can accept analytics or decline non-essential analytics.{" "}
              <a href="/cookie-policy" className="text-primary hover:text-primary/80 underline">
                Learn more
              </a>
            </p>
          </div>
          <button
            onClick={handleDecline}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Dismiss cookie banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={handleDecline}
            className="min-h-9 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="min-h-9 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
