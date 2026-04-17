import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { checkIPAccess } from "@/lib/ip-rules";

// NOTE: Do NOT import PrismaClient here — middleware runs on Edge Runtime
// where Node.js-only DB drivers (SQLite/libSQL) cannot execute.
// The isActive check is handled by requireAdmin() in each API route instead.

const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
if (!adminJwtSecret || adminJwtSecret.length < 32) {
  throw new Error("ADMIN_JWT_SECRET must be set and at least 32 characters");
}

const JWT_SECRET = new TextEncoder().encode(adminJwtSecret);

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

async function emitSecurityEvent(
  request: NextRequest,
  event: { type: "BLOCKED_IP_ATTEMPT" | "SESSION_HIJACK_ATTEMPT"; ip: string; pathname: string; adminId?: string }
) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return;

  try {
    await fetch(new URL("/api/internal/security-event", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
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

// Request body size limit (5MB for backup imports, 1MB for regular JSON)
const MAX_JSON_BODY = 1 * 1024 * 1024; // 1MB
const MAX_BACKUP_BODY = 50 * 1024 * 1024; // 50MB (backups can be large)

function applyBodySizeLimit(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl?.pathname || "";
  if (!pathname.startsWith("/api/")) return null;
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return null;

  const contentLength = req.headers.get("content-length");
  if (!contentLength) return null;

  const size = parseInt(contentLength, 10);
  if (isNaN(size)) return null;

  const isBackupRoute = pathname.includes("/backup");
  const limit = isBackupRoute ? MAX_BACKUP_BODY : MAX_JSON_BODY;

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
  if (!contentType.includes("application/json") && !contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Invalid Content-Type. API mutations require application/json or multipart/form-data." },
      { status: 403 }
    );
  }

  const secFetchSite = req.headers.get("sec-fetch-site");
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // IP rule enforcement — runs before auth to block banned IPs early
  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const baseUrl = request.nextUrl.origin;
  const ipCheck = await checkIPAccess(ip, baseUrl);
  if (ipCheck.blocked) {
    await emitSecurityEvent(request, { type: "BLOCKED_IP_ATTEMPT", ip, pathname });
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: ipCheck.reason || "Access denied" }, { status: 403 });
    }
    return new NextResponse(ipCheck.reason || "Access denied", { status: 403 });
  }

  // Allow internal endpoints (used by IP rule cache refresh)
  if (pathname.startsWith("/api/internal/")) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Body size limit check
  const bodySizeBlocked = applyBodySizeLimit(request);
  if (bodySizeBlocked) return bodySizeBlocked;

  // SEC-008: CSRF check on API mutations
  const csrfBlocked = applyCsrfCheck(request);
  if (csrfBlocked) return csrfBlocked;

  // Check session cookie
  const token = request.cookies.get("admin_session")?.value;
  const isApiRoute = pathname.startsWith("/api/");

  if (!token) {
    // API routes get 401 JSON; page routes redirect to login
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    // JWT verification only — no DB calls in Edge Runtime
    // isActive check is enforced by requireAdmin() in every API route
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Session fingerprint validation — prevent session hijacking
    const fp = payload.fp as string | undefined;
    if (fp) {
      const ua = request.headers.get("user-agent") || "unknown";
      const raw = `${ip}|${ua}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
      const currentFp = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (currentFp !== fp) {
        await emitSecurityEvent(request, {
          type: "SESSION_HIJACK_ATTEMPT",
          ip,
          pathname,
          adminId: typeof payload.sub === "string" ? payload.sub : undefined,
        });
        // Fingerprint mismatch — possible session hijacking
        if (isApiRoute) {
          const resp = NextResponse.json({ error: "Session invalid. Please log in again." }, { status: 401 });
          resp.cookies.delete("admin_session");
          return resp;
        }
        const resp = NextResponse.redirect(new URL("/login", request.url));
        resp.cookies.delete("admin_session");
        return resp;
      }
    }

    return NextResponse.next();
  } catch {
    // Token invalid or expired — clear cookie
    if (isApiRoute) {
      const response = NextResponse.json({ error: "Session expired" }, { status: 401 });
      response.cookies.delete("admin_session");
      return response;
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("admin_session");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
