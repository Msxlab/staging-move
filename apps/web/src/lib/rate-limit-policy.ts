import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { emitSecurityEvent } from "@/lib/security-events";
import { resolveClientIpFromHeaders } from "@/lib/client-ip";

export type RateLimitRouteGroup =
  | "public_read"
  | "user_read"
  | "auth_login"
  | "auth_register"
  | "password_reset"
  | "password_reset_request"
  | "password_reset_confirm"
  | "mfa_verify"
  | "mobile_oauth_exchange"
  | "user_write"
  | "provider_recommendations"
  | "export_data"
  | "export_pdf"
  | "account_delete"
  | "admin_login"
  | "admin_sensitive_action"
  | "webhook"
  | "cron"
  | "internal";

/**
 * Enforcement mode per route group.
 *
 *   - `enforce` — block on overrun. The default; matches the legacy behavior
 *     of `enforceRateLimitPolicy` so existing call sites keep working.
 *   - `warn`    — never block at the limiter, but emit `RATE_LIMIT_HIT` so
 *     ops sees the signal. Useful when the false-positive cost is high
 *     (admin sensitive actions during an incident, webhook flood signal).
 *   - `shadow`  — never block, emit `RATE_LIMIT_SHADOW_HIT` only. Used to
 *     gather data before promoting to enforce, and for the new userId-keyed
 *     dashboard counters that ride alongside the existing IP-keyed limits.
 *
 * See docs/audits/security/rate_limit_policy_matrix.md for which group is
 * in which mode and why.
 */
export type RateLimitMode = "enforce" | "warn" | "shadow";

export type RateLimitKeyStrategy =
  | "ip_user_agent_route"
  | "email_ip"
  | "user_session_route"
  | "user_route"
  | "mobile_client_ip_user_agent"
  | "service_secret";

export interface RateLimitPolicy {
  group: RateLimitRouteGroup;
  maxAttempts: number;
  windowSeconds: number;
  cooldownSeconds: number;
  hardLockoutThreshold: number;
  hardLockoutSeconds: number;
  keyStrategy: RateLimitKeyStrategy;
  userFacingErrorCode: string;
  preferStepUp: boolean;
  failClosed: boolean;
  /**
   * Enforcement mode. Defaults to `enforce` when omitted so legacy entries
   * keep their pre-audit behavior — the policy matrix only flips a few
   * groups to `warn` / `shadow` deliberately.
   */
  mode?: RateLimitMode;
  /**
   * Whether to surface the limit/remaining headers on 429 responses.
   * Auth and sensitive groups leave this off so attackers cannot time the
   * exact threshold. Read-mostly groups expose them for debuggability.
   */
  exposeHeaders?: boolean;
}

