/**
 * Client-side analytics tracker for web.
 * Tracks user events (page views, clicks, searches, form submits, errors)
 * and sends them to /api/tracking/event in batches.
 */

import { hasAnalyticsConsent } from "@/lib/consent";

let _sessionId: string | null = null;
let _eventQueue: Array<{ event: string; page?: string; sessionId?: string; metadata?: any }> = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL_MS = 5000; // flush every 5 seconds
const MAX_QUEUE_SIZE = 20; // flush when queue reaches this size

function resetAnalyticsState() {
  _sessionId = null;
  _eventQueue = [];
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
}

export function setAnalyticsSessionId(id: string | null) {
  if (!hasAnalyticsConsent()) {
    _sessionId = null;
    return;
  }
  _sessionId = id;
}

export function trackEvent(
  event: string,
  page?: string,
  metadata?: Record<string, any>
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
    // Re-queue on failure (but cap to avoid memory leaks)
    if (_eventQueue.length < 100) {
      _eventQueue.unshift(...batch);
    }
  }
}

// Flush on page unload
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

// ── Convenience helpers ──────────────────────────────────

export function trackPageView(page?: string) {
  trackEvent("PAGE_VIEW", page);
}

export function trackSearch(query: string, page?: string) {
  trackEvent("SEARCH", page, { query });
}

export function trackClick(element: string, page?: string) {
  trackEvent("BUTTON_CLICK", page, { element });
}

export function trackFormSubmit(form: string, page?: string) {
  trackEvent("FORM_SUBMIT", page, { form });
}

export function trackError(error: string, page?: string, extra?: Record<string, any>) {
  trackEvent("ERROR", page, { error, ...extra });
}

export function trackFeatureUse(feature: string, page?: string) {
  trackEvent("FEATURE_USE", page, { feature });
}

export function trackExport(type: string, page?: string) {
  trackEvent("EXPORT", page, { type });
}

export function trackLogin() {
  trackEvent("LOGIN");
}

export function trackLogout() {
  trackEvent("LOGOUT");
  flushEvents();
}
