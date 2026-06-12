export type TrustedProxyHeaderMode =
  | "compat"
  | "none"
  | "vercel"
  | "cloudflare"
  | "standard";

export interface HeaderReader {
  get(name: string): string | null;
}

export interface TrustedClientIpOptions {
  mode?: string | null;
  vercelEnv?: string | null;
  fallback?: string;
}

export function normalizeTrustedProxyHeaderMode(
  raw: string | null | undefined,
): TrustedProxyHeaderMode {
  const value = raw?.trim().toLowerCase();
  if (!value || value === "auto" || value === "compat") return "compat";
  if (value === "false" || value === "0" || value === "off" || value === "none") return "none";
  if (value === "true" || value === "1" || value === "on" || value === "standard") return "standard";
  if (value === "vercel") return "vercel";
  if (value === "cloudflare" || value === "cf") return "cloudflare";
  return "compat";
}

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  if (!first) return null;
  if (first.length > 45 || /\s/.test(first)) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(first)) return null;
  if (!isValidIpCandidate(first)) return null;
  return first;
}

function firstHeaderIp(headers: HeaderReader, name: string): string | null {
  return firstHeaderValue(headers.get(name));
}

function isValidIpv4Candidate(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const octet = Number(part);
    return Number.isInteger(octet) && octet >= 0 && octet <= 255;
  });
}

function isValidIpv6Candidate(value: string): boolean {
  if (!value.includes(":")) return false;
  try {
    new URL(`http://[${value}]`);
    return true;
  } catch {
    return false;
  }
}

function isValidIpCandidate(value: string): boolean {
  return isValidIpv4Candidate(value) || isValidIpv6Candidate(value);
}

export function resolveTrustedClientIpFromHeaders(
  headers: HeaderReader | null | undefined,
  options: TrustedClientIpOptions = {},
): string {
  const fallback = options.fallback || "anonymous";
  if (!headers) return fallback;

  const mode = normalizeTrustedProxyHeaderMode(options.mode);
  if (mode === "none") return fallback;

  if (mode === "vercel") {
    return firstHeaderIp(headers, "x-vercel-forwarded-for") || fallback;
  }

  if (mode === "cloudflare") {
    return firstHeaderIp(headers, "cf-connecting-ip") || fallback;
  }

  if (mode === "standard") {
    return firstHeaderIp(headers, "x-real-ip") || firstHeaderIp(headers, "x-forwarded-for") || fallback;
  }

  if (options.vercelEnv) {
    const vercelIp = firstHeaderIp(headers, "x-vercel-forwarded-for");
    if (vercelIp) return vercelIp;
  }
  return (
    firstHeaderIp(headers, "cf-connecting-ip") ||
    firstHeaderIp(headers, "x-real-ip") ||
    firstHeaderIp(headers, "x-forwarded-for") ||
    fallback
  );
}