export const RATE_LIMIT_POLICIES: Record<RateLimitRouteGroup, RateLimitPolicy> = {
  public_read: {
    group: "public_read",
    maxAttempts: 240,
    windowSeconds: 60,
    cooldownSeconds: 15,
    hardLockoutThreshold: 0,
    hardLockoutSeconds: 0,
    keyStrategy: "ip_user_agent_route",
    userFacingErrorCode: "RATE_LIMITED",
    preferStepUp: false,
    failClosed: false,
    mode: "enforce",
    exposeHeaders: true,
  },
  // Authenticated dashboard reads. Lives alongside the existing middleware
  // public_read enforce limit; this entry rides in shadow mode keyed by
  // userId so we can measure NAT-collision FPs before promoting to enforce.
  user_read: {
    group: "user_read",
    maxAttempts: 240,
    windowSeconds: 60,
    cooldownSeconds: 0,
    hardLockoutThreshold: 0,
    hardLockoutSeconds: 0,
    keyStrategy: "user_route",
    userFacingErrorCode: "RATE_LIMITED",
    preferStepUp: false,
    failClosed: false,
    mode: "shadow",
    exposeHeaders: true,
  },
  auth_login: {
    group: "auth_login",
    maxAttempts: 12,
    windowSeconds: 15 * 60,
    cooldownSeconds: 60,
    hardLockoutThreshold: 5,
    hardLockoutSeconds: 30 * 60,
    keyStrategy: "email_ip",
    userFacingErrorCode: "AUTH_RATE_LIMITED",
    preferStepUp: false,
    failClosed: true,
  },
  auth_register: {
    group: "auth_register",
    maxAttempts: 6,
    windowSeconds: 10 * 60,
    cooldownSeconds: 120,
    hardLockoutThreshold: 12,
    hardLockoutSeconds: 30 * 60,
    keyStrategy: "email_ip",
    userFacingErrorCode: "REGISTER_RATE_LIMITED",
    preferStepUp: false,
    failClosed: true,
  },
  password_reset: {
    group: "password_reset",
    maxAttempts: 5,
    windowSeconds: 15 * 60,
    cooldownSeconds: 5 * 60,
    hardLockoutThreshold: 12,
    hardLockoutSeconds: 30 * 60,
    keyStrategy: "email_ip",
    userFacingErrorCode: "PASSWORD_RESET_RATE_LIMITED",
    preferStepUp: false,
    failClosed: true,
    mode: "enforce",
  },
  // Aliases of `password_reset` exposed for the policy matrix split. The
  // request route never returns 429 to the user — the rate-limit hit is
  // logged server-side and the response is always the generic success body
  // — so the user-facing-error-code is not surfaced. Confirm route does
  // return 429 normally.
  password_reset_request: {
    group: "password_reset_request",
    maxAttempts: 5,
    windowSeconds: 15 * 60,
    cooldownSeconds: 5 * 60,
    hardLockoutThreshold: 12,
    hardLockoutSeconds: 30 * 60,
    keyStrategy: "email_ip",
    userFacingErrorCode: "PASSWORD_RESET_RATE_LIMITED",
    preferStepUp: false,
    failClosed: true,
    mode: "enforce",
  },
  password_reset_confirm: {
    group: "password_reset_confirm",
    maxAttempts: 5,
    windowSeconds: 10 * 60,
    cooldownSeconds: 60,
    hardLockoutThreshold: 12,
    hardLockoutSeconds: 30 * 60,
    keyStrategy: "ip_user_agent_route",
    userFacingErrorCode: "PASSWORD_RESET_RATE_LIMITED",
    preferStepUp: false,
    failClosed: true,
    mode: "enforce",
  },
  mfa_verify: {
    group: "mfa_verify",
    maxAttempts: 5,
    windowSeconds: 5 * 60,
    cooldownSeconds: 60,
    hardLockoutThreshold: 10,
    hardLockoutSeconds: 15 * 60,
    keyStrategy: "user_session_route",
    userFacingErrorCode: "MFA_RATE_LIMITED",
    preferStepUp: true,
    failClosed: true,
  },
  mobile_oauth_exchange: {
    group: "mobile_oauth_exchange",
    maxAttempts: 60,
    windowSeconds: 60,
    cooldownSeconds: 30,
    hardLockoutThreshold: 120,
    hardLockoutSeconds: 10 * 60,
    keyStrategy: "mobile_client_ip_user_agent",
    userFacingErrorCode: "MOBILE_OAUTH_RATE_LIMITED",
    preferStepUp: false,
    failClosed: true,
  },
  user_write: {
    group: "user_write",
    maxAttempts: 120,
    windowSeconds: 60,
    cooldownSeconds: 30,
    hardLockoutThreshold: 0,
    hardLockoutSeconds: 0,
    keyStrategy: "user_session_route",
    userFacingErrorCode: "RATE_LIMITED",
    preferStepUp: false,
    failClosed: false,
  },
  provider_recommendations: {
    group: "provider_recommendations",
    maxAttempts: 120,
    windowSeconds: 60,
    cooldownSeconds: 30,
    hardLockoutThreshold: 300,
    hardLockoutSeconds: 10 * 60,
    keyStrategy: "user_route",
    userFacingErrorCode: "PROVIDER_RECOMMENDATIONS_RATE_LIMITED",
    preferStepUp: false,
    failClosed: false,
  },
  export_data: {
    group: "export_data",
    maxAttempts: 3,
    windowSeconds: 15 * 60,
    cooldownSeconds: 5 * 60,
    hardLockoutThreshold: 8,
    hardLockoutSeconds: 60 * 60,
    keyStrategy: "user_session_route",
    userFacingErrorCode: "EXPORT_RATE_LIMITED",
    preferStepUp: true,
    failClosed: true,
    mode: "enforce",
  },
  // PDF exports cost more than data exports. Same group conventions, lower
  // ceiling, single per-userId key (no need for per-route splitting since
  // there's one PDF endpoint).
  export_pdf: {
    group: "export_pdf",
    maxAttempts: 3,
    windowSeconds: 60,
    cooldownSeconds: 30,
    hardLockoutThreshold: 6,
    hardLockoutSeconds: 30 * 60,
    keyStrategy: "user_route",
    userFacingErrorCode: "EXPORT_RATE_LIMITED",
    preferStepUp: false,
    failClosed: true,
    mode: "enforce",
  },
  account_delete: {
    group: "account_delete",
    maxAttempts: 3,
    windowSeconds: 15 * 60,
    cooldownSeconds: 5 * 60,
    hardLockoutThreshold: 5,
    hardLockoutSeconds: 60 * 60,
    keyStrategy: "user_session_route",
    userFacingErrorCode: "ACCOUNT_DELETE_RATE_LIMITED",
    preferStepUp: true,
    failClosed: true,
  },
  admin_login: {
    group: "admin_login",
    maxAttempts: 5,
    windowSeconds: 15 * 60,
    cooldownSeconds: 5 * 60,
    hardLockoutThreshold: 5,
    hardLockoutSeconds: 30 * 60,
    keyStrategy: "email_ip",
    userFacingErrorCode: "ADMIN_LOGIN_RATE_LIMITED",
    preferStepUp: true,
    failClosed: false,
  },
  admin_sensitive_action: {
    group: "admin_sensitive_action",
    maxAttempts: 10,
    windowSeconds: 5 * 60,
    cooldownSeconds: 60,
    hardLockoutThreshold: 20,
    hardLockoutSeconds: 30 * 60,
    keyStrategy: "user_session_route",
    userFacingErrorCode: "ADMIN_ACTION_RATE_LIMITED",
    preferStepUp: true,
    failClosed: true,
    // Warn-only: the false-positive cost of locking out an admin during
    // a real incident is "the incident gets worse". Step-up auth + audit
    // are the actual gates. Promote to enforce only after data review.
    mode: "warn",
  },
  webhook: {
    group: "webhook",
    maxAttempts: 0,
    windowSeconds: 0,
    cooldownSeconds: 0,
    hardLockoutThreshold: 0,
    hardLockoutSeconds: 0,
    keyStrategy: "service_secret",
    userFacingErrorCode: "WEBHOOK_AUTH_REQUIRED",
    preferStepUp: false,
    failClosed: true,
    // Webhook routes verify the provider signature; rate-limit by IP
    // would reject legitimate deliveries. The flood signal is recorded
    // out-of-band via security-events (WEBHOOK_SIG_FAILURE on bad sig,
    // and ops can dashboard the WEBHOOK route group).
    mode: "warn",
  },
  cron: {
    group: "cron",
    maxAttempts: 0,
    windowSeconds: 0,
    cooldownSeconds: 0,
    hardLockoutThreshold: 0,
    hardLockoutSeconds: 0,
    keyStrategy: "service_secret",
    userFacingErrorCode: "CRON_AUTH_REQUIRED",
    preferStepUp: false,
    failClosed: true,
  },
  internal: {
    group: "internal",
    maxAttempts: 0,
    windowSeconds: 0,
    cooldownSeconds: 0,
    hardLockoutThreshold: 0,
    hardLockoutSeconds: 0,
    keyStrategy: "service_secret",
    userFacingErrorCode: "INTERNAL_AUTH_REQUIRED",
    preferStepUp: false,
    failClosed: true,
  },
};

