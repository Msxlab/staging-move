/**
 * Consent-gated analytics helpers.
 *
 * Google destinations are no-ops unless a public GTM or GA4 ID is configured
 * and the visitor has accepted analytics cookies. The internal signed-in user
 * activity tracker below keeps its previous consent gate and never sends raw
 * email, phone, address, names, provider account IDs, Stripe IDs, OAuth IDs, or
 * app database IDs to Google.
 */

import { hasAnalyticsConsent } from "@/lib/consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type AnalyticsParams = Record<string, unknown>;

let _sessionId: string | null = null;
let _eventQueue: Array<{ event: string; page?: string; sessionId?: string; metadata?: AnalyticsParams }> = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let googleTagLoaded = false;

const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE_SIZE = 20;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "";
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
const PII_KEY_PATTERN =
  /(email|e-mail|phone|address|street|zip|postal|name|user.?id|customer.?id|provider.?account|stripe|oauth|token|secret|password|query|search.?term|message|content|budget|lat|lng|latitude|longitude)/i;
const EMAIL_VALUE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONG_DIGIT_PATTERN = /\d{7,}/;
const SAFE_AGGREGATE_KEYS = new Set(["query_length"]);

function resetAnalyticsState() {
  _sessionId = null;
  _eventQueue = [];
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
}

function googleDestination() {
  if (GTM_ID) return "gtm";
  if (GA_MEASUREMENT_ID) return "ga4";
  return null;
}

export function hasGoogleAnalyticsConfig() {
  return Boolean(googleDestination());
}

function sanitizeAnalyticsParams(params: AnalyticsParams = {}) {
  const safe: AnalyticsParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (!SAFE_AGGREGATE_KEYS.has(key) && PII_KEY_PATTERN.test(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || EMAIL_VALUE_PATTERN.test(trimmed) || LONG_DIGIT_PATTERN.test(trimmed)) continue;
      safe[key] = trimmed.slice(0, 120);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      safe[key] = value
        .filter((item) => ["string", "number", "boolean"].includes(typeof item))
        .slice(0, 10);
    }
  }
  return safe;
}

function ensureDataLayer() {
  if (typeof window === "undefined") return null;
  window.dataLayer = window.dataLayer || [];
  return window.dataLayer;
}

function appendScript(src: string, nonce?: string, marker?: string) {
  if (typeof document === "undefined") return;
  if (marker && document.querySelector(`script[data-locateflow-analytics="${marker}"]`)) {
    return;
  }
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  if (nonce) script.nonce = nonce;
  if (marker) script.dataset.locateflowAnalytics = marker;
  document.head.appendChild(script);
}

export function consentGranted(nonce?: string) {
  if (typeof window === "undefined") return;
  const destination = googleDestination();
  if (!destination || !hasAnalyticsConsent()) return;

  const dataLayer = ensureDataLayer();
  if (!dataLayer) return;

  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      dataLayer.push(args);
    };
  }

  window.gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  if (googleTagLoaded) return;

  if (destination === "gtm") {
    dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    appendScript(
      `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`,
      nonce,
      "gtm",
    );
  } else {
    appendScript(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`,
      nonce,
      "ga4",
    );
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false,
      anonymize_ip: true,
    });
  }

  googleTagLoaded = true;
}

export function consentDenied() {
  if (typeof window === "undefined") return;
  resetAnalyticsState();
  if (!window.gtag) return;
  window.gtag("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

export function pageView(url: string, title?: string) {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return;
  const destination = googleDestination();
  if (!destination) return;

  const payload = sanitizeAnalyticsParams({
    page_location: url,
    page_title: title || document.title,
  });

  if (destination === "gtm") {
    ensureDataLayer()?.push({ event: "page_view", ...payload });
    return;
  }

  window.gtag?.("event", "page_view", payload);
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return;
  const destination = googleDestination();
  if (!destination) return;

  const eventName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 40);
  if (!eventName) return;

  const payload = sanitizeAnalyticsParams(params);

  if (destination === "gtm") {
    ensureDataLayer()?.push({ event: eventName, ...payload });
    return;
  }

  window.gtag?.("event", eventName, payload);
}

export function setAnalyticsSessionId(id: string | null) {
  if (!hasAnalyticsConsent()) {
    _sessionId = null;
    return;
  }
  _sessionId = id;
}

function trackInternalEvent(
  event: string,
  page?: string,
  metadata?: AnalyticsParams,
) {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) {
    resetAnalyticsState();
    return;
  }

  _eventQueue.push({
    event,
    page: page || (typeof window !== "undefined" ? window.location.pathname : undefined),
    sessionId: _sessionId || undefined,
    metadata,
  });

  if (_eventQueue.length >= MAX_QUEUE_SIZE) {
    flushEvents();
  } else if (!_flushTimer) {
    _flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL_MS);
  }
}

async function flushEvents() {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }

  if (!hasAnalyticsConsent()) {
    resetAnalyticsState();
    return;
  }

  if (_eventQueue.length === 0) return;

  const batch = _eventQueue.splice(0, 50);

  try {
    await fetch("/api/tracking/event", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    if (_eventQueue.length < 100) {
      _eventQueue.unshift(...batch);
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushEvents();
    }
  });

  window.addEventListener("beforeunload", () => {
    flushEvents();
  });
}

export function trackPageView(page?: string) {
  trackInternalEvent("PAGE_VIEW", page);
}

export function trackSearch(query: string, page?: string) {
  trackInternalEvent("SEARCH", page, { query_length: query.length });
}

export function trackClick(element: string, page?: string) {
  trackInternalEvent("BUTTON_CLICK", page, { element });
}

export function trackFormSubmit(form: string, page?: string) {
  trackInternalEvent("FORM_SUBMIT", page, { form });
}

export function trackError(error: string, page?: string, extra?: AnalyticsParams) {
  trackInternalEvent("ERROR", page, { error, ...extra });
}

export function trackFeatureUse(feature: string, page?: string) {
  trackInternalEvent("FEATURE_USE", page, { feature });
}

export function trackExport(type: string, page?: string) {
  trackInternalEvent("EXPORT", page, { type });
}

export function trackLogin() {
  trackInternalEvent("LOGIN");
}

export function trackLogout() {
  trackInternalEvent("LOGOUT");
  flushEvents();
}
