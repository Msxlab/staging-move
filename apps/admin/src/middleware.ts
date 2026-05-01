import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { checkIPAccess } from "@/lib/ip-rules";
import { getInternalCallerSecret } from "@/lib/internal-secrets";
import { generateAdminSessionFingerprint } from "@/lib/session-fingerprint";

// NOTE: Do NOT import PrismaClient here — middleware runs on Edge Runtime
// where Node.js-only DB drivers (SQLite/libSQL) cannot execute.
// The isActive check is handled by requireAdmin() in each API route instead.

const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
if (!adminJwtSecret || adminJwtSecret.length < 32) {
  throw new Error("ADMIN_JWT_SECRET must be set and at least 32 characters");
}

const JWT_SECRET = new TextEncoder().encode(adminJwtSecret);

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
const PUBLIC_STATIC_PATHS = ["/sw.js"];

export function isPublicStaticPath(pathname: string): boolean {
  return PUBLIC_STATIC_PATHS.includes(pathname);
}

function resolveClientIP(request: NextRequest): string {
  if (process.env.VERCEL_ENV) {
    const vercelIp = request.headers.get("x-vercel-forwarded-for");
    if (vercelIp) return vercelIp.split(",")[0].trim();
  }

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "unknown";
}

async function emitSecurityEvent(
  request: NextRequest,
  event: { type: "BLOCKED_IP_ATTEMPT" | "SESSION_HIJACK_ATTEMPT"; ip: string; pathname: string; adminId?: string }
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
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
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
  return response;
}

function nextWithCsp(request: NextRequest): NextResponse {
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

  // IP rule enforcement — runs before auth to block banned IPs early
  const ip = resolveClientIP(request);
  const baseUrl = request.nextUrl.origin;
  const ipCheck = await checkIPAccess(ip, baseUrl);
  if (ipCheck.blocked) {
    await emitSecurityEvent(request, { type: "BLOCKED_IP_ATTEMPT", ip, pathname });
    if (pathname.startsWith("/api/")) {
      return hardenEarlyResponse(
        NextResponse.json({ error: ipCheck.reason || "Access denied" }, { status: 403 }),
      );
    }
    return hardenEarlyResponse(new NextResponse(ipCheck.reason || "Access denied", { status: 403 }));
  }

  if (isPublicStaticPath(pathname)) {
    return NextResponse.next();
  }

  // Allow internal endpoints (used by IP rule cache refresh)
  if (pathname.startsWith("/api/internal/")) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return seedLocaleCookie(request, nextWithCsp(request));
  }

  // Body size limit check
  const bodySizeBlocked = applyBodySizeLimit(request);
  if (bodySizeBlocked) return hardenEarlyResponse(bodySizeBlocked);

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

    // ── MFA setup gate ────────────────────────────────────────
    // Roles that handle the most sensitive operations must have MFA
    // enrolled. If the JWT says MFA is not yet enabled for a
    // SUPER_ADMIN, restrict them to the MFA setup surface only. After
    // setup succeeds the /api/auth/mfa/verify route reissues the JWT
    // with `mfaEnabled: true` (see refreshSessionCookie).
    const role = typeof payload.role === "string" ? payload.role : "";
    const mfaEnabled = payload.mfaEnabled === true;
    const requiresMfaSetup = role === "SUPER_ADMIN" && !mfaEnabled;
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
          resp.cookies.delete("admin_session");
          return hardenEarlyResponse(resp);
        }
        const resp = NextResponse.redirect(new URL("/login", request.url));
        resp.cookies.delete("admin_session");
        return hardenEarlyResponse(resp);
      }
    }

    return nextWithCsp(request);
  } catch {
    // Token invalid or expired — clear cookie
    if (isApiRoute) {
      const response = NextResponse.json({ error: "Session expired" }, { status: 401 });
      response.cookies.delete("admin_session");
      return hardenEarlyResponse(response);
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("admin_session");
    return hardenEarlyResponse(response);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
