/**
 * IP Rule Enforcement — In-memory cache for Edge Runtime compatibility.
 *
 * Since Edge Runtime cannot call Prisma/DB directly, IP rules are loaded
 * via an internal API call and cached in memory with a short TTL.
 * This module is used by middleware to block/allow IPs.
 *
 * Staleness contract (SEC-RL "ban lag" finding):
 *   - Rules are enforced from an in-memory snapshot refreshed at most once
 *     per CACHE_TTL_MS per instance, so a newly-written BLACKLIST rule takes
 *     effect within ~60s without adding a DB hit to every request. (Was 5
 *     minutes.) Write-through invalidation cannot reach this cache: it lives
 *     in the middleware's Edge module graph, and IPRule writes happen in the
 *     admin app's Node route handlers — hence the short TTL.
 *   - Concurrent stale requests share a single in-flight refresh, and a
 *     failed refresh backs off for REFRESH_BACKOFF_MS while serving the
 *     previous snapshot (previously every request retried the fetch).
 *   - Fail-open by design: IP rules are a targeted ban list; refusing all
 *     traffic when the internal endpoint hiccups would be a worse outcome
 *     than one stale window.
 */

import { getInternalCallerSecret } from "@/lib/internal-secrets";

interface IPRule {
  ipAddress: string;
  type: "WHITELIST" | "BLACKLIST";
  isActive: boolean;
  expiresAt: string | null;
}

let cachedRules: IPRule[] = [];
let cacheLoadedAt = 0;
let lastRefreshAttemptAt = 0;
let refreshInFlight: Promise<void> | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute — bounds BLOCK-rule lag per instance
const REFRESH_BACKOFF_MS = 15 * 1000; // after a failed refresh, retry at most every 15s

/**
 * Load IP rules from the internal API endpoint.
 * Falls back gracefully if the endpoint is unavailable.
 */
async function refreshCache(baseUrl: string): Promise<void> {
  try {
    const secret = getInternalCallerSecret("internal");
    if (!secret) return; // Cannot authenticate, skip

    const res = await fetch(`${baseUrl}/api/internal/ip-rules`, {
      headers: { Authorization: `Bearer ${secret}` },
      next: { revalidate: 0 },
    });

    if (res.ok) {
      const data = await res.json();
      cachedRules = data.rules || [];
      cacheLoadedAt = Date.now();
    }
  } catch {
    // Non-blocking — keep using stale cache; the backoff in checkIPAccess
    // prevents a per-request retry storm.
  }
}

/**
 * Check if an IP is blocked by active blacklist rules.
 * Returns { blocked: true, reason } if blocked, { blocked: false } otherwise.
 */
export async function checkIPAccess(
  ip: string,
  baseUrl: string
): Promise<{ blocked: boolean; reason?: string }> {
  // "anonymous" is the sentinel returned by resolveClientIpFromHeaders when
  // no trusted IP header is present (treated identically to the legacy
  // "unknown"): a missing IP cannot match a specific block/allow rule, so we
  // don't block on it here.
  if (!ip || ip === "unknown" || ip === "anonymous") return { blocked: false };

  // Refresh cache if stale. Single-flight: concurrent stale requests await
  // the same refresh instead of each issuing their own internal API call.
  // After a failed refresh, requests inside the backoff window serve the
  // previous snapshot instead of retrying per request.
  const nowMs = Date.now();
  if (nowMs - cacheLoadedAt > CACHE_TTL_MS) {
    if (!refreshInFlight && nowMs - lastRefreshAttemptAt > REFRESH_BACKOFF_MS) {
      lastRefreshAttemptAt = nowMs;
      refreshInFlight = refreshCache(baseUrl).finally(() => {
        refreshInFlight = null;
      });
    }
    if (refreshInFlight) await refreshInFlight;
  }

  const now = new Date();

  // Check blacklist first
  const blacklisted = cachedRules.find(
    (r) =>
      r.type === "BLACKLIST" &&
      r.isActive &&
      r.ipAddress === ip &&
      (!r.expiresAt || new Date(r.expiresAt) > now)
  );

  if (blacklisted) {
    return { blocked: true, reason: "IP address is blocked." };
  }

  // If there are active whitelist rules, only allow whitelisted IPs
  const hasWhitelist = cachedRules.some(
    (r) => r.type === "WHITELIST" && r.isActive && (!r.expiresAt || new Date(r.expiresAt) > now)
  );

  if (hasWhitelist) {
    const whitelisted = cachedRules.find(
      (r) =>
        r.type === "WHITELIST" &&
        r.isActive &&
        r.ipAddress === ip &&
        (!r.expiresAt || new Date(r.expiresAt) > now)
    );

    if (!whitelisted) {
      return { blocked: true, reason: "IP address not in whitelist." };
    }
  }

  return { blocked: false };
}

/** Test-only: reset module cache state so each test sees a cold cache. */
export function __resetIPRulesCacheForTests(): void {
  cachedRules = [];
  cacheLoadedAt = 0;
  lastRefreshAttemptAt = 0;
  refreshInFlight = null;
}
