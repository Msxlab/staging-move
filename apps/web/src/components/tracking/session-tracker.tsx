"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { setAnalyticsSessionId, trackPageView } from "@/lib/analytics";
import { getStoredCookieConsent, hasAnalyticsConsent, subscribeToCookieConsentChanges, type CookieConsentStatus } from "@/lib/consent";

function detectBrowser(ua: string) {
  if (ua.includes("Edg")) return { name: "Edge", version: ua.match(/Edg\/([\d.]+)/)?.[1] || "" };
  if (ua.includes("OPR") || ua.includes("Opera")) return { name: "Opera", version: ua.match(/OPR\/([\d.]+)/)?.[1] || "" };
  if (ua.includes("Chrome")) return { name: "Chrome", version: ua.match(/Chrome\/([\d.]+)/)?.[1] || "" };
  if (ua.includes("Safari") && !ua.includes("Chrome")) return { name: "Safari", version: ua.match(/Version\/([\d.]+)/)?.[1] || "" };
  if (ua.includes("Firefox")) return { name: "Firefox", version: ua.match(/Firefox\/([\d.]+)/)?.[1] || "" };
  return { name: "Unknown", version: "" };
}

function detectOS(ua: string) {
  if (ua.includes("Windows NT 10")) return { name: "Windows", version: "10/11" };
  if (ua.includes("Windows")) return { name: "Windows", version: ua.match(/Windows NT ([\d.]+)/)?.[1] || "" };
  if (ua.includes("Mac OS X")) return { name: "macOS", version: ua.match(/Mac OS X ([\d_.]+)/)?.[1]?.replace(/_/g, ".") || "" };
  if (ua.includes("Android")) return { name: "Android", version: ua.match(/Android ([\d.]+)/)?.[1] || "" };
  if (ua.includes("iPhone OS") || ua.includes("iPad")) return { name: "iOS", version: ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") || "" };
  if (ua.includes("Linux")) return { name: "Linux", version: "" };
  if (ua.includes("CrOS")) return { name: "ChromeOS", version: "" };
  return { name: "Unknown", version: "" };
}

function detectDevice(ua: string) {
  if (ua.includes("iPhone")) return { device: "iPhone", type: "Mobile" };
  if (ua.includes("iPad")) return { device: "iPad", type: "Tablet" };
  if (ua.includes("Android") && ua.includes("Mobile")) return { device: "Android Phone", type: "Mobile" };
  if (ua.includes("Android")) return { device: "Android Tablet", type: "Tablet" };
  return { device: "Desktop", type: "Desktop" };
}

function detectPlatform() {
  if (typeof window === "undefined") return "WEB";
  const standalone = (window.navigator as any).standalone || window.matchMedia("(display-mode: standalone)").matches;
  if (standalone) return "PWA";
  return "WEB";
}

export function SessionTracker() {
  const { user } = useCurrentUser();
  const isSignedIn = Boolean(user);
  const pathname = usePathname();
  const sessionIdRef = useRef<string | null>(null);
  const pageViewsRef = useRef(0);
  const initializedRef = useRef(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const syncConsent = (status?: CookieConsentStatus) => {
      setAnalyticsEnabled(hasAnalyticsConsent(status));
    };

    syncConsent(getStoredCookieConsent());
    return subscribeToCookieConsentChanges((status) => {
      syncConsent(status);
    });
  }, []);

  useEffect(() => {
    if (analyticsEnabled) return;
    sessionIdRef.current = null;
    pageViewsRef.current = 0;
    initializedRef.current = false;
    setAnalyticsSessionId(null);
  }, [analyticsEnabled]);

  useEffect(() => {
    if (!isSignedIn || !analyticsEnabled || initializedRef.current) return;
    initializedRef.current = true;

    const ua = navigator.userAgent;
    const browser = detectBrowser(ua);
    const os = detectOS(ua);
    const device = detectDevice(ua);
    const platform = detectPlatform();

    fetch("/api/tracking/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        browser: browser.name,
        browserVersion: browser.version,
        os: os.name,
        osVersion: os.version,
        device: device.device,
        deviceType: device.type,
        platform,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.sessionId) {
          sessionIdRef.current = data.sessionId;
          setAnalyticsSessionId(data.sessionId);
        }
      })
      .catch(() => {});
  }, [analyticsEnabled, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || !analyticsEnabled || !sessionIdRef.current) return;
    pageViewsRef.current += 1;

    // Update session page view count
    fetch("/api/tracking/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionIdRef.current,
        pageViews: pageViewsRef.current,
      }),
    }).catch(() => {});

    // Track granular PAGE_VIEW event
    trackPageView(pathname);
  }, [pathname, analyticsEnabled, isSignedIn]);

  return null;
}
