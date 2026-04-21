/**
 * IP Rule Enforcement for Admin — In-memory cache for Edge Runtime compatibility.
 *
 * Loads IP rules via internal API and caches with 5-minute TTL.
 * Used by admin middleware to block/allow IPs.
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

async function refreshCache(baseUrl: string): Promise<void> {
  try {
    const secret = getInternalCallerSecret("internal");
    if (!secret) return;

    const res = await fetch(`${baseUrl}/api/internal/ip-rules`, {
      headers: { Authorization: `Bearer ${secret}` },
    });

    if (res.ok) {
      const data = await res.json();
      cachedRules = data.rules || [];
      cacheLoadedAt = Date.now();
    }
  } catch {
    // Non-blocking
  }
}

export async function checkIPAccess(
  ip: string,
  baseUrl: string
): Promise<{ blocked: boolean; reason?: string }> {
  if (!ip || ip === "unknown") return { blocked: false };

  if (Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    await refreshCache(baseUrl);
  }

  const now = new Date();

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
