import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildPolicyRateLimitKey,
  evaluateRateLimitPolicy,
  normalizeEmailForRateLimit,
  rateLimitResponseInit,
  RATE_LIMIT_POLICIES,
} from "./rate-limit-policy";

function request(headers: Record<string, string> = {}) {
  return new Request("https://locateflow.com/api/auth/login", {
    headers: {
      "user-agent": "Vitest Browser",
      "x-forwarded-for": "203.0.113.10",
      ...headers,
    },
  });
}

describe("rate-limit policy", () => {
  it("keeps endpoint groups risk-based instead of one global limit", () => {
    expect(RATE_LIMIT_POLICIES.auth_login.maxAttempts).toBeLessThan(
      RATE_LIMIT_POLICIES.public_read.maxAttempts,
    );
    expect(RATE_LIMIT_POLICIES.provider_recommendations.maxAttempts).toBeGreaterThan(
      RATE_LIMIT_POLICIES.account_delete.maxAttempts,
    );
    expect(RATE_LIMIT_POLICIES.export_data.preferStepUp).toBe(true);
    expect(RATE_LIMIT_POLICIES.account_delete.preferStepUp).toBe(true);
  });

  it("normalizes email identities before building auth keys", () => {
    expect(normalizeEmailForRateLimit("  Alice@Example.COM ")).toBe("alice@example.com");
    const first = buildPolicyRateLimitKey(request(), "auth_login", {
      email: "Alice@Example.COM",
      routeId: "password",
    });
    const second = buildPolicyRateLimitKey(request(), "auth_login", {
      email: " alice@example.com ",
      routeId: "password",
    });

    expect(first).toBe(second);
    expect(first).not.toContain("alice@example.com");
    expect(first).not.toContain("203.0.113.10");
  });

  it("includes user identity for app usage to avoid IP-only false positives", () => {
    const key = buildPolicyRateLimitKey(request(), "provider_recommendations", {
      userId: "user-1",
      routeId: "providers_recommendations",
    });

    expect(key).toContain("rl:provider_recommendations:user:");
    expect(key).not.toContain("203.0.113.10");
  });

  it("keys mobile OAuth exchange by client network and user-agent without raw tokens", () => {
    const key = buildPolicyRateLimitKey(
      request({ "x-client-type": "mobile", "user-agent": "LocateFlowMobile/1.0" }),
      "mobile_oauth_exchange",
      { routeId: "mobile_oauth_exchange", extra: "oauth-code-secret" },
    );

    expect(key).toContain("rl:mobile_oauth_exchange:client:mobile");
    expect(key).not.toContain("oauth-code-secret");
    expect(key).not.toContain("LocateFlowMobile");
  });
});

// ── Mode behavior + standard 429 shape ────────────────────────────
// The audit pass added shadow / warn / enforce modes alongside the existing
// enforce-only `enforceRateLimitPolicy` helper. These tests verify a few
// non-obvious behaviors that protect normal users from false positives:
//
//   - shadow mode never blocks even when over the limit (used for the new
//     userId-keyed dashboard counter that rides alongside the existing
//     IP-keyed enforce limit until 30-day FP data is collected)
//   - warn mode never blocks but does emit RATE_LIMIT_HIT (admin
//     sensitive actions during an incident — log without locking out the
//     responder)
//   - enforce mode blocks normally
//   - 429 responses surface code + routeGroup + retryAfterSeconds and
//     omit threshold headers on auth groups (no enumeration of cadence)
vi.mock("./rate-limit", async () => {
  const actual = await vi.importActual<typeof import("./rate-limit")>("./rate-limit");
  return { ...actual, rateLimit: vi.fn() };
});
vi.mock("./security-events", async () => {
  const actual = await vi.importActual<typeof import("./security-events")>("./security-events");
  return { ...actual, emitSecurityEvent: vi.fn() };
});

import * as rateLimitMod from "./rate-limit";
import * as securityEventsMod from "./security-events";

const mockedRateLimit = vi.mocked(rateLimitMod.rateLimit);
const mockedEmitEvent = vi.mocked(securityEventsMod.emitSecurityEvent);

