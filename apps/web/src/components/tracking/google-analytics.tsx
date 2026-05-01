"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  consentDenied,
  consentGranted,
  hasGoogleAnalyticsConfig,
  pageView,
  trackEvent,
} from "@/lib/analytics";
import {
  getStoredCookieConsent,
  hasAnalyticsConsent,
  subscribeToCookieConsentChanges,
  type CookieConsentStatus,
} from "@/lib/consent";

const SENSITIVE_PAGE_PREFIXES = [
  "/api",
  "/reset-password",
  "/verify-email",
  "/blog/preview",
];

function safePageLocation(pathname: string | null) {
  if (typeof window === "undefined" || !pathname) return null;
  if (SENSITIVE_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }
  return `${window.location.origin}${pathname}`;
}

function routeEventName(pathname: string | null) {
  if (!pathname) return null;
  if (pathname === "/pricing") return "pricing_viewed";
  if (pathname === "/onboarding") return "onboarding_started";
  if (pathname === "/moving/new") return "moving_plan_started";
  if (pathname === "/contact" || pathname === "/support") {
    return "support_contact_started";
  }
  return null;
}

export function GoogleAnalytics({ nonce }: { nonce?: string }) {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const lastPageViewRef = useRef<string | null>(null);
  const configured = hasGoogleAnalyticsConfig();
  const pageLocation = useMemo(() => safePageLocation(pathname), [pathname]);

  useEffect(() => {
    if (!configured) return;

    const syncConsent = (status?: CookieConsentStatus) => {
      const allowed = hasAnalyticsConsent(status);
      setEnabled(allowed);
      if (allowed) {
        consentGranted(nonce);
      } else {
        consentDenied();
      }
    };

    syncConsent(getStoredCookieConsent());
    return subscribeToCookieConsentChanges(syncConsent);
  }, [configured, nonce]);

  useEffect(() => {
    if (!configured || !enabled || !pageLocation) return;
    if (lastPageViewRef.current === pageLocation) return;
    lastPageViewRef.current = pageLocation;

    pageView(pageLocation, document.title);
    const eventName = routeEventName(pathname);
    if (eventName) {
      trackEvent(eventName, { page_path: pathname || "/" });
    }
  }, [configured, enabled, pageLocation, pathname]);

  return null;
}
