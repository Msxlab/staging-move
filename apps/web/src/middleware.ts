import { NextResponse, NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildPolicyRateLimitKey,
  RATE_LIMIT_POLICIES,
  evaluateRateLimitPolicy,
  type RateLimitRouteGroup,
} from "@/lib/rate-limit-policy";
import { checkIPAccess } from "@/lib/ip-rules";
import { tryGetUserJwtSecretKey } from "@/lib/user-jwt-secret";
import { getCanonicalSiteUrl, isNoIndexEnvironment, shouldBlockForRequestHosts } from "@/lib/seo";
import { STATE_SLUGS } from "@/lib/states/data";
import { METRO_SLUG_PAIRS } from "@/lib/states/metros";

// Shadow userId-keyed counter is gated by an env flag so it can be turned
// on once ops is ready to absorb the 2nd Redis round-trip per request.
// Default off so this audit pass is zero-overhead in production until
// explicitly enabled. See docs/audits/security/rate_limit_policy_matrix.md.
const SHADOW_USER_KEYED_ENABLED =
  process.env.RATE_LIMIT_SHADOW_USER_KEYED_ENABLED === "true";

// ── Public routes (no auth required) ───────────────────────────
const PUBLIC_PATHS = [
  "/",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/cookie-policy",
  "/contact",
  "/account/delete",
  "/about",
  "/provider-coverage",
  "/data-deletion",
  "/pricing",
  "/how-it-works",
  "/blog",
  "/faq",
  "/help",
  "/security",
  "/refund",
  "/billing-policy",
  "/dpa",
  "/acceptable-use",
  "/ccpa-privacy-notice",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/invitations", // workspace invite landing (flag-gated API returns 404 when off)
  "/opengraph-image",
];

// Public marketing pages under /moving must stay publicly reachable + indexable
// even though the AUTHENTICATED dashboard also lives under /moving:
//   - /moving/<state>            per-state relocation guide (51 pages)
//   - /moving/<state>/<city>     per-metro relocation guide (curated set)
// The exact /moving list + /moving/plan/<id> detail stay gated + noindex; only
// these exact, curated slugs are allow-listed (an unknown slug never matches,
// so it stays auth-gated and the route itself hard-404s via dynamicParams).
const PUBLIC_MOVING_STATE_PATHS = new Set([
  ...STATE_SLUGS.map((s) => `/moving/${s}`),
  ...METRO_SLUG_PAIRS.map(({ state, city }) => `/moving/${state}/${city}`),
]);
function isPublicStatePage(pathname: string): boolean {
  return PUBLIC_MOVING_STATE_PATHS.has(pathname);
}

const PUBLIC_API_PREFIXES = [
  "/api/internal/",
  "/api/cron/",
  "/api/health",
  "/api/help",
  "/api/auth/oauth/",
  "/api/webhooks/",
  "/api/tracking",
  "/api/address-autocomplete", // landing-page feature
];
const PUBLIC_API_EXACT = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/me",
  "/api/auth/verify-email",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/password/reset/request",
  "/api/auth/password/reset/confirm",
  "/api/mobile/auth/login",
  "/api/mobile/auth/exchange",
  "/api/mobile/auth/apple/native",
  "/api/mobile/iap/products",
  "/api/ready",
  "/api/unsubscribe",
  "/api/waitlist",
  // Impersonation handoff is the only path by which a SUPER_ADMIN-initiated
  // session cookie enters the browser. The route validates a short-lived
  // HMAC-signed token delivered by POST body, not by URL query string.
  "/api/auth/impersonate-handoff",
  "/api/consent/ccpa",
  "/api/blog/revalidate",
  "/api/blog/view",
];
const PUBLIC_API_GET = [
  "/api/acquisition/public-trial-campaign",
  "/api/account/restore", // emailed account-restore link; HMAC token is the auth
  "/api/providers",
  "/api/blog/image",
  "/api/blog/indexnow-key",
  "/api/blog/posts",
  "/api/invitations", // GET invite details for the landing page; POST accept stays auth-gated
];

