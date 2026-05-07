# Rate-Limit / Auth-Limit Policy Matrix

Status: implementation matrix
Branch: fix/rate-limit-auth-protection
Date: 2026-05-07

This matrix documents the central route groups used by
[`apps/web/src/lib/rate-limit-policy.ts`](../../../apps/web/src/lib/rate-limit-policy.ts)
and the structured telemetry emitted by
[`apps/web/src/lib/security-events.ts`](../../../apps/web/src/lib/security-events.ts).
The goal is balanced protection: auth and sensitive operations remain
protected, normal app usage stays generous, and high-false-positive
areas start in shadow or warn mode. Companion docs:
[`rate_limit_auth_limit_audit.md`](rate_limit_auth_limit_audit.md) and
[`rate_limit_auth_limit_final_report.md`](rate_limit_auth_limit_final_report.md).

## Route-group policy table

| group | mode | limit | key strategy | user impact posture | notes |
|---|---:|---:|---|---|---|
| `public_read` | enforce | 240 / 60s | IP + user-agent + route | generous | Middleware read protection. |
| `user_read` | shadow | 240 / 60s | user + route | measurement only | Disabled unless `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED=true`. |
| `auth_login` | enforce | 12 / 15m | normalized email + IP + user-agent | focused | Existing login flow still returns generic errors. |
| `auth_register` | enforce | 6 / 10m | normalized email + IP + user-agent | focused | Policy foundation only in this PR. |
| `password_reset` | enforce | 5 / 15m | normalized email + IP + user-agent | enumeration-safe | Policy foundation only in this PR. |
| `password_reset_request` | enforce | 5 / 15m | normalized email + IP + user-agent | enumeration-safe | Request route keeps generic success. |
| `password_reset_confirm` | enforce | 5 / 10m | IP + user-agent + route | moderate | Token TTL remains primary control. |
| `mfa_verify` | enforce | 5 / 5m | user + session + route | stricter | Policy foundation and login telemetry. |
| `mobile_oauth_exchange` | enforce | 60 / 60s | mobile client + IP + user-agent | retry-tolerant | Policy foundation only in this PR. |
| `user_write` | enforce | 120 / 60s | user + session + route | generous | Middleware write protection. |
| `provider_recommendations` | enforce | 120 / 60s | user + route | generous | Policy foundation only in this PR. |
| `export_data` | enforce | 3 / 15m | user + session + route | sensitive | Export attempt telemetry only in this PR. |
| `export_pdf` | enforce | 3 / 60s | user + route | sensitive | Policy foundation only in this PR. |
| `account_delete` | enforce | 3 / 15m | user + session + route | sensitive | Account-delete attempt telemetry only in this PR. |
| `admin_login` | enforce | 5 / 15m | normalized email + IP + user-agent | strict | Policy foundation only in this PR. |
| `admin_sensitive_action` | warn | 10 / 5m | user + session + route | no hard block | Step-up and audit remain primary controls. |
| `webhook` | warn | 0 | service secret/signature | no IP hard block | Signature verification is primary control. |
| `cron` | enforce | 0 | service secret | secret-gated | Middleware skips cron; auth remains secret-based. |
| `internal` | enforce | 0 | service secret | secret-gated | Middleware skips internal; auth remains secret-based. |

## IP and proxy trust boundary

[`resolveClientIP`](../../../apps/web/src/lib/rate-limit.ts) and
[`resolvePolicyClientIP`](../../../apps/web/src/lib/rate-limit-policy.ts)
read the client IP in this order:

1. `x-vercel-forwarded-for` (only when `VERCEL_ENV` is set).
2. `cf-connecting-ip`.
3. `x-real-ip`.
4. Leftmost token of `x-forwarded-for`.
5. `"anonymous"` fallback.

