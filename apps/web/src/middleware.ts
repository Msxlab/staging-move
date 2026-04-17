import { NextResponse, NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { checkIPAccess } from "@/lib/ip-rules";

// ── Public routes (no auth required) ───────────────────────────
const PUBLIC_PATHS = [
  "/", "/help", "/privacy", "/terms", "/disclaimer", "/cookie-policy",
  "/contact", "/pricing",
  "/sign-in", "/sign-up",
  "/forgot-password", "/reset-password", "/verify-email",
];
const PUBLIC_API_PREFIXES = [
  "/api/internal/",
  "/api/health",
  "/api/help",
  "/api/auth/", // register/login/verify-email/password-reset/oauth
  "/api/webhooks/",
  "/api/tracking",
  "/api/address-autocomplete", // landing-page feature
];
const PUBLIC_API_GET = [
  "/api/providers",
];

function isPublicPath(pathname: string): boolean {
  for (const p of PUBLIC_PATHS) {
    if (pathname === p || pathname.startsWith(p + "/")) return true;
  }
  return false;
}

function isPublicApi(pathname: string, method: string): boolean {
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
      { error: `Request body too large. Maximum: ${Math.round(limit / 1024 / 1024)}MB` },
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
  if (!contentType.includes("application/json") && !contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Invalid Content-Type. API mutations require application/json or multipart/form-data." },
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
      { error: "Invalid Origin. API mutations must originate from the same site." },
      { status: 403 },
    );
  }

  const referer = req.headers.get("referer");
  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== allowedOrigin) {
        return NextResponse.json(
          { error: "Invalid Referer. API mutations must originate from the same site." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid Referer. API mutations must originate from the same site." },
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
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  return null;
}

// ── Session check ──────────────────────────────────────────────
const userJwtSecret = process.env.USER_JWT_SECRET || process.env.ADMIN_JWT_SECRET;
if (!userJwtSecret || userJwtSecret.length < 32) {
  throw new Error("USER_JWT_SECRET (or ADMIN_JWT_SECRET) must be set and at least 32 characters");
}
const JWT_SECRET = new TextEncoder().encode(userJwtSecret);

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("user_session")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, JWT_SECRET);
    // NOTE: DB validation (isActive, expiresAt) runs in API routes via
    // requireDbUserId(); middleware only verifies JWT to keep it edge-safe.
    return true;
  } catch {
    return false;
  }
}

// ── Main middleware ────────────────────────────────────────────
export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl?.pathname || "";

  // IP block / allow-list (runs first).
  if (!pathname.startsWith("/api/internal/") && !pathname.startsWith("/api/health")) {
    const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    const baseUrl = request.nextUrl.origin;
    const ipCheck = await checkIPAccess(ip, baseUrl);
    if (ipCheck.blocked) {
      return NextResponse.json({ error: ipCheck.reason || "Access denied" }, { status: 403 });
    }
  }

  const bodySizeBlocked = applyBodySizeLimit(request);
  if (bodySizeBlocked) return bodySizeBlocked;

  const csrfBlocked = applyCsrfCheck(request);
  if (csrfBlocked) return csrfBlocked;

  const rateLimited = await applyRateLimit(request);
  if (rateLimited) return rateLimited;

  // Skip auth for public endpoints.
  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname, request.method)) return NextResponse.next();
    if (!(await hasValidSession(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Page routes.
  if (isPublicPath(pathname)) return NextResponse.next();
  if (await hasValidSession(request)) return NextResponse.next();

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/api/(.*)",
  ],
};
