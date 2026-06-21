import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { adminRoleRequiresMfa } from "@/lib/admin-roles";
import { checkIPAccess } from "@/lib/ip-rules";
import { getInternalCallerSecret } from "@/lib/internal-secrets";
import { generateAdminSessionFingerprint } from "@/lib/session-fingerprint";
import { resolveTrustedClientIpFromHeaders } from "@locateflow/shared/trusted-client-ip";

// NOTE: Do NOT import PrismaClient here — middleware runs on Edge Runtime
// where Node.js-only DB drivers (SQLite/libSQL) cannot execute.
// The isActive check is handled by requireAdmin() in each API route instead.

const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
if (!adminJwtSecret || adminJwtSecret.length < 32) {
  throw new Error("ADMIN_JWT_SECRET must be set and at least 32 characters");
}

const JWT_SECRET = new TextEncoder().encode(adminJwtSecret);

// /set-password (the invite link landing page) and /api/auth/set-password
// (its token-gated GET/POST) are reachable WITHOUT a session: the invitee is
// by definition not yet authenticated. Authorization is enforced by the
// single-use, expiring token itself, not the session cookie.
const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/build-info",
  "/api/healthz",
  "/set-password",
  "/api/auth/set-password",
]);
const PUBLIC_PREFIX_PATHS: string[] = [];
const PUBLIC_STATIC_PATHS = [
  "/sw.js",
  "/register-sw.js",
  "/manifest.json",
  "/manifest.webmanifest",
  "/offline.html",
  "/robots.txt",
  "/logo.svg",
  "/logo-mark.svg",
  "/favicon.svg",
  "/og-image.svg",
  "/icon-192.png",
  "/icon-512.png",
];

/**
 * Paths that must reach the request handler even when an IP rule would
 * normally deny the caller — otherwise an admin who self-bans (or
 * deletes the only WHITELIST rule covering their network) can never
 * sign back in to fix it. The login form, the login POST, and the
 * health probe are always reachable; every other public surface still
 * goes through the deny check.
 *
 * The bypass is logged via an `IP_RULE_BYPASSED_FOR_BREAK_GLASS`
 * security event so a real attack on the login surface is still
 * visible in audit history.
 */
const BREAK_GLASS_BYPASS_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/healthz",
]);

function isBreakGlassBypassPath(pathname: string): boolean {
  return BREAK_GLASS_BYPASS_PATHS.has(pathname);
}

export function isPublicStaticPath(pathname: string): boolean {
  return PUBLIC_STATIC_PATHS.includes(pathname);
}

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_EXACT_PATHS.has(pathname) ||
    PUBLIC_PREFIX_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

function resolveClientIP(request: NextRequest): string {
  return resolveTrustedClientIpFromHeaders(request.headers, {
    mode: process.env.TRUSTED_PROXY_HEADERS,
    vercelEnv: process.env.VERCEL_ENV,
    fallback: "unknown",
  });
}

async function emitSecurityEvent(
  request: NextRequest,
  event: { type: "BLOCKED_IP_ATTEMPT" | "SESSION_HIJACK_ATTEMPT" | "IP_RULE_BYPASSED_FOR_BREAK_GLASS"; ip: string; pathname: string; adminId?: string }
) {
  const secret = getInternalCallerSecret("internal");
  if (!secret) return;

  try {
    await fetch(new URL("/api/internal/security-event", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(event),
    });
  } catch {
  }
}

function normalizeOrigin(input: string | null | undefined) {
  if (!input) return null;
  try {
    const url = new URL(input);
    const protocol = url.protocol.toLowerCase();
    const hostname = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname.toLowerCase())
      ? "localhost"
      : url.hostname.toLowerCase();
    const port = url.port || (protocol === "https:" ? "443" : "80");
    return `${protocol}//${hostname}:${port}`;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string) {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname.toLowerCase());
}

function isLoopbackOrigin(input: string | null | undefined) {
  if (!input) return false;
  try {
    return isLoopbackHost(new URL(input).hostname);
  } catch {
    return false;
  }
}