export interface RateLimitIdentity {
  email?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  routeId?: string | null;
  clientType?: string | null;
  extra?: string | null;
}

export interface PolicyRateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  policy: RateLimitPolicy;
  key: string;
}

export function normalizeEmailForRateLimit(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function stableRateLimitHash(value: string | null | undefined): string {
  const input = value || "none";
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function resolvePolicyClientIP(request: Request): string {
  return resolveClientIpFromHeaders(request.headers);
}

export function resolvePolicyClientType(request: Request, explicit?: string | null): string {
  const value = explicit || request.headers.get("x-client-type") || "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "mobile" || normalized === "web") return normalized;

  const ua = request.headers.get("user-agent") || "";
  return /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "web";
}

export function buildPolicyRateLimitKey(
  request: Request,
  group: RateLimitRouteGroup,
  identity: RateLimitIdentity = {},
): string {
  const policy = RATE_LIMIT_POLICIES[group];
  const ipHash = stableRateLimitHash(resolvePolicyClientIP(request));
  const uaHash = stableRateLimitHash(request.headers.get("user-agent") || "");
  const clientType = resolvePolicyClientType(request, identity.clientType);
  const route = stableRateLimitHash(identity.routeId || new URL(request.url).pathname);
  const email = stableRateLimitHash(normalizeEmailForRateLimit(identity.email));
  const user = stableRateLimitHash(identity.userId);
  const session = stableRateLimitHash(identity.sessionId);
  const extra = stableRateLimitHash(identity.extra);

  switch (policy.keyStrategy) {
    case "email_ip":
      // Deliberately omits the User-Agent. UA is fully attacker-controlled, so
      // including it would let a brute-force / credential-stuffing attacker
      // reset the per-account limiter — and the login lockout, which reuses
      // this key — on every request just by rotating the UA header, defeating
      // both. Email + IP separates NAT neighbors well enough without that hole.
      return `rl:${group}:email:${email}:ip:${ipHash}:client:${clientType}:route:${route}`;
    case "user_session_route":
      return `rl:${group}:user:${user}:session:${session}:ip:${ipHash}:client:${clientType}:route:${route}:extra:${extra}`;
    case "user_route":
      return `rl:${group}:user:${user}:client:${clientType}:route:${route}:extra:${extra}`;
    case "mobile_client_ip_user_agent":
      return `rl:${group}:client:${clientType}:ip:${ipHash}:ua:${uaHash}:route:${route}:extra:${extra}`;
    case "service_secret":
      return `rl:${group}:route:${route}`;
    case "ip_user_agent_route":
    default:
      return `rl:${group}:ip:${ipHash}:ua:${uaHash}:client:${clientType}:route:${route}`;
  }
}

export function getRetryAfterSeconds(resetAt: number, floorSeconds = 1): number {
  return Math.max(floorSeconds, Math.ceil((resetAt - Date.now()) / 1000));
}

export async function enforceRateLimitPolicy(
  request: Request,
  group: RateLimitRouteGroup,
  identity: RateLimitIdentity = {},
): Promise<PolicyRateLimitResult> {
  const policy = RATE_LIMIT_POLICIES[group];
  if (policy.maxAttempts <= 0 || policy.windowSeconds <= 0) {
    return {
      success: true,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: Date.now(),
      retryAfterSeconds: 0,
      policy,
      key: buildPolicyRateLimitKey(request, group, identity),
    };
  }

  const key = buildPolicyRateLimitKey(request, group, identity);
  const result = await rateLimit(key, {
    limit: policy.maxAttempts,
    windowSeconds: policy.windowSeconds,
    failClosed: policy.failClosed,
  });
  const retryAfterSeconds = getRetryAfterSeconds(result.resetAt);

  if (!result.success) {
    logger.warn("rate_limit_hit", {
      group,
      routeId: identity.routeId || new URL(request.url).pathname,
      keyStrategy: policy.keyStrategy,
      clientType: resolvePolicyClientType(request, identity.clientType),
      retryAfterSeconds,
      userFacingErrorCode: policy.userFacingErrorCode,
    });
    emitSecurityEvent({
      type: "RATE_LIMIT_HIT",
      severity: "warn",
      group,
      key: stableRateLimitHash(key),
      retryAfterSeconds,
      context: {
        routeId: identity.routeId || new URL(request.url).pathname,
        keyStrategy: policy.keyStrategy,
        clientType: resolvePolicyClientType(request, identity.clientType),
        mode: policy.mode ?? "enforce",
      },
    });
  }

  return {
    ...result,
    retryAfterSeconds,
    policy,
    key,
  };
}

// ── Mode-aware decision (additive) ──────────────────────────────────
// `enforceRateLimitPolicy` keeps its legacy semantics so the dozen+ call
// sites already adopting it don't need to change. `evaluateRateLimitPolicy`
// is the new entry point for shadow / warn — it always returns
// `{ allowed: true }` for non-enforce modes, so the caller can use the
// same `if (!decision.allowed) return …` branch shape regardless of mode.

export interface PolicyDecision {
  /** True when the caller should let the request proceed. */
  allowed: boolean;
  /** True only when the limiter denied AND mode is enforce. */
  blocked: boolean;
  /** True when the limiter denied, regardless of mode (shadow/warn signal). */
  wouldHaveBlocked: boolean;
  retryAfterSeconds: number;
  remaining: number;
  policy: RateLimitPolicy;
  key: string;
  mode: RateLimitMode;
}

/**
 * Run a route-policy check that respects the policy's mode. Use this
 * for new shadow / warn integrations; existing enforce routes can keep
 * calling `enforceRateLimitPolicy`.
 */
export async function evaluateRateLimitPolicy(
  request: Request,
  group: RateLimitRouteGroup,
  identity: RateLimitIdentity = {},
): Promise<PolicyDecision> {
  const policy = RATE_LIMIT_POLICIES[group];
  const mode: RateLimitMode = policy.mode ?? "enforce";
  const key = buildPolicyRateLimitKey(request, group, identity);

  if (policy.maxAttempts <= 0 || policy.windowSeconds <= 0) {
    return {
      allowed: true,
      blocked: false,
      wouldHaveBlocked: false,
      retryAfterSeconds: 0,
      remaining: Number.POSITIVE_INFINITY,
      policy,
      key,
      mode,
    };
  }

  const result = await rateLimit(key, {
    limit: policy.maxAttempts,
    windowSeconds: policy.windowSeconds,
    failClosed: policy.failClosed,
  });
  const retryAfterSeconds = getRetryAfterSeconds(result.resetAt);

  if (result.success) {
    return {
      allowed: true,
      blocked: false,
      wouldHaveBlocked: false,
      retryAfterSeconds,
      remaining: result.remaining,
      policy,
      key,
      mode,
    };
  }

  const eventContext = {
    routeId: identity.routeId || new URL(request.url).pathname,
    keyStrategy: policy.keyStrategy,
    clientType: resolvePolicyClientType(request, identity.clientType),
    mode,
  };

  if (mode === "shadow") {
    emitSecurityEvent({
      type: "RATE_LIMIT_SHADOW_HIT",
      severity: "info",
      group,
      key: stableRateLimitHash(key),
      retryAfterSeconds,
      context: eventContext,
    });
    return {
      allowed: true,
      blocked: false,
      wouldHaveBlocked: true,
      retryAfterSeconds,
      remaining: 0,
      policy,
      key,
      mode,
    };
  }

  if (mode === "warn") {
    emitSecurityEvent({
      type: "RATE_LIMIT_HIT",
      severity: "warn",
      group,
      key: stableRateLimitHash(key),
      retryAfterSeconds,
      context: eventContext,
    });
    return {
      allowed: true,
      blocked: false,
      wouldHaveBlocked: true,
      retryAfterSeconds,
      remaining: 0,
      policy,
      key,
      mode,
    };
  }

  // enforce
  emitSecurityEvent({
    type: "RATE_LIMIT_HIT",
    severity: "warn",
    group,
    key: stableRateLimitHash(key),
    retryAfterSeconds,
    context: eventContext,
  });
  return {
    allowed: false,
    blocked: true,
    wouldHaveBlocked: true,
    retryAfterSeconds,
    remaining: 0,
    policy,
    key,
    mode,
  };
}

// ── Standard 429 response builder ───────────────────────────────────

const ROUTE_GROUP_DEFAULT_MESSAGE: Partial<Record<RateLimitRouteGroup, string>> = {
  public_read: "Too many requests. Please slow down.",
  user_read: "Too many requests. Please slow down.",
  auth_login: "Too many login attempts. Please wait and try again.",
  auth_register: "Too many requests. Please wait.",
  password_reset: "Too many requests. Please try again later.",
  password_reset_request: "Too many requests. Please try again later.",
  password_reset_confirm: "Too many requests. Please try again later.",
  mfa_verify: "Too many attempts. Please try again later.",
  mobile_oauth_exchange: "Too many attempts. Please try again shortly.",
  user_write: "Too many requests. Please slow down.",
  provider_recommendations: "Too many requests. Please slow down.",
  export_data: "Too many export attempts. Please wait and try again.",
  export_pdf: "Too many export attempts. Please wait and try again.",
  account_delete: "Too many requests. Please wait.",
  admin_login: "Too many login attempts. Please try again later.",
  admin_sensitive_action: "Too many attempts. Please slow down.",
};

export interface RateLimitResponseInit {
  /**
   * Headers and JSON body to merge in. Useful for routes that need to
   * preserve a legacy field (e.g. `requiresPassword: true`).
   */
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
  /**
   * Override the user-facing message (rare — most callers want the
   * group default to keep responses uniform).
   */
  message?: string;
}

/**
 * Build a standard 429 response from a `PolicyDecision` (or the legacy
 * `PolicyRateLimitResult`). Surfaces `code`, `routeGroup`,
 * `retryAfterSeconds`, plus the `Retry-After` header. Internal threshold
 * headers are only set when `policy.exposeHeaders === true`.
 */
export function rateLimitResponseInit(
  decisionOrResult: PolicyDecision | PolicyRateLimitResult,
  init: RateLimitResponseInit = {},
): { body: Record<string, unknown>; status: number; headers: Record<string, string> } {
  const policy = decisionOrResult.policy;
  const retryAfterSeconds = decisionOrResult.retryAfterSeconds;
  const remaining =
    "remaining" in decisionOrResult && typeof decisionOrResult.remaining === "number"
      ? decisionOrResult.remaining
      : 0;

  const headers: Record<string, string> = {
    "Retry-After": String(retryAfterSeconds),
    "X-RateLimit-Group": policy.group,
    ...(init.extraHeaders || {}),
  };
  if (policy.exposeHeaders) {
    headers["X-RateLimit-Limit"] = String(policy.maxAttempts);
    headers["X-RateLimit-Remaining"] = String(Math.max(0, remaining));
  }

  const message =
    init.message ??
    ROUTE_GROUP_DEFAULT_MESSAGE[policy.group] ??
    "Too many requests. Please try again later.";

  return {
    status: 429,
    headers,
    body: {
      code: policy.userFacingErrorCode,
      error: message,
      routeGroup: policy.group,
      retryAfterSeconds,
      ...(init.extraBody || {}),
    },
  };
}