describe("evaluateRateLimitPolicy mode behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shadow: never blocks; emits RATE_LIMIT_SHADOW_HIT", async () => {
    mockedRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const decision = await evaluateRateLimitPolicy(request(), "user_read", {
      userId: "u1",
      routeId: "/api/dashboard",
    });
    expect(decision.allowed).toBe(true);
    expect(decision.blocked).toBe(false);
    expect(decision.wouldHaveBlocked).toBe(true);
    expect(decision.mode).toBe("shadow");
    expect(mockedEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "RATE_LIMIT_SHADOW_HIT", severity: "info" }),
    );
  });

  it("warn: never blocks; emits RATE_LIMIT_HIT for admin_sensitive_action", async () => {
    mockedRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const decision = await evaluateRateLimitPolicy(request(), "admin_sensitive_action", {
      userId: "admin1",
      routeId: "/api/users/x",
    });
    expect(decision.allowed).toBe(true);
    expect(decision.wouldHaveBlocked).toBe(true);
    expect(decision.mode).toBe("warn");
    expect(mockedEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "RATE_LIMIT_HIT", severity: "warn" }),
    );
  });

  it("enforce: blocks when over the limit", async () => {
    mockedRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const decision = await evaluateRateLimitPolicy(request(), "auth_login", {
      email: "u@example.com",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.blocked).toBe(true);
    expect(decision.mode).toBe("enforce");
  });

  it("allows when under the limit, regardless of mode (no false positives for normal users)", async () => {
    mockedRateLimit.mockResolvedValue({
      success: true,
      remaining: 119,
      resetAt: Date.now() + 60_000,
    });
    for (const group of ["user_read", "admin_sensitive_action", "auth_login"] as const) {
      const decision = await evaluateRateLimitPolicy(request(), group, {
        userId: "u1",
        email: "u@x.com",
      });
      expect(decision.allowed).toBe(true);
      expect(decision.wouldHaveBlocked).toBe(false);
    }
    // No security events for happy-path traffic.
    expect(mockedEmitEvent).not.toHaveBeenCalled();
  });
});

describe("rateLimitResponseInit (standard 429 shape)", () => {
  it("surfaces code, routeGroup, retryAfterSeconds plus Retry-After header", () => {
    const init = rateLimitResponseInit({
      allowed: false,
      blocked: true,
      wouldHaveBlocked: true,
      retryAfterSeconds: 42,
      remaining: 0,
      policy: RATE_LIMIT_POLICIES.auth_login,
      key: "rl:auth_login:foo",
      mode: "enforce",
    });
    expect(init.status).toBe(429);
    expect(init.body).toMatchObject({
      code: RATE_LIMIT_POLICIES.auth_login.userFacingErrorCode,
      routeGroup: "auth_login",
      retryAfterSeconds: 42,
    });
    expect(init.headers["Retry-After"]).toBe("42");
    expect(init.headers["X-RateLimit-Group"]).toBe("auth_login");
    // Auth groups: no internal-threshold disclosure.
    expect(init.headers["X-RateLimit-Limit"]).toBeUndefined();
    expect(init.headers["X-RateLimit-Remaining"]).toBeUndefined();
  });

  it("exposes threshold headers for read-mostly groups (debuggability)", () => {
    const init = rateLimitResponseInit({
      allowed: false,
      blocked: true,
      wouldHaveBlocked: true,
      retryAfterSeconds: 5,
      remaining: 0,
      policy: RATE_LIMIT_POLICIES.public_read,
      key: "k",
      mode: "enforce",
    });
    expect(init.headers["X-RateLimit-Limit"]).toBe(
      String(RATE_LIMIT_POLICIES.public_read.maxAttempts),
    );
  });

  it("supports overrideBody for routes that need a non-429 mask (password reset request)", () => {
    const init = rateLimitResponseInit(
      {
        allowed: false,
        blocked: true,
        wouldHaveBlocked: true,
        retryAfterSeconds: 5,
        remaining: 0,
        policy: RATE_LIMIT_POLICIES.password_reset_request,
        key: "k",
        mode: "enforce",
      },
      {
        extraBody: { success: true, message: "If an account exists, we sent reset instructions." },
      },
    );
    // Body keeps the standard shape but adds the masking fields. The
    // route is responsible for changing status to 200 explicitly when it
    // wants to mask the rate-limit hit (see password-reset request).
    expect(init.body).toMatchObject({
      code: RATE_LIMIT_POLICIES.password_reset_request.userFacingErrorCode,
      success: true,
      message: expect.stringContaining("If an account exists"),
    });
  });
});
