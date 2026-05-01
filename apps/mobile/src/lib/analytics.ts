/**
 * Mobile analytics tracker.
 * Tracks user events (screen views, taps, searches, errors)
 * and sends them to /api/tracking/event in batches via the API client.
 */

import { api } from "./api";

let _sessionId: string | null = null;
let _eventQueue: Array<{ event: string; page?: string; sessionId?: string; metadata?: any }> = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
let _analyticsEnabled = false;
const _enabledListeners = new Set<(enabled: boolean) => void>();

const FLUSH_INTERVAL_MS = 8000;
const MAX_QUEUE_SIZE = 15;

export function setAnalyticsSessionId(id: string) {
  _sessionId = id;
}

export function setAnalyticsEnabled(enabled: boolean) {
  if (_analyticsEnabled === enabled) return;
  _analyticsEnabled = enabled;
  if (!enabled) {
    _sessionId = null;
    _eventQueue = [];
    if (_flushTimer) {
      clearTimeout(_flushTimer);
      _flushTimer = null;
    }
  }
  _enabledListeners.forEach((listener) => listener(enabled));
}

export function getAnalyticsEnabled() {
  return _analyticsEnabled;
}

export function subscribeAnalyticsEnabled(listener: (enabled: boolean) => void) {
  _enabledListeners.add(listener);
  return () => {
    _enabledListeners.delete(listener);
  };
}

export function trackEvent(
  event: string,
  screen?: string,
  metadata?: Record<string, any>
) {
  if (!_analyticsEnabled) return;
  _eventQueue.push({
    event,
    page: screen,
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

  if (!_analyticsEnabled || _eventQueue.length === 0) return;

  const batch = _eventQueue.splice(0, 50);

  try {
    await api.put<any>("/api/tracking/event", { events: batch });
  } catch {
    // Re-queue on failure (cap to avoid memory leak)
    if (_eventQueue.length < 80) {
      _eventQueue.unshift(...batch);
    }
  }
}

// ── Convenience helpers ──────────────────────────────────

export function trackScreenView(screen: string) {
  trackEvent("SCREEN_VIEW", screen);
}

export function trackTap(element: string, screen?: string) {
  trackEvent("TAP", screen, { element });
}

export function trackSearch(query: string, screen?: string) {
  trackEvent("SEARCH", screen, { query });
}

export function trackFormSubmit(form: string, screen?: string) {
  trackEvent("FORM_SUBMIT", screen, { form });
}

export function trackError(error: string, screen?: string, extra?: Record<string, any>) {
  trackEvent("ERROR", screen, { error, ...extra });
}

export function trackFeatureUse(feature: string, screen?: string) {
  trackEvent("FEATURE_USE", screen, { feature });
}

export function trackLogin() {
  trackEvent("LOGIN");
}

export function trackLogout() {
  trackEvent("LOGOUT");
  flushEvents();
}