If the application is reachable on a path that is not behind the
expected proxy, an attacker can spoof these headers to either rotate
through fake IPs (defeating IP-keyed limits) or forge the victim's IP
to burn their compound-key slot. The compound key the auth groups use
(`email + IP + user-agent`) reduces but does not fully eliminate the
victim-targeted variant.

Production must verify and document:

- The web app is reachable only via Vercel edge or Cloudflare. Direct
  origin access is blocked at the network layer, or all
  `x-forwarded-for`, `x-real-ip`, `x-vercel-forwarded-for`, and
  `cf-connecting-ip` headers from non-trusted clients are stripped at
  the proxy.
- The admin app terminates at the same proxy stack.
- `cf-connecting-ip` and `x-vercel-forwarded-for` are set only by
  their respective edges, never by clients or any layer in front of
  them.

Until production verifies, no IP-keyed limit should be tightened and
no shadow user-keyed limit should be promoted to enforce.

## False-positive analysis

Normal users must not be blocked for any of:

- Page refresh and back-button navigation.
- Multiple tabs of the same page.
- Mobile network reconnect (Wi-Fi to LTE handoff). Mobile sessions
  fingerprint by user-agent only.
- Public Wi-Fi and hotel networks (everyone shares one IP).
- VPN egress (single shared IP).
- Office or shared subnets (also a single shared IP).
- Carrier NAT (LTE / 5G mobile egress).
- Retrying a failed request after a network blip.

Mechanisms that protect those cases today:

- `auth_login` keys by `email + IP + user-agent` (all hashed) so a
  same-IP neighbor mistyping a password does not lock unrelated users.
  Successful login clears the counter via `clearLoginFailures` so a
  household typically self-recovers after one good login.
- `provider_recommendations` is keyed by user only, so two users on
  the same NAT do not collide.
- `user_write` and `mfa_verify` use compound user + session + route
  keys, again preventing NAT collision.
- All read endpoints sit on the generous `public_read` 240/min IP
  ceiling, which absorbs office-scale shared egress.
- All lockouts have `TTL ≤ 30 min` and clear on successful auth. No
  permanent lock exists anywhere in the codebase.

Promotion criterion: if shadow data shows a normal-user shape ever
hits the threshold, do not promote the limit. Either widen the
threshold, change the key strategy, or keep it in shadow.

## Mode summary

| mode | what the limiter does on overrun | when used |
|---|---|---|
| `enforce` | denies the request, returns standard 429, emits `RATE_LIMIT_HIT` | auth, sensitive actions, well-understood quotas |
| `warn` | allows the request, emits `RATE_LIMIT_HIT` | admin sensitive actions, webhook flood signal |
| `shadow` | allows the request, emits `RATE_LIMIT_SHADOW_HIT` | new user-keyed counters before promotion |

`evaluateRateLimitPolicy(...)` honours these modes; the legacy
`enforceRateLimitPolicy(...)` keeps its enforce-on-deny behaviour for
existing call sites.

## UX guarantees (must hold)

- 429 responses always include `code`, `routeGroup`, and
  `retryAfterSeconds` in the JSON body and `Retry-After` and
  `X-RateLimit-Group` headers.
- Threshold headers (`X-RateLimit-Limit`,
  `X-RateLimit-Remaining`) are surfaced only on read-mostly groups.
  Auth and sensitive groups omit them so attackers cannot time the
  exact cadence.
- Password-reset request always returns the generic success body even
  when rate-limited. The 429 is observable only server-side, so an
  attacker cannot enumerate emails by counting 200 vs 429 responses.
- Login, register, and password-reset surfaces never reveal whether
  an email exists.
- Backup-code attempts during login share the lockout counter; they
  are not unlimited.
- All lockouts are recoverable. No permanent lock can be triggered
  from a public surface.

## Telemetry events

All emitted via `apps/web/src/lib/security-events.ts`. Best-effort,
non-blocking; never throws. `redactContext` collapses passwords, MFA
codes, backup codes, raw tokens, DB URLs, Redis URLs, and Stripe
secrets to `"[REDACTED]"` before any console or sink call.

