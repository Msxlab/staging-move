import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
  tryGetUserJwtSecretKey: vi.fn(() => null),
  rateLimitMock: vi.fn(() =>
    Promise.resolve({ success: true, resetAt: Date.now() + 60_000, remaining: 100 }),
  ),
}));

vi.mock("@/lib/ip-rules", () => ({
  checkIPAccess: vi.fn(() => Promise.resolve({ blocked: false })),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: mocks.rateLimitMock,
  getLimiterHealth: vi.fn(() => ({
    distributedLimiterConfigured: false,
    limiterMode: "memory",
    provider: "memory",
    environment: "production",
    productionEnvOk: false,
    lastDegradedAt: null,
    lastRecoveredAt: null,
    lastErrorReasonCode: null,
  })),
}));

vi.mock("@/lib/user-jwt-secret", () => ({
  tryGetUserJwtSecretKey: mocks.tryGetUserJwtSecretKey,
}));

vi.mock("jose", () => ({
  jwtVerify: mocks.jwtVerify,
}));

import middleware from "./middleware";
import { checkIPAccess } from "@/lib/ip-rules";

const checkIPAccessMock = checkIPAccess as unknown as ReturnType<typeof vi.fn>;

function request(url: string, init?: any) {
  return new NextRequest(url, init);
}