function matchesPathOrChild(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + "/");
}

function isPublicPath(pathname: string): boolean {
  if (isPublicStatePage(pathname)) return true;
  for (const p of PUBLIC_PATHS) {
    if (matchesPathOrChild(pathname, p)) return true;
  }
  return false;
}

function isPublicApi(pathname: string, method: string): boolean {
  for (const p of PUBLIC_API_EXACT) {
    if (pathname === p) return true;
  }
  for (const p of PUBLIC_API_PREFIXES) {
    if (pathname.startsWith(p)) return true;
  }
  if (method === "GET") {
    for (const p of PUBLIC_API_GET) {
      if (matchesPathOrChild(pathname, p)) return true;
    }
  }
  return false;
}

// ── Body size ──────────────────────────────────────────────────
const MAX_JSON_BODY = 1 * 1024 * 1024; // 1 MB
const MAX_UPLOAD_BODY = 10 * 1024 * 1024; // 10 MB

function applyBodySizeLimit(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl?.pathname || "";
  if (!pathname.startsWith("/api/")) return null;
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return null;

  const contentLength = req.headers.get("content-length");
  if (!contentLength) return null;

  const size = parseInt(contentLength, 10);
  if (isNaN(size)) return null;

  const contentType = req.headers.get("content-type") || "";
  const isUpload = contentType.includes("multipart/form-data");
  const limit = isUpload ? MAX_UPLOAD_BODY : MAX_JSON_BODY;

  if (size > limit) {
    return NextResponse.json(
      {
        error: `Request body too large. Maximum: ${Math.round(limit / 1024 / 1024)}MB`,
      },
      { status: 413 },
    );
  }
  return null;
}

// ── CSRF ───────────────────────────────────────────────────────
function applyCsrfCheck(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl?.pathname || "";
  if (!pathname.startsWith("/api/")) return null;
  if (pathname.startsWith("/api/internal/")) return null;
  if (pathname.startsWith("/api/cron/")) return null;
  if (pathname.startsWith("/api/health")) return null;
  if (pathname.startsWith("/api/webhooks/")) return null;
  if (pathname === "/api/unsubscribe") return null;
  // Apple OAuth callback is a cross-site form_post — exempt it.
  if (pathname === "/api/auth/oauth/apple/callback") return null;
  // Explicit exemption: callbacks are intentionally non-CSRF protected. Today
  // the route is GET so the check would short-circuit anyway, but pinning the
  // exemption prevents a future GET→POST change from silently 403ing.
  if (pathname === "/api/auth/oauth/google/callback") return null;

  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!isMutation) return null;

  const contentType = req.headers.get("content-type") || "";
  const isLogout = pathname === "/api/auth/logout";
  if (
    !contentType.includes("application/json") &&
    !contentType.includes("multipart/form-data") &&
    !isLogout
  ) {
    return NextResponse.json(
      {
        code: "INVALID_CONTENT_TYPE",
        error:
          "Invalid Content-Type. API mutations require application/json or multipart/form-data.",
      },
      { status: 403 },
    );
  }

  const secFetchSite = req.headers.get("sec-fetch-site");
  const requestedWith = req.headers.get("x-requested-with");
  const isMobileBearerLogout =
    isLogout &&
    req.headers.get("x-client-type")?.trim().toLowerCase() === "mobile" &&
    /^Bearer\s+\S+/i.test(req.headers.get("authorization") || "");
  if (isMobileBearerLogout) {
    return null;
  }
  if (isLogout && secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json(
      {
        error:
          "Invalid Origin. API mutations must originate from the same site.",
      },
      { status: 403 },
    );
  }
  if (isLogout && requestedWith !== "locateflow" && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (!origin && !referer) {
      return NextResponse.json(
        {
          error:
            "Invalid Origin. API mutations must originate from the same site.",
        },
        { status: 403 },
      );
    }
  }
  if (secFetchSite === "same-origin" || secFetchSite === "none") {
    return null;
  }

  const allowedOrigin = req.nextUrl.origin;
  const origin = req.headers.get("origin");
  if (origin && origin !== allowedOrigin) {
    return NextResponse.json(
      {
        error:
          "Invalid Origin. API mutations must originate from the same site.",
      },
      { status: 403 },
    );
  }

  const referer = req.headers.get("referer");
  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== allowedOrigin) {
        return NextResponse.json(
          {
            error:
              "Invalid Referer. API mutations must originate from the same site.",
          },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid Referer. API mutations must originate from the same site.",
        },
        { status: 403 },
      );
    }
  }
  return null;
}

