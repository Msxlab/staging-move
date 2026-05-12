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

export interface IPRuleLike {
  ipAddress: string;
  type: "WHITELIST" | "BLACKLIST";
  isActive: boolean;
  expiresAt?: string | Date | null;
}

export interface ParsedIPRuleValue {
  normalized: string;
  version: 4 | 6;
  prefixLength: number | null;
  isCidr: boolean;
  isBroad: boolean;
}

export type IPRuleValidationResult =
  | { ok: true; value: ParsedIPRuleValue }
  | { ok: false; reasonCode: string };

let cachedRules: IPRule[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function parseIPv4(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out = (out << 8) + n;
  }
  return out >>> 0;
}

function normalizeIPv4(value: string): string | null {
  const parsed = parseIPv4(value);
  if (parsed === null) return null;
  return [
    (parsed >>> 24) & 255,
    (parsed >>> 16) & 255,
    (parsed >>> 8) & 255,
    parsed & 255,
  ].join(".");
}

function parseIPv6(value: string): bigint | null {
  const lower = value.toLowerCase();
  if (!lower || lower.includes("%") || lower.includes(".")) return null;
  if ((lower.match(/::/g) || []).length > 1) return null;

  const [leftRaw, rightRaw] = lower.split("::");
  const left = leftRaw ? leftRaw.split(":") : [];
  const right = rightRaw ? rightRaw.split(":") : [];
  const validateGroup = (group: string) => /^[0-9a-f]{1,4}$/.test(group);
  if (!left.every(validateGroup) || !right.every(validateGroup)) return null;

  const missing = 8 - (left.length + right.length);
  if (lower.includes("::")) {
    if (missing < 1) return null;
  } else if (missing !== 0) {
    return null;
  }

  const groups = [...left, ...Array(Math.max(missing, 0)).fill("0"), ...right];
  if (groups.length !== 8) return null;

  let out = 0n;
  for (const group of groups) {
    out = (out << 16n) + BigInt(Number.parseInt(group, 16));
  }
  return out;
}

function parseIPAddress(value: string): { version: 4 | 6; numeric: number | bigint; normalized: string } | null {
  const trimmed = value.trim();
  const ipv4 = parseIPv4(trimmed);
  if (ipv4 !== null) {
    return { version: 4, numeric: ipv4, normalized: normalizeIPv4(trimmed) || trimmed };
  }
  const ipv6 = parseIPv6(trimmed);
  if (ipv6 !== null) {
    return { version: 6, numeric: ipv6, normalized: trimmed.toLowerCase() };
  }
  return null;
}

export function parseIPRuleValue(rawValue: unknown): ParsedIPRuleValue | null {
  if (typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed.length > 49) return null;

  const slashCount = (trimmed.match(/\//g) || []).length;
  if (slashCount > 1) return null;

  const [address, prefixRaw] = trimmed.split("/");
  const parsedAddress = parseIPAddress(address);
  if (!parsedAddress) return null;

  if (prefixRaw === undefined) {
    return {
      normalized: parsedAddress.normalized,
      version: parsedAddress.version,
      prefixLength: null,
      isCidr: false,
      isBroad: false,
    };
  }

  if (!/^\d{1,3}$/.test(prefixRaw)) return null;
  const prefixLength = Number(prefixRaw);
  const maxPrefix = parsedAddress.version === 4 ? 32 : 128;
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > maxPrefix) return null;

  const isBroad = parsedAddress.version === 4
    ? prefixLength <= 16
    : prefixLength <= 64;

  return {
    normalized: `${parsedAddress.normalized}/${prefixLength}`,
    version: parsedAddress.version,
    prefixLength,
    isCidr: true,
    isBroad,
  };
}

export function validateIPRuleValue(
  rawValue: unknown,
  options: { allowBroad?: boolean } = {},
): IPRuleValidationResult {
  const parsed = parseIPRuleValue(rawValue);
  if (!parsed) return { ok: false, reasonCode: "invalid_ip_or_cidr" };
  if (parsed.isBroad && !options.allowBroad) return { ok: false, reasonCode: "broad_range_requires_break_glass" };
  return { ok: true, value: parsed };
}

function ruleIsEffective(rule: IPRuleLike, now = new Date()): boolean {
  if (!rule.isActive) return false;
  if (!rule.expiresAt) return true;
  return new Date(rule.expiresAt).getTime() > now.getTime();
}

export function matchesIPRule(ip: string, ruleValue: string): boolean {
  const parsedIp = parseIPAddress(ip);
  const parsedRule = parseIPRuleValue(ruleValue);
  if (!parsedIp || !parsedRule || parsedIp.version !== parsedRule.version) return false;

  const base = parseIPAddress(parsedRule.normalized.split("/")[0]);
  if (!base) return false;

  if (parsedRule.prefixLength === null) {
    return parsedIp.numeric === base.numeric;
  }

  if (parsedRule.version === 4) {
    const shift = 32 - parsedRule.prefixLength;
    if (parsedRule.prefixLength === 0) return true;
    return ((parsedIp.numeric as number) >>> shift) === ((base.numeric as number) >>> shift);
  }

  const prefix = BigInt(parsedRule.prefixLength);
  if (prefix === 0n) return true;
  const mask = ((1n << prefix) - 1n) << (128n - prefix);
  return ((parsedIp.numeric as bigint) & mask) === ((base.numeric as bigint) & mask);
}

export function evaluateIPAccessForRules(
  ip: string,
  rules: IPRuleLike[],
): { blocked: boolean; reason?: string } {
  if (!ip || ip === "unknown" || !parseIPAddress(ip)) return { blocked: false };

  const activeRules = rules.filter((rule) => ruleIsEffective(rule));
  const blacklisted = activeRules.find((rule) => rule.type === "BLACKLIST" && matchesIPRule(ip, rule.ipAddress));
  if (blacklisted) return { blocked: true, reason: "IP address is blocked." };

  const whitelists = activeRules.filter((rule) => rule.type === "WHITELIST");
  if (whitelists.length > 0 && !whitelists.some((rule) => matchesIPRule(ip, rule.ipAddress))) {
    return { blocked: true, reason: "IP address not in whitelist." };
  }

  return { blocked: false };
}

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

  return evaluateIPAccessForRules(ip, cachedRules);
}
