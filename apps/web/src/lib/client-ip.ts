import { resolveTrustedClientIpFromHeaders } from "@locateflow/shared/trusted-client-ip";

/**
 * Single source of truth for resolving client IPs in web auth/rate-limit code.
 *
 * TRUSTED_PROXY_HEADERS controls how much we trust edge-supplied forwarding
 * headers:
 *   compat (default): preserve the historical platform precedence.
 *   none: ignore all forwarded headers and use the fallback.
 *   vercel/cloudflare/standard: trust only that deployment shape.
 */
export function resolveClientIpFromHeaders(headers: Headers | null | undefined): string {
  return resolveTrustedClientIpFromHeaders(headers, {
    mode: process.env.TRUSTED_PROXY_HEADERS,
    vercelEnv: process.env.VERCEL_ENV,
    fallback: "anonymous",
  });
}
