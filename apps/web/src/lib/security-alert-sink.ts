/**
 * Threshold alerting on top of the security-event taxonomy (rec B-1).
 *
 * `emitSecurityEvent` already logs every event and exposes a downstream-sink
 * hook (`setSecurityEventSink`). This module is that sink: it watches a few
 * high-signal event types and, when one BURSTS past a threshold inside a short
 * window, raises ONE alert (deduped per type per window) to the observability
 * pipe (Sentry/GlitchTip — which is where alerting rules live) plus an optional
 * ops webhook. A burst of WEBHOOK_SIG_FAILURE / ADMIN_LOGIN_FAILURE /
 * *_SECRET_MISUSE is an attack signal an operator should see, not just a log line.
 *
 * Opt-in: only installed when SECURITY_ALERTS_ENABLED=true (see instrumentation).
 * Counting is in-memory + per-instance (an attack typically hammers one
 * instance, and this is a first alerting layer, not a billing-grade counter).
 * Never throws — it runs on the event hot path.
 */

import { captureMessage } from "@/lib/sentry";
import {
  setSecurityEventSink,
  type SecurityEventPayload,
  type SecurityEventType,
} from "@/lib/security-events";

interface BurstRule {
  threshold: number;
  windowMs: number;
}

/** Event types worth alerting on, with their burst thresholds. */
const ALERT_RULES: Partial<Record<SecurityEventType, BurstRule>> = {
  WEBHOOK_SIG_FAILURE: { threshold: 5, windowMs: 10 * 60_000 },
  ADMIN_LOGIN_FAILURE: { threshold: 5, windowMs: 10 * 60_000 },
  ADMIN_SENSITIVE_ATTEMPT: { threshold: 5, windowMs: 10 * 60_000 },
  CRON_SECRET_MISUSE: { threshold: 3, windowMs: 10 * 60_000 },
  INTERNAL_SECRET_MISUSE: { threshold: 3, windowMs: 10 * 60_000 },
  MFA_FAILURE_BURST: { threshold: 8, windowMs: 10 * 60_000 },
  PWRESET_ABUSE_SIGNAL: { threshold: 10, windowMs: 10 * 60_000 },
  LOCKOUT_STARTED: { threshold: 10, windowMs: 10 * 60_000 },
};

// Re-alert dedup: once a type alerts, stay quiet for this long even if it keeps
// firing, so a sustained attack produces a steady trickle, not a flood.
const ALERT_COOLDOWN_MS = 15 * 60_000;

interface TypeState {
  windowStart: number;
  count: number;
  lastAlertAt: number;
}

const state = new Map<SecurityEventType, TypeState>();

export interface BurstDecision {
  alert: boolean;
  count: number;
  threshold: number;
  windowMs: number;
}

/**
 * Pure-ish (time-injected) burst detector. Increments the rolling window for
 * `type` and reports whether THIS event tips it past the threshold (subject to
 * the cooldown). Exported for unit testing.
 */
export function recordAndDetectBurst(type: SecurityEventType, now: number): BurstDecision | null {
  const rule = ALERT_RULES[type];
  if (!rule) return null;

  const existing = state.get(type);
  // Start a fresh window if none or the previous one has elapsed. lastAlertAt
  // defaults to -Infinity ("never alerted") so the very first burst is never
  // suppressed by the cooldown check below, regardless of clock magnitude.
  if (!existing || now - existing.windowStart >= rule.windowMs) {
    state.set(type, { windowStart: now, count: 1, lastAlertAt: existing?.lastAlertAt ?? Number.NEGATIVE_INFINITY });
    return { alert: false, count: 1, threshold: rule.threshold, windowMs: rule.windowMs };
  }

  existing.count += 1;
  const overThreshold = existing.count >= rule.threshold;
  const cooledDown = now - existing.lastAlertAt >= ALERT_COOLDOWN_MS;
  const alert = overThreshold && cooledDown;
  if (alert) existing.lastAlertAt = now;
  return { alert, count: existing.count, threshold: rule.threshold, windowMs: rule.windowMs };
}

/** Test-only: reset the in-memory window state. */
export function __resetSecurityAlertState(): void {
  state.clear();
}

async function postAlertWebhook(body: Record<string, unknown>): Promise<void> {
  const url = process.env.SECURITY_ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {
    // Best-effort — an alert webhook failure must never affect the request.
  }
}

/** The sink installed into emitSecurityEvent. Never throws. */
export function securityAlertSink(payload: SecurityEventPayload): void {
  try {
    const decision = recordAndDetectBurst(payload.type, Date.now());
    if (!decision?.alert) return;

    const windowMin = Math.round(decision.windowMs / 60_000);
    const summary = `[SECURITY ALERT] ${payload.type}: ${decision.count} events in ${windowMin}m (threshold ${decision.threshold})`;
    captureMessage(summary, "error");
    // Fire-and-forget webhook (no PII — type + counts + group only).
    void postAlertWebhook({
      kind: "security_alert",
      type: payload.type,
      count: decision.count,
      threshold: decision.threshold,
      windowMinutes: windowMin,
      group: payload.group ?? null,
      occurredAt: new Date().toISOString(),
    });
  } catch {
    // Never throw from the event sink.
  }
}

let installed = false;

/**
 * Install the alert sink. Idempotent + opt-in via SECURITY_ALERTS_ENABLED so
 * it is completely inert (and uninstalled) unless an operator turns it on.
 */
export function installSecurityAlertSink(): boolean {
  if (process.env.SECURITY_ALERTS_ENABLED !== "true") return false;
  if (installed) return true;
  setSecurityEventSink(securityAlertSink);
  installed = true;
  return true;
}
