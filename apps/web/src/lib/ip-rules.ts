/**
 * IP Rule Enforcement — In-memory cache for Edge Runtime compatibility.
 *
 * Since Edge Runtime cannot call Prisma/DB directly, IP rules are loaded
 * via an internal API call and cached in memory with a 5-minute TTL.
 * This module is used by middleware to block/allow IPs.
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
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
    // Non-blocking — keep using stale cache
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
  if (!ip || ip === "unknown") return { blocked: false };

  // Refresh cache if stale
  if (Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    await refreshCache(baseUrl);
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