function getAllowedOrigins(req: NextRequest) {
  const protocol = (req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(/:$/, "")).split(",")[0].trim();
  const originCandidates = [
    req.nextUrl.origin,
    req.headers.get("x-forwarded-host") ? `${protocol}://${req.headers.get("x-forwarded-host")?.split(",")[0].trim()}` : null,
    req.headers.get("host") ? `${protocol}://${req.headers.get("host")}` : null,
  ];

  return new Set(originCandidates.map((candidate) => normalizeOrigin(candidate)).filter(Boolean));
}

// ── CSP nonce ───────────────────────────────────────────────
// Per-request base64url nonce. Injected into the response CSP header
// and echoed back on `x-nonce` so server components (Next.js App Router
// RSC) can read it via `headers().get("x-nonce")` and stamp their own
// inline <script> / <style> tags with it. This removes the need for
// `'unsafe-inline'` on script-src in production while keeping Radix's
// occasional inline styles working via CSP3's nonce-priority behavior.
const NONCE_BYTES = 16; // 128 bits — well above NIST SP 800-63B minimum

const DEFAULT_R2_ASSET_ORIGIN = "https://assets.locateflow.com";

function generateCspNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  // base64url without padding — matches the encoding Next.js expects
  // when it auto-attaches the nonce to its generated <Script> tags.
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizeCspOrigin(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function getImageCspSources(): string {
  const origins = new Set<string>([DEFAULT_R2_ASSET_ORIGIN]);
  const configuredR2Origin = normalizeCspOrigin(process.env.R2_PUBLIC_BASE_URL);
  if (configuredR2Origin) origins.add(configuredR2Origin);
  return ["'self'", "data:", "blob:", ...origins].join(" ");
}

export function buildCspHeader(nonce: string, isDev: boolean): string {
  // Dev needs `'unsafe-eval'` for HMR + Fast Refresh + React DevTools.
  // Prod drops it entirely — all runtime `eval` usage is a policy violation.
  // `'strict-dynamic'` was removed: under CSP3 it makes the browser ignore
  // `'self'`, so any Next.js framework chunk that arrives without a nonce
  // (e.g. lazy-loaded route bundles or third-party widgets loaded after
  // hydration) is blocked silently and every onClick on the page dies.
  // Same-origin `_next/static/*` bundles are what we actually need to load,
  // so plain `'self' + nonce` is both safer than `'unsafe-inline'` and
  // restores hydration.
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}'`;
  // Admin UI libraries emit small inline style blocks/attributes during
  // hydration. Keep scripts nonce-locked, but allow inline styles
  // explicitly so CSP3 browsers do not ignore the fallback because of a
  // style nonce.
  const styleSrc = `'self' 'unsafe-inline' https://fonts.googleapis.com`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "font-src 'self' https://fonts.gstatic.com",
    `img-src ${getImageCspSources()}`,
    `connect-src 'self' https://errors.locateflow.com${isDev ? " ws: http: https:" : ""}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function isRscRequest(request: {
  headers: Pick<Headers, "get">;
  nextUrl: { searchParams: URLSearchParams };
  url: string;
}): boolean {
  return (
    request.headers.get("rsc") === "1" ||
    request.nextUrl.searchParams.has("_rsc") ||
    request.url.includes("_rsc=")
  );
}

const STRICT_NO_SCRIPT_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join("; ");

function hardenEarlyResponse(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", STRICT_NO_SCRIPT_CSP);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Frame-Options", "DENY");
  return applySecurityHeaders(response);
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

function shouldUseSecureAdminCookie(request: NextRequest): boolean {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return (
    request.nextUrl.protocol === "https:" ||
    forwardedProto === "https" ||
    appEnv === "production" ||
    appEnv === "staging" ||
    appEnv === "preview" ||
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.DIGITALOCEAN_APP_ID)
  );
}

function adminCookieDomainCandidates(): Array<string | undefined> {
  const configured = (process.env.ADMIN_SESSION_COOKIE_DOMAIN || process.env.SESSION_COOKIE_DOMAIN || "").trim();
  const candidates: Array<string | undefined> = [undefined];
  if (configured) candidates.push(configured);
  return Array.from(new Set(candidates));
}

function expireAdminSessionCookie(response: NextResponse, request: NextRequest): NextResponse {
  for (const domain of adminCookieDomainCandidates()) {
    response.cookies.set("admin_session", "", {
      httpOnly: true,
      secure: shouldUseSecureAdminCookie(request),
      sameSite: "strict",
      path: "/",
      ...(domain ? { domain } : {}),
      maxAge: 0,
      expires: new Date(0),
    });
  }
  return response;
}

function nextWithCsp(request: NextRequest): NextResponse {
  if (isRscRequest(request)) {
    // App Router soft navigations carry internal RSC headers
    // (`next-router-state-tree`, prefetch markers, etc.). Do not override
    // the request header bag here; Next uses those headers plus `_rsc` to
    // validate and apply the flight response. The current document already
    // owns the CSP, so a fresh nonce on the RSC fetch is unnecessary.
    return applySecurityHeaders(NextResponse.next());
  }

  const nonce = generateCspNonce();
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildCspHeader(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return applySecurityHeaders(response);
}

// Request body size limit (1MB for regular JSON, 10MB for multipart uploads,
// 50MB for backup imports). Blog images are capped at 5MB in the route
// itself, but multipart overhead can push the request above the file size.
const MAX_JSON_BODY = 1 * 1024 * 1024; // 1MB
const MAX_UPLOAD_BODY = 10 * 1024 * 1024; // 10MB
const MAX_BACKUP_BODY = 50 * 1024 * 1024; // 50MB (backups can be large)

function applyBodySizeLimit(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl?.pathname || "";
  if (!pathname.startsWith("/api/")) return null;
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return null;

  const contentLength = req.headers.get("content-length");
  if (!contentLength) return null;

  const size = parseInt(contentLength, 10);
  if (isNaN(size)) return null;

  const contentType = req.headers.get("content-type") || "";
  const isBackupRoute = pathname.includes("/backup");
  const isUpload = contentType.includes("multipart/form-data");
  const limit = isBackupRoute ? MAX_BACKUP_BODY : isUpload ? MAX_UPLOAD_BODY : MAX_JSON_BODY;

  if (size > limit) {
    return NextResponse.json(
      { error: `Request body too large. Maximum: ${Math.round(limit / 1024 / 1024)}MB` },
      { status: 413 }
    );
  }
  return null;
}

// SEC-008: CSRF protection — require JSON Content-Type on API mutations
function applyCsrfCheck(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl?.pathname || "";
  if (!pathname.startsWith("/api/")) return null;
  if (pathname.startsWith("/api/internal/")) return null;
  if (pathname.startsWith("/api/cron/")) return null;

  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!isMutation) return null;

  const contentType = req.headers.get("content-type") || "";
  const isLogout = pathname === "/api/auth/logout";
  if (!contentType.includes("application/json") && !contentType.includes("multipart/form-data") && !isLogout) {
    return NextResponse.json(
      { error: "Invalid Content-Type. API mutations require application/json or multipart/form-data." },
      { status: 403 }
    );
  }

  const secFetchSite = req.headers.get("sec-fetch-site");
  const requestedWith = req.headers.get("x-requested-with");
  if (isLogout && secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json(
      { error: "Invalid Origin. API mutations must originate from the same site." },
      { status: 403 }
    );
  }
  if (isLogout && requestedWith !== "locateflow" && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (!origin && !referer) {
      return NextResponse.json(
        { error: "Invalid Origin. API mutations must originate from the same site." },
        { status: 403 }
      );
    }
  }
  if (secFetchSite === "same-origin" || secFetchSite === "none") {
    return null;
  }

  const isLocalDev = process.env.NODE_ENV !== "production";
  const allowedOrigins = getAllowedOrigins(req);
  const origin = req.headers.get("origin");
  const requestIsLoopback = isLoopbackHost(req.nextUrl.hostname);
  const allowLoopbackProxyOrigin = requestIsLoopback && isLoopbackOrigin(origin);
  const allowLocalDevLoopbackOrigin = isLocalDev && isLoopbackOrigin(origin);
  if (origin && !allowLoopbackProxyOrigin && !allowLocalDevLoopbackOrigin && !allowedOrigins.has(normalizeOrigin(origin) || "")) {
    return NextResponse.json(
      { error: "Invalid Origin. API mutations must originate from the same site." },
      { status: 403 }
    );
  }

  const referer = req.headers.get("referer");
  if (!origin && referer) {
    try {
      const refererOrigin = normalizeOrigin(new URL(referer).origin);
      const allowLoopbackProxyReferer = requestIsLoopback && isLoopbackOrigin(referer);
      const allowLocalDevLoopbackReferer = isLocalDev && isLoopbackOrigin(referer);
      if (!allowLoopbackProxyReferer && !allowLocalDevLoopbackReferer && (!refererOrigin || !allowedOrigins.has(refererOrigin))) {
        return NextResponse.json(
          { error: "Invalid Referer. API mutations must originate from the same site." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid Referer. API mutations must originate from the same site." },
        { status: 403 }
      );
    }
  }

  return null;
}

const adminRateLimitStore = new Map<string, { count: number; resetAt: number }>();
const adminRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
const adminRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const adminHasRedis = Boolean(
  adminRedisUrl &&
    adminRedisToken &&
    !adminRedisUrl.includes("REPLACE") &&
    !adminRedisToken.includes("REPLACE"),
);
const ADMIN_RATE_LIMIT_REDIS_DEGRADE_MS = 60_000;
let adminRateLimitRedisDegradedUntil = 0;
let adminRateLimitRedisWarned = false;
let adminRateLimitMissingRedisWarned = false;

function isProductionLikeAdminRuntime() {
  const explicit = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  return (
    process.env.NODE_ENV === "production" ||
    explicit === "production" ||
    explicit === "staging" ||
    Boolean(process.env.DIGITALOCEAN_APP_ID)
  );
}

function sanitizeLimiterReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "Unknown limiter error");
  return raw
    .replace(/https?:\/\/\S+/gi, "[URL_REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_\-]{32,}/g, "[TOKEN_REDACTED]")
    .slice(0, 160);
}

function adminRedisTimeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined") return undefined;
  const maybeAbortSignal = AbortSignal as typeof AbortSignal & {
    timeout?: (milliseconds: number) => AbortSignal;
  };
  return maybeAbortSignal.timeout?.(ms);
}

async function adminRedisCall(...args: Array<string | number>): Promise<unknown> {
  if (!adminHasRedis) throw new Error("REDIS_NOT_CONFIGURED");
  const path = args.map((arg) => encodeURIComponent(String(arg))).join("/");
  const res = await fetch(`${adminRedisUrl!.replace(/\/+$/, "")}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminRedisToken!}` },
    cache: "no-store",
    signal: adminRedisTimeoutSignal(1200),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (json.error) throw new Error(`Redis error: ${json.error}`);
  return json.result;
}

function markAdminLimiterRedisDegraded(error: unknown) {
  adminRateLimitRedisDegradedUntil = Date.now() + ADMIN_RATE_LIMIT_REDIS_DEGRADE_MS;
  if (!adminRateLimitRedisWarned) {
    adminRateLimitRedisWarned = true;
    console.error("[ADMIN-RATE-LIMIT] Redis unavailable; failing closed in production-like runtimes:", sanitizeLimiterReason(error));
  }
}

function warnAdminRateLimitMemoryFallbackOnce() {
  if (adminRateLimitMissingRedisWarned || !isProductionLikeAdminRuntime()) return;
  adminRateLimitMissingRedisWarned = true;
  console.error("[ADMIN-RATE-LIMIT] Redis is not configured; using in-memory admin route limits");
}

function getAdminRouteRateLimit(req: NextRequest): { limit: number; windowMs: number; group: string } | null {
  const pathname = req.nextUrl?.pathname || "";
  if (!pathname.startsWith("/api/")) return null;
  if (pathname.startsWith("/api/cron/")) return { limit: 1, windowMs: 60_000, group: "cron" };
  if (pathname.startsWith("/api/internal/")) return { limit: 60, windowMs: 60_000, group: "internal" };
  if (pathname === "/api/auth/login") return { limit: 20, windowMs: 15 * 60_000, group: "admin_login" };
  if (req.method === "GET" || req.method === "HEAD") return { limit: 240, windowMs: 60_000, group: "admin_read" };

  const isStrict =
    pathname.startsWith("/api/backup") ||
    pathname.startsWith("/api/runtime-config") ||
    pathname.startsWith("/api/security/key-rotation") ||
    pathname.startsWith("/api/notifications") ||
    (pathname.startsWith("/api/providers") && req.method === "DELETE") ||
    pathname.includes("/subscription-actions");
  return isStrict
    ? { limit: 20, windowMs: 60_000, group: "admin_sensitive_write" }
    : { limit: 90, windowMs: 60_000, group: "admin_write" };
}

function adminRouteRateLimitResponse(
  policy: { limit: number; windowMs: number; group: string },
  resetAt: number,
  code = "ADMIN_RATE_LIMITED",
): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: "Too many requests. Please try again later.",
      code,
      routeGroup: policy.group,
      retryAfterSeconds: retryAfter,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter), "X-RateLimit-Group": policy.group } },
  );
}

function applyAdminRouteMemoryRateLimit(
  key: string,
  policy: { limit: number; windowMs: number; group: string },
): NextResponse | null {
  warnAdminRateLimitMemoryFallbackOnce();
  const now = Date.now();
  const entry = adminRateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    adminRateLimitStore.set(key, { count: 1, resetAt: now + policy.windowMs });
    return null;
  }
  entry.count += 1;
  if (entry.count <= policy.limit) return null;
  return adminRouteRateLimitResponse(policy, entry.resetAt);
}

async function applyAdminRouteRateLimit(req: NextRequest): Promise<NextResponse | null> {
  const policy = getAdminRouteRateLimit(req);
  if (!policy) return null;

  const routeKey = policy.group === "cron" ? req.nextUrl.pathname : `${req.method}:${req.nextUrl.pathname}`;
  const key = `${policy.group}:${resolveClientIP(req)}:${routeKey}`;
  const productionLike = isProductionLikeAdminRuntime();

  if (adminHasRedis) {
    if (productionLike && Date.now() < adminRateLimitRedisDegradedUntil) {
      return adminRouteRateLimitResponse(policy, adminRateLimitRedisDegradedUntil, "ADMIN_RATE_LIMITER_UNAVAILABLE");
    }
    try {
      const redisKey = `admin-route-rl:${key}`;
      const count = Number(await adminRedisCall("INCR", redisKey));
      if (count === 1) await adminRedisCall("EXPIRE", redisKey, Math.ceil(policy.windowMs / 1000));
      const ttl = Number(await adminRedisCall("TTL", redisKey));
      const resetAt = Date.now() + Math.max(1, Number.isFinite(ttl) ? ttl : Math.ceil(policy.windowMs / 1000)) * 1000;
      if (count <= policy.limit) return null;
      return adminRouteRateLimitResponse(policy, resetAt);
    } catch (error) {
      markAdminLimiterRedisDegraded(error);
      if (productionLike) {
        return adminRouteRateLimitResponse(
          policy,
          adminRateLimitRedisDegradedUntil,
          "ADMIN_RATE_LIMITER_UNAVAILABLE",
        );
      }
    }
  }

  return applyAdminRouteMemoryRateLimit(key, policy);
}

// Locale auto-detect: set NEXT_LOCALE cookie from Accept-Language on first
// visit. Admin's LanguageSelector overwrites this cookie on explicit choice.
const ADMIN_SUPPORTED_LOCALES = ["en", "es"] as const;
const ADMIN_DEFAULT_LOCALE = "en";

function detectAdminLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) return ADMIN_DEFAULT_LOCALE;
  for (const entry of acceptLanguage.split(",")) {
    const code = entry.split(";")[0].trim().toLowerCase().split("-")[0];
    if ((ADMIN_SUPPORTED_LOCALES as readonly string[]).includes(code)) return code;
  }
  return ADMIN_DEFAULT_LOCALE;
}

function seedLocaleCookie(request: NextRequest, response: NextResponse): NextResponse {
  if (request.cookies.get("NEXT_LOCALE")) return response;
  const detected = detectAdminLocale(request.headers.get("accept-language"));
  response.cookies.set("NEXT_LOCALE", detected, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Allow truly public static assets unconditionally (favicon, sw.js, etc).
  if (isPublicStaticPath(pathname)) {
    return NextResponse.next();
  }

  // IP rule enforcement — runs before auth to block banned IPs early.
  // CRITICAL: skip the deny path for the break-glass surface (/login,
  // /api/auth/login, /api/healthz) so a SUPER_ADMIN who self-locks via
  // an IP rule can still get back in and fix it. The bypass is logged
  // as a security event so the attempted block is still auditable.
  const ip = resolveClientIP(request);
  const baseUrl = request.nextUrl.origin;
  const ipCheck = await checkIPAccess(ip, baseUrl);
  if (ipCheck.blocked) {
    if (isBreakGlassBypassPath(pathname)) {
      await emitSecurityEvent(request, {
        type: "IP_RULE_BYPASSED_FOR_BREAK_GLASS",
        ip,
        pathname,
      });
    } else {
      await emitSecurityEvent(request, { type: "BLOCKED_IP_ATTEMPT", ip, pathname });
      if (pathname.startsWith("/api/")) {
        return hardenEarlyResponse(
          NextResponse.json({ error: ipCheck.reason || "Access denied" }, { status: 403 }),
        );
      }
      return hardenEarlyResponse(new NextResponse(ipCheck.reason || "Access denied", { status: 403 }));
    }
  }

  // Body size limit check
  const bodySizeBlocked = applyBodySizeLimit(request);
  if (bodySizeBlocked) return hardenEarlyResponse(bodySizeBlocked);

  const rateLimited = await applyAdminRouteRateLimit(request);
  if (rateLimited) return hardenEarlyResponse(rateLimited);

  // Allow internal and cron endpoints; their route handlers verify shared secrets.
  if (pathname.startsWith("/api/internal/") || pathname.startsWith("/api/cron/")) {
    return nextWithCsp(request);
  }

  // Allow public paths
  if (isPublicPath(pathname)) {
    return seedLocaleCookie(request, nextWithCsp(request));
  }

  // SEC-008: CSRF check on API mutations
  const csrfBlocked = applyCsrfCheck(request);
  if (csrfBlocked) return hardenEarlyResponse(csrfBlocked);

  if (pathname === "/api/auth/logout") {
    return nextWithCsp(request);
  }

  // Check session cookie
  const token = request.cookies.get("admin_session")?.value;
  const isApiRoute = pathname.startsWith("/api/");

  if (!token) {
    // API routes get 401 JSON; page routes redirect to login
    if (isApiRoute) {
      return hardenEarlyResponse(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    return hardenEarlyResponse(NextResponse.redirect(new URL("/login", request.url)));
  }

  try {
    // JWT verification only — no DB calls in Edge Runtime
    // isActive check is enforced by requireAdmin() in every API route
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });

    // ── Forced password rotation gate ─────────────────────────
    // An invited admin signs in with a must-change-password flag (JWT
    // claim `mcp`). Until they set their own password, restrict them to
    // the rotation surface only. After /api/auth/force-password-change
    // succeeds it reissues the JWT with `mcp: false` (see
    // refreshSessionCookie). This runs BEFORE the MFA gate so the very
    // first thing a new admin does is own their password.
    const mustChangePassword = payload.mcp === true;
    if (mustChangePassword) {
      const allowedDuringRotation =
        pathname === "/set-password/change" ||
        pathname === "/api/auth/force-password-change" ||
        pathname === "/api/auth/me" ||
        pathname === "/api/auth/logout";
      if (!allowedDuringRotation) {
        if (isApiRoute) {
          return hardenEarlyResponse(
            NextResponse.json(
              {
                error: "You must set a new password before continuing.",
                passwordChangeRequired: true,
              },
              { status: 403 },
            ),
          );
        }
        return hardenEarlyResponse(
          NextResponse.redirect(new URL("/set-password/change", request.url)),
        );
      }
    }

    // ── MFA setup gate ────────────────────────────────────────
    // Roles that handle the most sensitive operations must have MFA
    // enrolled. If the JWT says MFA is not yet enabled for a
    // SUPER_ADMIN, restrict them to the MFA setup surface only. After
    // setup succeeds the /api/auth/mfa/verify route reissues the JWT
    // with `mfaEnabled: true` (see refreshSessionCookie).
    const role = typeof payload.role === "string" ? payload.role : "";
    const mfaEnabled = payload.mfaEnabled === true;
    const requiresMfaSetup = adminRoleRequiresMfa(role) && !mfaEnabled;
    if (requiresMfaSetup) {
      const allowedDuringSetup =
        pathname === "/settings/two-factor" ||
        pathname.startsWith("/settings/two-factor/") ||
        pathname === "/api/auth/mfa/setup" ||
        pathname === "/api/auth/mfa/verify" ||
        pathname === "/api/auth/me" ||
        pathname === "/api/auth/logout" ||
        pathname === "/api/auth/sessions";
      if (!allowedDuringSetup) {
        if (isApiRoute) {
          return hardenEarlyResponse(
            NextResponse.json(
              {
                error: "MFA enrollment required before this action is allowed.",
                mfaSetupRequired: true,
              },
              { status: 403 },
            ),
          );
        }
        const setupUrl = new URL("/settings/two-factor", request.url);
        setupUrl.searchParams.set("required", "1");
        return hardenEarlyResponse(NextResponse.redirect(setupUrl));
      }
    }

    // Session fingerprint validation — prevent session hijacking
    const fp = payload.fp as string | undefined;
    if (fp) {
      const ua = request.headers.get("user-agent") || "unknown";
      const currentFp = await generateAdminSessionFingerprint({
        ip,
        userAgent: ua,
        acceptLanguage: request.headers.get("accept-language"),
        secChUa: request.headers.get("sec-ch-ua"),
      });
      if (currentFp !== fp) {
        await emitSecurityEvent(request, {
          type: "SESSION_HIJACK_ATTEMPT",
          ip,
          pathname,
          adminId: typeof payload.adminId === "string" ? payload.adminId : undefined,
        });
        // Fingerprint mismatch — possible session hijacking
        if (isApiRoute) {
          const resp = NextResponse.json({ error: "Session invalid. Please log in again." }, { status: 401 });
          expireAdminSessionCookie(resp, request);
          return hardenEarlyResponse(resp);
        }
        const resp = NextResponse.redirect(new URL("/login", request.url));
        expireAdminSessionCookie(resp, request);
        return hardenEarlyResponse(resp);
      }
    }

    return nextWithCsp(request);
  } catch {
    // Token invalid or expired — clear cookie
    if (isApiRoute) {
      const response = NextResponse.json({ error: "Session expired" }, { status: 401 });
      expireAdminSessionCookie(response, request);
      return hardenEarlyResponse(response);
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    expireAdminSessionCookie(response, request);
    return hardenEarlyResponse(response);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
