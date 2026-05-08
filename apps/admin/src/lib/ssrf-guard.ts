/**
 * SSRF guard for outbound HTTP fetches that take untrusted URLs.
 *
 * Used by:
 *   - provider logo auto-fetch (logo-ingest.ts)
 *   - any future admin tool that takes an admin-supplied URL and fetches
 *     it server-side
 *
 * The guard rejects:
 *   - non-HTTP(S) schemes (file:, gopher:, dict:, ftp:, …)
 *   - localhost, 127.0.0.0/8, ::1
 *   - 0.0.0.0
 *   - RFC1918 private ranges (10/8, 172.16/12, 192.168/16)
 *   - link-local (169.254.0.0/16, fe80::/10) — covers cloud metadata
 *     IPs like 169.254.169.254 (AWS/GCP) and 100.100.100.200 (AliCloud
 *     special-cased below)
 *   - 100.64.0.0/10 carrier-grade NAT (which AliCloud metadata uses)
 *   - known cloud-metadata hostnames (metadata.google.internal,
 *     metadata.azure.com, …)
 *   - IPv6 ULA (fc00::/7), IPv6 loopback, IPv6 link-local
 *
 * For maximum safety the guard resolves DNS first and re-checks the
 * resolved IPs. Callers should also pass a `redirect: "manual"` flag to
 * `fetch` and re-validate any 3xx Location header through this guard
 * before following.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class SsrfBlockedError extends Error {
  constructor(public readonly reason: string, public readonly url: string) {
    super(`SSRF blocked: ${reason} (${url})`);
    this.name = "SsrfBlockedError";
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata.azure.com",
  "metadata.azure.net",
  "kubernetes.default.svc",
  "kubernetes.default.svc.cluster.local",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".local",
  ".internal",
  ".cluster.local",
];

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed IPv4 — refuse rather than guess
  }
  const [a, b] = parts;
  // 0.0.0.0/8 — "this" network
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 100.64.0.0/10 — CGNAT (AliCloud metadata sits in this range)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 169.254.0.0/16 — link-local (covers 169.254.169.254 metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 — IETF protocol assignments
  if (a === 192 && b === 0) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 — benchmarking
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 224.0.0.0/4 — multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 — reserved
  if (a >= 240) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  // ::ffff:x.x.x.x — IPv4-mapped IPv6, reduce to IPv4 check
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice("::ffff:".length);
    if (isIP(v4) === 4) return isPrivateIPv4(v4);
    return true;
  }
  // Link-local fe80::/10
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true;
  }
  // ULA fc00::/7
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // Documentation 2001:db8::/32
  if (lower.startsWith("2001:db8")) return true;
  // Discard prefix 100::/64 — RFC6666
  if (lower.startsWith("100:")) return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // not a valid IP literal — refuse
}

function hostnameLooksInternal(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (lower.endsWith(suffix)) return true;
  }
  return false;
}

/**
 * Validate a URL string for outbound fetch. Throws `SsrfBlockedError`
 * with a precise reason if the URL is unsafe. On success returns the
 * parsed URL plus the resolved IP address (so the caller can pin the
 * fetch to that IP if desired — though stdlib `fetch` does not
 * directly support that, the resolved IP is logged for incident
 * forensics).
 */
export async function assertSafeOutboundUrl(
  raw: string,
  options: {
    /**
     * If provided, the URL's hostname must equal one of these (case-
     * insensitive). Use this for fetches against known-good third-party
     * services (logo CDNs, etc.) so an attacker can't redirect to an
     * arbitrary host even if DNS rules out internal IPs.
     */
    allowedHostnames?: string[];
  } = {},
): Promise<{ url: URL; resolvedIp: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfBlockedError("invalid_url", raw);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfBlockedError("non_http_scheme", raw);
  }

  // Strip any embedded credentials — they're meaningless for our use
  // case and exist only to confuse log readers.
  if (url.username || url.password) {
    throw new SsrfBlockedError("embedded_credentials", raw);
  }

  const hostname = url.hostname;
  if (!hostname) {
    throw new SsrfBlockedError("missing_hostname", raw);
  }

  if (hostnameLooksInternal(hostname)) {
    throw new SsrfBlockedError("internal_hostname", raw);
  }

  if (options.allowedHostnames && options.allowedHostnames.length > 0) {
    const lower = hostname.toLowerCase();
    const allowed = options.allowedHostnames.some((h) => h.toLowerCase() === lower);
    if (!allowed) {
      throw new SsrfBlockedError("hostname_not_allowlisted", raw);
    }
  }

  // If the hostname is already a literal IP, validate directly.
  const ipKind = isIP(hostname);
  if (ipKind !== 0) {
    if (isPrivateIp(hostname)) {
      throw new SsrfBlockedError("private_ip_literal", raw);
    }
    return { url, resolvedIp: hostname };
  }

  // Resolve DNS and reject if the resolved address is private. This
  // catches "private.example.com -> 10.0.0.1" and DNS-rebinding
  // attempts (the second resolve is at fetch time, but the public IP
  // here at least closes the obvious case).
  let resolvedIp: string;
  try {
    const result = await lookup(hostname, { verbatim: true });
    resolvedIp = result.address;
  } catch {
    throw new SsrfBlockedError("dns_lookup_failed", raw);
  }
  if (isPrivateIp(resolvedIp)) {
    throw new SsrfBlockedError("resolved_private_ip", raw);
  }

  return { url, resolvedIp };
}
