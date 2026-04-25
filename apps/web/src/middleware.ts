import { NextResponse, NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { checkIPAccess } from "@/lib/ip-rules";

// ── Public routes (no auth required) ───────────────────────────
const PUBLIC_PATHS = [
  "/",
  "/help",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/cookie-policy",
  "/contact",
  "/pricing",
  "/how-it-works",
  "/faq",
  "/security",
  "/refund",
  "/dpa",
  "/acceptable-use",
  "/ccpa-privacy-notice",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];
const PUBLIC_API_PREFIXES = [
  "/api/internal/",
  "/api/health",
  "/api/help",
  "/api/auth/oauth/",
  "/api/webhooks/",
  "/api/tracking",
  "/api/address-autocomplete", // landing-page feature
];
const PUBLIC_API_EXACT = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/auth/verify-email",
  "/api/auth/password/reset/request",
  "/api/auth/password/reset/confirm",
  // Impersonation handoff is the only path by which a SUPER_ADMIN-initiated
  // session cookie enters the browser. The token in the query string is
  // HMAC-signed + DB-validated inside the route itself, so auth here.
  "/api/auth/impersonate-handoff",
];
const PUBLIC_API_GET = ["/api/providers"];

function isPublicPath(pathname: string): boolean {
  for (const p of PUBLIC_PATHS) {
    if (pathname === p || pathname.startsWith(p + "/")) return true;
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
      if (pathname.startsWith(p)) return true;
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
  if (pathname.startsWith("/api/health")) return null;
  if (pathname.startsWith("/api/webhooks/")) return null;
  // Apple OAuth callback is a cross-site form_post — exempt it.
  if (pathname === "/api/auth/oauth/apple/callback") return null;

  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!isMutation) return null;

  const contentType = req.headers.get("content-type") || "";
  if (
    !contentType.includes("application/json") &&
    !contentType.includes("multipart/form-data")
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid Content-Type. API mutations require application/json or multipart/form-data.",
      },
      { status: 403 },
    );
  }

  const secFetchSite = req.headers.get("sec-fetch-site");
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
  if (pathname.startsWith("/api/internal/")) return null;

  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const key = getRateLimitKey(req, isWrite ? "write" : "read");
  const config = isWrite
    ? { limit: 30, windowSeconds: 60 }
    : { limit: 120, windowSeconds: 60 };

  const result = await rateLimit(key, config);
  if (!result.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((result.resetAt - Date.now()) / 1000),
          ),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  return null;
}

// ── Session check ──────────────────────────────────────────────
const userJwtSecret = process.env.USER_JWT_SECRET;
if (!userJwtSecret || userJwtSecret.length < 32) {
  throw new Error("USER_JWT_SECRET must be set and at least 32 characters");
}
const JWT_SECRET = new TextEncoder().encode(userJwtSecret);

function readBearerToken(request: NextRequest): string | null {
  const auth =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  // Web: httpOnly cookie. Mobile: Authorization: Bearer <token>.
  // Both flows are JWT-signed with the same USER_JWT_SECRET; DB-row validation
  // (isActive, expiresAt, fingerprint) still runs inside route handlers via
  // requireDbUserId() / getUserSession(). Middleware is edge-safe — no DB.
  const token =
    request.cookies.get("user_session")?.value || readBearerToken(request);
  if (!token) return false;
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
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

function hostLooksLikeStaging(host: string | null): boolean {
  if (!host) return false;
  const normalized = host.toLowerCase();
  return (
    normalized.includes("staging") ||
    normalized.endsWith(".ondigitalocean.app") ||
    normalized.endsWith(".vercel.app")
  );
}

function applyStagingNoIndex(request: NextRequest, response: NextResponse): NextResponse {
  const appEnv = (process.env.APP_ENV || "").toLowerCase();
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || null;
  const host = request.headers.get("host")?.split(",")[0]?.trim() || null;
  const shouldNoIndex =
    appEnv === "staging" ||
    appEnv === "preview" ||
    /(?:staging|preview|ondigitalocean\.app|vercel\.app)/i.test(configuredUrl) ||
    hostLooksLikeStaging(forwardedHost) ||
    hostLooksLikeStaging(host) ||
    hostLooksLikeStaging(request.nextUrl.hostname);

  if (shouldNoIndex) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
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
    if (isPublicApi(pathname, request.method)) return applyStagingNoIndex(request, NextResponse.next());
    if (!(await hasValidSession(request))) {
      return applyStagingNoIndex(
        request,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }
    return applyStagingNoIndex(request, NextResponse.next());
  }

  // Page routes.
  if (isPublicPath(pathname)) {
    if ((pathname === "/sign-in" || pathname === "/sign-up") && (await hasValidSession(request))) {
      return applyStagingNoIndex(
        request,
        applyLocaleCookie(request, NextResponse.redirect(new URL("/dashboard", request.url))),
      );
    }
    return applyStagingNoIndex(request, applyLocaleCookie(request, NextResponse.next()));
  }
  if (await hasValidSession(request)) {
    return applyStagingNoIndex(request, applyLocaleCookie(request, NextResponse.next()));
  }

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect", pathname);
  return applyStagingNoIndex(request, applyLocaleCookie(request, NextResponse.redirect(signInUrl)));
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
};
