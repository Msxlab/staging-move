/**
 * Single source of truth for resolving the trusted client IP from request
 * headers. Used by BOTH the rate limiter (resolveClientIP) and the session
 * fingerprint (getUserSession) so the IP bound into a session at creation
 * matches the IP recomputed at validation. A divergence here silently fails
 * the fingerprint check → the session row is invalidated and the cookie is
 * cleared, i.e. a spurious mass logout on any deployment whose edge sets a
 * platform header (x-vercel-forwarded-for / cf-connecting-ip / x-real-ip)
 * that differs from the left-most x-forwarded-for hop.
 *
 * Precedence = the trusted edge header per platform, then the standard
 * left-most forwarded hop, then a stable "anonymous" sentinel. Pure (no
 * imports) so it is safe to use from any runtime without a dependency cycle.
 */
export function resolveClientIpFromHeaders(headers: Headers | null | undefined): string {
  if (!headers) return "anonymous";
  // Vercel's trusted header (only meaningful when running on Vercel).
  if (process.env.VERCEL_ENV) {
    const vercelIp = headers.get("x-vercel-forwarded-for");
    if (vercelIp) return vercelIp.split(",")[0].trim();
  }
  // Cloudflare's trusted header.
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  // Nginx / reverse-proxy trusted header.
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // Standard forwarded header — left-most entry is the original client.
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "anonymous";
}