| event | severity | trigger |
|---|---|---|
| `RATE_LIMIT_HIT` | warn | enforce or warn limiter denied |
| `RATE_LIMIT_SHADOW_HIT` | info | shadow limiter would have denied |
| `LOCKOUT_STARTED` | warn | login route — failure threshold crossed; reason: `UNKNOWN_OR_OAUTH_ONLY_ACCOUNT`, `INVALID_PASSWORD`, or `MFA_FAIL_LOCKOUT` |
| `MFA_FAILURE_BURST` | warn | login route — MFA failure inside auth path |
| `EXPORT_ATTEMPT` | info | every `/api/export` invocation |
| `ACCOUNT_DELETE_ATTEMPT` | warn | every `/api/account/delete` invocation |
| `WEBHOOK_SIG_FAILURE` | warn | Stripe webhook signature mismatch (length-only payload metadata, never raw bytes) |
| `CRON_SECRET_MISUSE` | warn | `verifyInternalAuth(..., "cron")` failure |
| `INTERNAL_SECRET_MISUSE` | warn | `verifyInternalAuth(..., "internal" \| "impersonation")` failure |
| `LIMITER_DEGRADED` | warn | Redis-backed limiter falls back to in-memory |

What we never log: passwords, MFA codes, backup codes, raw session
tokens or JWTs, raw cron / internal secrets, raw webhook signatures
or bodies, full email addresses on enumeration-sensitive surfaces,
`DATABASE_URL`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`. The redaction is case- and
separator-insensitive, so `databaseUrl`, `database_url`,
`DATABASE-URL`, and `databaseurl` all redact identically.

## Keying guidance

- Avoid IP-only keys for authenticated user flows where a user or
  session key is available.
- Keep auth errors generic to avoid email enumeration.
- Prefer step-up plus audit for destructive account actions.
- Prefer warn or shadow before enforcing limits on admin sensitive
  actions, webhooks, and high-volume normal app usage.
- Never log passwords, MFA codes, backup codes, raw tokens, DB URLs,
  Redis URLs, Stripe secrets, or raw webhook signatures.

## Infra-verification checklist

- [ ] Web app reachable only via Vercel edge or Cloudflare; direct
      origin access blocked.
- [ ] Admin app terminates at the same proxy stack as the web app.
- [ ] `cf-connecting-ip` is set only by Cloudflare.
- [ ] `x-vercel-forwarded-for` is set only by Vercel.
- [ ] Logging pipeline (Sentry, DataDog, log aggregator) scrubs the
      never-log fields listed above so a misuse outside
      `security-events.ts` does not leak.
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are
      configured for the user-facing app in production. The in-memory
      fallback is per-instance and is degraded only.
- [ ] `LIMITER_DEGRADED` event fires once or zero times in a normal
      week of production traffic.
- [ ] `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED=true` is flipped in
      production for at least 30 days before any consideration of
      promoting `user_read` from shadow to enforce.
- [ ] Stripe webhook source IPs are not subject to any
      origin-network rate limit at the edge.
- [ ] `INTERNAL_WEBHOOK_SECRET` and `IMPERSONATION_HANDOFF_SECRET`
      have a documented rotation cadence.

## Promotion checklist (shadow → enforce)

A counter currently in `shadow` should only be promoted to `enforce`
when all of these hold:

1. At least 30 days of shadow data shows the per-user counter would
   have been hit at most once per user per week for over 99% of
   active users.
2. `LIMITER_DEGRADED` fired no more than once in the trailing 30
   days, or the in-memory fallback has been measured to not unblock
   the abuse pattern the limit is meant to catch.
3. The relevant infra-verification items above are closed.
4. The promotion is announced in a release note so support knows
   what to say when a real user trips it.

A counter currently in `warn` should only be promoted to `enforce`
when, in addition to the four conditions above, no operator has been
throttled by the warn signal during a real prod incident.
