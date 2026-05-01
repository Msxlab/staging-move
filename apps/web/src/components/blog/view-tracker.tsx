"use client";

import { useEffect, useRef, useState } from "react";
import {
  getStoredCookieConsent,
  hasAnalyticsConsent,
  subscribeToCookieConsentChanges,
  type CookieConsentStatus,
} from "@/lib/consent";
import { trackEvent } from "@/lib/analytics";

export function BlogViewTracker({ slug, locale }: { slug: string; locale: string }) {
  const [enabled, setEnabled] = useState(false);
  const sentRef = useRef(false);

  useEffect(() => {
    const syncConsent = (status?: CookieConsentStatus) => {
      setEnabled(hasAnalyticsConsent(status));
    };
    syncConsent(getStoredCookieConsent());
    return subscribeToCookieConsentChanges(syncConsent);
  }, []);

  useEffect(() => {
    if (!enabled || sentRef.current) return;
    sentRef.current = true;

    const payload = JSON.stringify({ slug, locale });
    const url = "/api/blog/view";
    trackEvent("blog_viewed", { slug, locale });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [enabled, locale, slug]);

  return null;
}