describe("web middleware auth boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://locateflow.com");
    vi.stubEnv("SITE_URL", "https://locateflow.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://locateflow.com");
    mocks.tryGetUserJwtSecretKey.mockReturnValue(null);
    mocks.jwtVerify.mockRejectedValue(new Error("invalid token"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects protected pages to sign-in when no session cookie remains", async () => {
    const response = await middleware(request("https://locateflow.com/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://locateflow.com/sign-in?redirect=%2Fdashboard");
  });

  it("lets logout reach the route without a session so it stays idempotent", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "locateflow" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets mobile bearer logout reach the route without browser-origin headers", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/auth/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-client-type": "mobile",
          authorization: "Bearer opaque-mobile-session-token",
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps logout origin-gated when mobile client type is sent without a bearer token", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/auth/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-client-type": "mobile",
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(403);
  });

  it("lets mobile OAuth exchange reach the route before a bearer token exists", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/mobile/auth/exchange", {
        method: "POST",
        headers: { "content-type": "application/json", "x-client-type": "mobile" },
        body: JSON.stringify({ code: "opaque-mobile-oauth-code" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets native mobile Apple sign-in reach its verifier before a bearer token exists", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/mobile/auth/apple/native", {
        method: "POST",
        headers: { "content-type": "application/json", "x-client-type": "mobile" },
        body: JSON.stringify({ identityToken: "opaque-apple-identity-token" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets sign-in render even when a stale session cookie is present", async () => {
    const response = await middleware(
      request("https://locateflow.com/sign-in", {
        headers: { cookie: "user_session=stale.jwt.value" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets public blog pages render without a session", async () => {
    const indexResponse = await middleware(request("https://locateflow.com/blog"));
    const postResponse = await middleware(request("https://locateflow.com/blog/moving-checklist"));

    expect(indexResponse.status).toBe(200);
    expect(indexResponse.headers.get("x-middleware-next")).toBe("1");
    expect(postResponse.status).toBe(200);
    expect(postResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets SEO explanation pages and generated Open Graph image render without a session", async () => {
    const publicPaths = [
      "/about",
      "/provider-coverage",
      "/account/delete",
      "/data-deletion",
      "/opengraph-image",
    ];

    for (const path of publicPaths) {
      const response = await middleware(request(`https://locateflow.com${path}`));

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-robots-tag")).toBeNull();
    }
  });

  it("lets public mover application and passwordless portal pages render without a user session", async () => {
    const publicPaths = [
      "/movers/apply",
      "/movers/portal",
      "/movers/portal/enter",
      "/movers/portal/dashboard",
      "/movers/portal/placements",
    ];

    for (const path of publicPaths) {
      const response = await middleware(request(`https://locateflow.com${path}`));

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("does not noindex a production request just because the origin host is staging-named", async () => {
    const response = await middleware(
      request("https://locateflow-staging-owew7.ondigitalocean.app/about", {
        headers: { "x-forwarded-host": "locateflow.com" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("keeps direct staging host requests noindexed", async () => {
    const response = await middleware(
      request("https://locateflow-staging-owew7.ondigitalocean.app/about"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
  });

  it("lets public blog API routes reach route-level handling without a session", async () => {
    const campaignResponse = await middleware(request("https://locateflow.com/api/acquisition/public-trial-campaign"));
    const listResponse = await middleware(request("https://locateflow.com/api/blog/posts"));
    const postResponse = await middleware(request("https://locateflow.com/api/blog/posts/moving-checklist"));
    const imageResponse = await middleware(request("https://locateflow.com/api/blog/image?key=blog/test.jpg"));
    const indexNowResponse = await middleware(request("https://locateflow.com/api/blog/indexnow-key/test-key"));
    const viewResponse = await middleware(
      request("https://locateflow.com/api/blog/view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "moving-checklist", locale: "en" }),
      }),
    );
    const revalidateResponse = await middleware(
      request("https://locateflow.com/api/blog/revalidate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "moving-checklist", locale: "en" }),
      }),
    );

    expect(campaignResponse.status).toBe(200);
    expect(campaignResponse.headers.get("x-middleware-next")).toBe("1");
    expect(campaignResponse.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(listResponse.status).toBe(200);
    expect(listResponse.headers.get("x-middleware-next")).toBe("1");
    expect(postResponse.status).toBe(200);
    expect(postResponse.headers.get("x-middleware-next")).toBe("1");
    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers.get("x-middleware-next")).toBe("1");
    expect(indexNowResponse.status).toBe(200);
    expect(indexNowResponse.headers.get("x-middleware-next")).toBe("1");
    expect(viewResponse.status).toBe(200);
    expect(viewResponse.headers.get("x-middleware-next")).toBe("1");
    expect(revalidateResponse.status).toBe(200);
    expect(revalidateResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not make unrelated /api/blog paths public by prefix accident", async () => {
    const response = await middleware(request("https://locateflow.com/api/blog/posts-admin"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("lets mover application and portal APIs reach their own gates without a user session", async () => {
    const applyResponse = await middleware(
      request("https://locateflow.com/api/movers/apply", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=test",
          "content-length": String(12 * 1024 * 1024),
        },
      }),
    );
    const portalRequestResponse = await middleware(
      request("https://locateflow.com/api/movers/portal/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "mover@example.com" }),
      }),
    );
    const placementResponse = await middleware(
      request("https://locateflow.com/api/movers/portal/placements/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stateScope: "CA", durationDays: 30 }),
      }),
    );

    expect(applyResponse.status).toBe(200);
    expect(applyResponse.headers.get("x-middleware-next")).toBe("1");
    expect(portalRequestResponse.status).toBe(200);
    expect(portalRequestResponse.headers.get("x-middleware-next")).toBe("1");
    expect(placementResponse.status).toBe(200);
    expect(placementResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps the general multipart cap while allowing the larger mover application intake", async () => {
    const oversizedGeneric = await middleware(
      request("https://locateflow.com/api/services", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=test",
          "content-length": String(12 * 1024 * 1024),
        },
      }),
    );
    const moverApply = await middleware(
      request("https://locateflow.com/api/movers/apply", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=test",
          "content-length": String(12 * 1024 * 1024),
        },
      }),
    );

    expect(oversizedGeneric.status).toBe(413);
    expect(moverApply.status).toBe(200);
    expect(moverApply.headers.get("x-middleware-next")).toBe("1");
  });

  it("adds noindex headers to public auth pages", async () => {
    const response = await middleware(request("https://locateflow.com/sign-up"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
  });

  it("adds noindex headers to API responses", async () => {
    const response = await middleware(request("https://locateflow.com/api/auth/me"));

    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
  });

  it("lets anonymous users update the locale cookie through the public locale API", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/user/locale", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-requested-with": "locateflow",
          origin: "https://locateflow.com",
        },
        body: JSON.stringify({ locale: "es" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets the public help center render without a session or noindex header", async () => {
    const response = await middleware(request("https://locateflow.com/help"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("adds baseline security headers to middleware responses", async () => {
    const response = await middleware(request("https://locateflow.com/help"));

    expect(response.headers.get("strict-transport-security")).toContain("max-age=63072000");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=(self)");
  });

  it("rejects cross-site logout attempts before they reach the route", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/auth/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
          origin: "https://attacker.example",
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(403);
  });

  it("returns a machine-readable code for API mutation requests without a JSON content type", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/services/service-1", {
        method: "DELETE",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("INVALID_CONTENT_TYPE");
  });

  it("returns a machine-readable code for API requests without a valid session", async () => {
    const response = await middleware(request("https://locateflow.com/api/services"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      code: "UNAUTHORIZED",
      error: "Please sign in again.",
    });
    expect(response.headers.get("X-LocateFlow-Auth-Layer")).toBe("middleware");
    expect(response.headers.get("X-LocateFlow-Auth-Failure")).toBe("NO_SESSION_CANDIDATES");
  });

  it("reports JWT_INVALID on the middleware diagnostic header when the cookie is malformed", async () => {
    mocks.tryGetUserJwtSecretKey.mockReturnValue(
      new TextEncoder().encode("test-user-jwt-secret-32-characters") as any,
    );
    mocks.jwtVerify.mockRejectedValue(new Error("invalid signature"));

    const response = await middleware(
      request("https://locateflow.com/api/services/service-1", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          cookie: "user_session=stale.jwt.value",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("X-LocateFlow-Auth-Layer")).toBe("middleware");
    expect(response.headers.get("X-LocateFlow-Auth-Failure")).toBe("JWT_INVALID");
  });

  it("exempts webhook routes from the global IP rate limiter", async () => {
    mocks.rateLimitMock.mockClear();
    const response = await middleware(
      request("https://locateflow.com/api/webhooks/stripe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(mocks.rateLimitMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("does NOT touch the shared cron counter for credential-less cron requests (anti-DoS)", async () => {
    // An unauthenticated attacker GETting a cron path must not be able to burn
    // the coarse pre-limit counter and starve the real scheduler into a 429.
    // Credential-less requests skip the pre-limit entirely and fall through to
    // the route, where guardCronRequest returns 401.
    mocks.rateLimitMock.mockClear();
    const response = await middleware(
      request("https://locateflow.com/api/cron/expire-trials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(mocks.rateLimitMock).not.toHaveBeenCalledWith(
      expect.stringContaining("rl:cron:"),
      expect.anything(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("applies the coarse cron pre-limit keyed by credential for credential-bearing requests", async () => {
    mocks.rateLimitMock.mockClear();
    const response = await middleware(
      request("https://locateflow.com/api/cron/expire-trials", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer cron-secret" },
        body: "{}",
      }),
    );
    expect(mocks.rateLimitMock).toHaveBeenCalledWith(
      expect.stringContaining("rl:cron:"),
      expect.objectContaining({ limit: 1, windowSeconds: 60 }),
    );
    // The key must be scoped to the presented credential, not a single global
    // bucket, so a bogus secret can't starve the legitimate scheduler.
    expect(mocks.rateLimitMock).toHaveBeenCalledWith(
      expect.stringContaining(":cred:"),
      expect.anything(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("uses the trusted platform IP header (not the attacker-controlled XFF first hop) for IP blocking", async () => {
    checkIPAccessMock.mockClear();
    await middleware(
      request("https://locateflow.com/dashboard", {
        headers: {
          // Attacker spoofs the left-most XFF hop; the LB-set real-client-IP
          // header is the value we must trust.
          "x-forwarded-for": "1.2.3.4, 9.9.9.9",
          "x-real-ip": "203.0.113.77",
        },
      }),
    );
    expect(checkIPAccessMock).toHaveBeenCalledWith("203.0.113.77", expect.any(String));
    expect(checkIPAccessMock).not.toHaveBeenCalledWith("1.2.3.4", expect.any(String));
  });

  it("lets a valid scheduler cron request reach the route handler", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/cron/bill-reminders", {
        method: "GET",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps the legacy partner-consent refresh path sealed outside the cron namespace", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/partner-consents/consent-1/refresh", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer cron-secret" },
        body: "{}",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-middleware-next")).not.toBe("1");
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("lets anonymous unsubscribe GET and RFC8058 form POST reach token validation", async () => {
    const getResponse = await middleware(
      request("https://locateflow.com/api/unsubscribe?t=token.kind"),
    );
    const postResponse = await middleware(
      request("https://locateflow.com/api/unsubscribe?t=token.kind", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
    );

    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("x-middleware-next")).toBe("1");
    expect(postResponse.status).toBe(200);
    expect(postResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps intended public route contracts aligned without a session", async () => {
    const products = await middleware(request("https://locateflow.com/api/mobile/iap/products"));
    const ready = await middleware(request("https://locateflow.com/api/ready"));
    const waitlist = await middleware(
      request("https://locateflow.com/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", target: "MOBILE_ANY" }),
      }),
    );

    expect(products.status).toBe(200);
    expect(products.headers.get("x-middleware-next")).toBe("1");
    expect(ready.status).toBe(200);
    expect(ready.headers.get("x-middleware-next")).toBe("1");
    expect(waitlist.status).toBe(200);
    expect(waitlist.headers.get("x-middleware-next")).toBe("1");
  });

  it("rate limits internal routes while keeping them publicly routable to secret checks", async () => {
    mocks.rateLimitMock.mockClear();
    const response = await middleware(
      request("https://locateflow.com/api/internal/refresh-cache", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(mocks.rateLimitMock).toHaveBeenCalledWith(
      expect.stringContaining("rl:internal:"),
      expect.objectContaining({ limit: 60, windowSeconds: 60 }),
    );
    expect(response.status).toBe(200);
  });

  it("tries later duplicate session cookie values before rejecting protected API requests", async () => {
    mocks.tryGetUserJwtSecretKey.mockReturnValue(new TextEncoder().encode("test-user-jwt-secret-32-characters") as any);
    mocks.jwtVerify.mockImplementation(async (token: string) => {
      if (token === "valid-token") return { payload: { userId: "user-1" } };
      throw new Error("stale token");
    });

    const response = await middleware(
      request("https://locateflow.com/api/services/service-1", {
        headers: {
          cookie: "user_session=stale-token; user_session=valid-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.jwtVerify).toHaveBeenCalledWith(
      "valid-token",
      expect.any(Uint8Array) as any,
      { algorithms: ["HS256"] },
    );
  });
});