// ── Rate limit ─────────────────────────────────────────────────
async function applyRateLimit(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl?.pathname || "";
  if (!pathname.startsWith("/api/")) return null;
  if (pathname.startsWith("/api/webhooks/")) return null;

  // Cron and internal routes have their own auth (CRON_SECRET /
  // INTERNAL_WEBHOOK_SECRET) inside the route handler, but a leaked
  // secret should not let an attacker hammer them. Apply a coarse limit
  // here BEFORE the route handler runs.
  if (pathname.startsWith("/api/cron/")) {
    const cronKey = `rl:cron:${pathname}`;
    const cronResult = await rateLimit(cronKey, { limit: 1, windowSeconds: 60 });
    if (!cronResult.success) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          error: "Too many requests. Please try again later.",
          retryAfterSeconds: Math.ceil((cronResult.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((cronResult.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }
    return null;
  }

  if (pathname.startsWith("/api/internal/")) {
    const internalKey = `rl:internal:${pathname}`;
    const internalResult = await rateLimit(internalKey, { limit: 60, windowSeconds: 60 });
    if (!internalResult.success) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          error: "Too many requests. Please try again later.",
          retryAfterSeconds: Math.ceil((internalResult.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((internalResult.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }
    return null;
  }

  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const isOptionalAuthMe =
    req.method === "GET" &&
    pathname === "/api/auth/me" &&
    ["1", "true"].includes(req.nextUrl.searchParams.get("optional") || "");
  const group: RateLimitRouteGroup = isOptionalAuthMe
    ? "public_read"
    : isWrite
      ? "user_write"
      : "public_read";
  const policy = RATE_LIMIT_POLICIES[group];
  const key = buildPolicyRateLimitKey(
    req,
    group,
    { routeId: isOptionalAuthMe ? "auth-me-optional" : pathname },
  );
  const config = {
    limit: isOptionalAuthMe ? 200 : policy.maxAttempts,
    windowSeconds: policy.windowSeconds,
    failClosed: policy.failClosed,
  };

  const result = await rateLimit(key, config);
  if (!result.success) {
    console.warn("rate_limit_hit", {
      group,
      route: pathname,
      method: req.method,
      keyStrategy: policy.keyStrategy,
    });
    return NextResponse.json(
      {
        code: policy.userFacingErrorCode,
        error: "Too many requests. Please try again later.",
        routeGroup: group,
        retryAfterSeconds: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((result.resetAt - Date.now()) / 1000),
          ),
          "X-RateLimit-Group": group,
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  // Shadow userId-keyed counter — never blocks. Logs RATE_LIMIT_SHADOW_HIT
  // when the per-user counter would have caught what the per-IP enforce
  // limit didn't. Off by default; enable via RATE_LIMIT_SHADOW_USER_KEYED_ENABLED.
  if (SHADOW_USER_KEYED_ENABLED) {
    const userId = await tryReadUserIdFromRequest(req);
    if (userId) {
      const shadowGroup: RateLimitRouteGroup = isWrite ? "user_write" : "user_read";
      // Note: user_write is mode="enforce" today; we still want to capture
      // a userId-keyed signal alongside it. Override by routing this
      // through user_read for reads (shadow) and skipping shadow on writes
      // (user_write enforce already dominates). The decision for write
      // shadow is deferred until reads have a 30-day baseline.
      if (shadowGroup === "user_read") {
        await evaluateRateLimitPolicy(req, "user_read", {
          userId,
          routeId: pathname,
        }).catch(() => null);
      }
    }
  }
  return null;
}

async function tryReadUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const cookieToken = req.cookies.get("user_session")?.value;
    const bearer = (() => {
      const auth = req.headers.get("authorization") || req.headers.get("Authorization");
      if (!auth) return null;
      const m = auth.match(/^Bearer\s+(.+)$/i);
      return m ? m[1].trim() : null;
    })();
    const token = cookieToken || bearer;
    if (!token) return null;
    const secret = tryGetUserJwtSecretKey();
    if (!secret) return null;
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

// ── Session check ──────────────────────────────────────────────
function readBearerToken(request: NextRequest): string | null {
  const auth =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function addSessionTokenCandidate(
  candidates: string[],
  seen: Set<string>,
  token: string | undefined | null,
) {
  const trimmed = token?.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  candidates.push(trimmed);
}

interface MiddlewareAuthDiagnostics {
  cookieCandidatesCount: number;
  jwtCandidateValidCount: number;
  finalFailureCode: string | null;
}

function createMiddlewareAuthDiagnostics(): MiddlewareAuthDiagnostics {
  return {
    cookieCandidatesCount: 0,
    jwtCandidateValidCount: 0,
    finalFailureCode: null,
  };
}

function logMiddlewareAuthDiagnostic(
  request: NextRequest,
  diagnostics: MiddlewareAuthDiagnostics,
) {
  if (
    request.method !== "DELETE" ||
    !request.nextUrl.pathname.startsWith("/api/services/")
  ) {
    return;
  }

  console.warn("service_auth_diagnostic", {
    layer: "middleware",
    route: "/api/services/[id]",
    method: request.method,
    cookieCandidatesCount: diagnostics.cookieCandidatesCount,
    jwtCandidateValidCount: diagnostics.jwtCandidateValidCount,
    dbSessionFound: null,
    sessionExpired: null,
    fingerprintMatched: null,
    jwtUserMatchesSession: null,
    jwtUserFound: null,
    sessionUserFound: null,
    dbUserFound: null,
    canonicalUserFound: null,
    canonicalUserDeleted: null,
    userLookupClient: null,
    emailVerified: null,
    finalFailureCode: diagnostics.finalFailureCode,
  });
}

function readCookieHeaderValues(cookieHeader: string | null, name: string): string[] {
  if (!cookieHeader) return [];
  const values: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.split("=");
    if (!rawName || rawValueParts.length === 0) continue;
    if (rawName.trim() !== name) continue;

    const rawValue = rawValueParts.join("=").trim();
    try {
      values.push(decodeURIComponent(rawValue));
    } catch {
      values.push(rawValue);
    }
  }
  return values;
}

function readSessionTokenCandidates(
  request: NextRequest,
  diagnostics?: MiddlewareAuthDiagnostics,
): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const duplicateCookies =
    typeof request.cookies.getAll === "function"
      ? request.cookies.getAll("user_session")
      : [];
  for (const cookie of duplicateCookies) {
    addSessionTokenCandidate(candidates, seen, cookie.value);
  }
  addSessionTokenCandidate(candidates, seen, request.cookies.get("user_session")?.value);
  for (const value of readCookieHeaderValues(request.headers.get("cookie"), "user_session")) {
    addSessionTokenCandidate(candidates, seen, value);
  }
  if (diagnostics) diagnostics.cookieCandidatesCount = candidates.length;
  addSessionTokenCandidate(candidates, seen, readBearerToken(request));

  return candidates;
}

async function hasValidSession(
  request: NextRequest,
  diagnostics?: MiddlewareAuthDiagnostics,
): Promise<boolean> {
  // Web: httpOnly cookie. Mobile: Authorization: Bearer <token>.
  // Both flows are JWT-signed with the same USER_JWT_SECRET; DB-row validation
  // (isActive, expiresAt, fingerprint) still runs inside route handlers via
  // requireDbUserId() / getUserSession(). Middleware is edge-safe — no DB.
  const tokens = readSessionTokenCandidates(request, diagnostics);
  if (tokens.length === 0) {
    if (diagnostics) diagnostics.finalFailureCode = "NO_SESSION_CANDIDATES";
    return false;
  }
  const jwtSecret = tryGetUserJwtSecretKey();
  if (!jwtSecret) {
    if (diagnostics) diagnostics.finalFailureCode = "JWT_SECRET_MISSING";
    return false;
  }
  for (const token of tokens) {
    try {
      await jwtVerify(token, jwtSecret, { algorithms: ["HS256"] });
      if (diagnostics) {
        diagnostics.jwtCandidateValidCount += 1;
        diagnostics.finalFailureCode = null;
      }
      return true;
    } catch {
      if (diagnostics) diagnostics.finalFailureCode = "JWT_INVALID";
      /* try the next same-name cookie/header token */
    }
  }
  return false;
}

// ── Locale auto-detect ─────────────────────────────────────────
// On first visit (no NEXT_LOCALE cookie) we pick a locale from the
// Accept-Language header and set the cookie on the response. The
// user-facing LanguageSelector and /api/user/locale endpoint both
// overwrite this cookie when a logged-in user makes an explicit choice.
const SUPPORTED_LOCALES = ["en", "es"] as const;
const DEFAULT_LOCALE = "en";

function detectLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  for (const entry of acceptLanguage.split(",")) {
    const code = entry.split(";")[0].trim().toLowerCase().split("-")[0];
    if ((SUPPORTED_LOCALES as readonly string[]).includes(code)) return code;
  }
  return DEFAULT_LOCALE;
}

function applyLocaleCookie(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (request.cookies.get("NEXT_LOCALE")) return response;
  const detected = detectLocale(request.headers.get("accept-language"));
  response.cookies.set("NEXT_LOCALE", detected, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

function pathShouldNoIndex(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    (pathname.startsWith("/moving") && !isPublicStatePage(pathname)) ||
    pathname.startsWith("/services") ||
    pathname.startsWith("/addresses") ||
    pathname.startsWith("/budget") ||
    pathname.startsWith("/providers") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/invitations") || // token-bearing URLs must never be indexed
    pathname.startsWith("/unsubscribe") ||
    pathname.startsWith("/offline")
  );
}

function applyStagingNoIndex(request: NextRequest, response: NextResponse): NextResponse {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || null;
  const host = request.headers.get("host")?.split(",")[0]?.trim() || null;
  const shouldNoIndex =
    isNoIndexEnvironment(getCanonicalSiteUrl()) ||
    shouldBlockForRequestHosts([forwardedHost, host, request.nextUrl.hostname]);

  if (shouldNoIndex || pathShouldNoIndex(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return applySecurityHeaders(request, response);
}

// ── CSP nonce ──────────────────────────────────────────────────
// Per-request 128-bit base64url nonce. Mirrors the admin app pattern
// (apps/admin/src/middleware.ts) so the web app's CSP can drop the
// `'unsafe-inline'` allowance on script-src while keeping Next.js's
// hydration scripts working — Next.js auto-attaches the nonce to its
// generated <Script> tags when it sees `x-nonce` on the request, and
// `'strict-dynamic'` extends trust to scripts loaded by those nonced
// roots.
//
// Server components read the nonce via `headers().get("x-nonce")` and
// stamp it on any inline <script> they emit (see apps/web/src/app/layout.tsx).
const NONCE_BYTES = 16;

function generateCspNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function buildCspHeader(nonce: string, isDev: boolean): string {
  const sentryConnectSrc = "https://errors.locateflow.com";
  const googleScriptSrc = "https://www.googletagmanager.com";
  const googleConnectSrc =
    "https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net";
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic' ${googleScriptSrc}`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' ${googleScriptSrc}`;
  // Next/font, next-themes, and a few UI primitives emit small inline
  // style blocks/attributes during hydration. Keep scripts nonce-locked,
  // but allow inline styles explicitly so modern CSP3 browsers do not
  // ignore the fallback because of a style nonce.
  const styleSrc = `'self' 'unsafe-inline' https://fonts.googleapis.com`;
  const connectSrc = isDev
    ? "'self' ws: http: https: https://api.stripe.com"
    : `'self' https://api.stripe.com ${sentryConnectSrc} ${googleConnectSrc}`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "font-src 'self' https://fonts.gstatic.com",
    // Images are non-executable; broad `https:` is the conventional CSP
    // baseline — covers imgproxy, R2 public CDN, legacy Cloudinary URLs.
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://js.stripe.com",
    "worker-src 'self' blob:",
  ].join("; ");
}

function nextWithCurrentPath(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locateflow-pathname", request.nextUrl.pathname);
  // Generate the per-request nonce here so both the request (server
  // components reading via headers()) and the response (CSP header) see
  // the same value. API routes also pass through this helper but their
  // CSP header is a no-op for JSON responses.
  const nonce = generateCspNonce();
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("x-nonce", nonce);
  const isDev = process.env.NODE_ENV !== "production";
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce, isDev));
  return response;
}

function applySecurityHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const isHttps =
    request.nextUrl.protocol === "https:" ||
    forwardedProto === "https" ||
    appEnv === "production" ||
    appEnv === "staging" ||
    appEnv === "preview" ||
    process.env.NODE_ENV === "production";

  if (isHttps) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  return response;
}

// ── Main middleware ────────────────────────────────────────────
export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl?.pathname || "";

  // IP block / allow-list (runs first).
  if (
    !pathname.startsWith("/api/internal/") &&
    !pathname.startsWith("/api/health")
  ) {
    const ip = (request.headers.get("x-forwarded-for") || "unknown")
      .split(",")[0]
      .trim();
    const baseUrl = request.nextUrl.origin;
    const ipCheck = await checkIPAccess(ip, baseUrl);
    if (ipCheck.blocked) {
      return applyStagingNoIndex(
        request,
        NextResponse.json(
          { error: ipCheck.reason || "Access denied" },
          { status: 403 },
        ),
      );
    }
  }

  const bodySizeBlocked = applyBodySizeLimit(request);
  if (bodySizeBlocked) return applyStagingNoIndex(request, bodySizeBlocked);

  const csrfBlocked = applyCsrfCheck(request);
  if (csrfBlocked) return applyStagingNoIndex(request, csrfBlocked);

  const rateLimited = await applyRateLimit(request);
  if (rateLimited) return applyStagingNoIndex(request, rateLimited);

  // Skip auth for public endpoints.
  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname, request.method)) return applyStagingNoIndex(request, nextWithCurrentPath(request));
    const authDiagnostics = createMiddlewareAuthDiagnostics();
    if (!(await hasValidSession(request, authDiagnostics))) {
      logMiddlewareAuthDiagnostic(request, authDiagnostics);
      const response = NextResponse.json(
        { code: "UNAUTHORIZED", error: "Please sign in again." },
        { status: 401 },
      );
      response.headers.set("X-LocateFlow-Auth-Layer", "middleware");
      response.headers.set(
        "X-LocateFlow-Auth-Failure",
        authDiagnostics.finalFailureCode ?? "NO_SESSION_CANDIDATES",
      );
      return applyStagingNoIndex(
        request,
        response,
      );
    }
    return applyStagingNoIndex(request, nextWithCurrentPath(request));
  }

  // Page routes.
  if (isPublicPath(pathname)) {
    return applyStagingNoIndex(request, applyLocaleCookie(request, nextWithCurrentPath(request)));
  }
  if (await hasValidSession(request)) {
    return applyStagingNoIndex(request, applyLocaleCookie(request, nextWithCurrentPath(request)));
  }

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect", pathname);
  return applyStagingNoIndex(request, applyLocaleCookie(request, NextResponse.redirect(signInUrl)));
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
};
