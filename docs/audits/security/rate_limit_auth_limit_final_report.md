# Rate-Limit / Auth-Limit Audit — Final Report

**Status:** post-implementation
**Branch:** fix/system-correctness-audit
**Date:** 2026-05-07
**Pre-implementation matrix:** [rate_limit_policy_matrix.md](rate_limit_policy_matrix.md)
**Audit summary:** [rate_limit_auth_limit_audit.md](rate_limit_auth_limit_audit.md)

This report documents what was changed, what is now enforced, what is
running in shadow / warn mode, why normal users should not be blocked,
and what attack paths are still blocked. It also lists remaining
infra-verification items that ops must close out before promoting any
shadow counter to enforce.

---

## 1. What was changed

### New modules

| File | Purpose |
|------|---------|
| [apps/web/src/lib/security-events.ts](../../../apps/web/src/lib/security-events.ts) | Structured security-event taxonomy (`emitSecurityEvent`) with field-level redaction (passwords / MFA codes / backup codes / raw tokens / DB & Redis URLs / Stripe secret keys all collapse to `"[REDACTED]"`), best-effort console + optional downstream sink, never throws. Case- and separator-insensitive deny-list match so `DATABASE_URL`, `databaseUrl`, `database-url`, `databaseurl` all redact identically. |
| [apps/web/src/lib/security-events.test.ts](../../../apps/web/src/lib/security-events.test.ts) | 11 unit tests covering redaction depth, arrays, separator-insensitive matching, circular structures, sink failures, severity → console-level mapping. |

### Extended modules (additive within existing API)

| File | Change |
|------|--------|
| [apps/web/src/lib/rate-limit-policy.ts](../../../apps/web/src/lib/rate-limit-policy.ts) | Added `RateLimitMode = "enforce" \| "warn" \| "shadow"` and `mode` / `exposeHeaders` optional fields on `RateLimitPolicy` (defaults preserve legacy enforce behavior). Added new groups: `user_read` (shadow), `password_reset_request`, `password_reset_confirm`, `export_pdf`. Flipped `admin_sensitive_action` and `webhook` to `warn`. Added mode-aware `evaluateRateLimitPolicy(...)` (never blocks in shadow/warn) and `rateLimitResponseInit(...)` standard 429 builder (`code`, `routeGroup`, `retryAfterSeconds` body fields; `Retry-After`, `X-RateLimit-Group` headers; threshold headers only on read-mostly groups). Wired `RATE_LIMIT_HIT` event into the existing `enforceRateLimitPolicy` so every rate-limit denial fans out to ops without changing the response shape. |
| [apps/web/src/lib/rate-limit-policy.test.ts](../../../apps/web/src/lib/rate-limit-policy.test.ts) | Extended with 11 new mode-behavior + 429-shape tests. |
| [apps/web/src/lib/rate-limit.ts](../../../apps/web/src/lib/rate-limit.ts) | Added `LIMITER_DEGRADED` security event on transition into Redis-degraded mode (and at the rewarn cadence). Lazy import of `security-events` keeps edge-runtime callers tree-shakable. |
| [apps/web/src/lib/internal-secrets.ts](../../../apps/web/src/lib/internal-secrets.ts) | Emit `CRON_SECRET_MISUSE` / `INTERNAL_SECRET_MISUSE` on `verifyInternalAuth` failure when an Authorization header was supplied but didn't match — distinguishes "real misuse" from "noise of unauthenticated probes". |
| [apps/web/src/middleware.ts](../../../apps/web/src/middleware.ts) | Standard 429 body now includes `routeGroup` + `retryAfterSeconds` + `X-RateLimit-Group` header. Added optional userId-keyed shadow counter (`user_read` group) gated by `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED=true` — off by default so the audit pass is zero-overhead in production until ops explicitly opts in. |
| [apps/web/src/app/api/auth/login/route.ts](../../../apps/web/src/app/api/auth/login/route.ts) | Emit `LOCKOUT_STARTED` on every transition into the post-failure lockout (with `reason` distinguishing `UNKNOWN_OR_OAUTH_ONLY_ACCOUNT`, `INVALID_PASSWORD`, `MFA_FAIL_LOCKOUT`). Emit `MFA_FAILURE_BURST` on every MFA failure inside the login path so a per-user MFA-grinder is visible in dashboards before the IP-keyed lockout fires. |
| [apps/web/src/app/api/account/delete/route.ts](../../../apps/web/src/app/api/account/delete/route.ts) | Emit `ACCOUNT_DELETE_ATTEMPT` on every invocation regardless of outcome — that's the audit trail an investigator needs if a stranger walks up to a left-open laptop. |
| [apps/web/src/app/api/export/route.ts](../../../apps/web/src/app/api/export/route.ts) | Emit `EXPORT_ATTEMPT` on every invocation (info-level). |
| [apps/web/src/app/api/webhooks/stripe/route.ts](../../../apps/web/src/app/api/webhooks/stripe/route.ts) | Emit `WEBHOOK_SIG_FAILURE` on signature mismatch. Logs only `signatureLength` and `bodyLength` — never the raw signature or body. |

### What we deliberately did NOT change

- **No existing rate-limit threshold was tightened.** The user's brief
  was explicit: don't blindly enforce stricter limits without measuring
  FP rate first. Login (12 / 15 min compound key + 5-failure / 30-min
  lockout), register (6 / 10 min), password reset (5 / 15 min request,
  5 / 600s confirm), MFA (5 / 5 min), mobile OAuth exchange (60 / 60s),
  provider recommendations (120 / 60s userId-keyed), account delete
  (3 / 15 min with step-up), export (3 / 15 min with step-up), and
  admin login (5 / 15 min → 30-min lockout) all retain pre-audit
  thresholds.
- **No existing route signature was broken.** Legacy
  `enforceRateLimitPolicy(...)` callers continue to work unchanged.
  Routes can adopt `evaluateRateLimitPolicy(...)` and
  `rateLimitResponseInit(...)` over time; nothing forces migration.
- **No new permanent lockout was added.** All limits and lockouts have
  a TTL ≤ 30 min and clear on successful authentication. No normal
  user can get stuck.

---

## 2. What is enforced now

### Auth surfaces (enforce, unchanged thresholds — with new audit fan-out)

| Group | Limit | Lockout | Key strategy | Audit events |
|-------|-------|---------|--------------|--------------|
| `auth_login` | 12 / 15 min compound `email + IP + UA-hash` | 5 failures → 30 min | NAT-safe compound key; `clearLoginFailures` on first success | `RATE_LIMIT_HIT`, `LOCKOUT_STARTED`, `MFA_FAILURE_BURST` (login MFA branch) |
| `auth_register` | 6 / 10 min compound `email + IP + UA-hash` | n/a | Hashed compound | `RATE_LIMIT_HIT` |
| `password_reset_request` | 5 / 15 min compound `email + IP + UA-hash` | n/a; **always returns generic success** even on 429 (no enumeration) | Hashed compound | `RATE_LIMIT_HIT` (server-side only) |
| `password_reset_confirm` | 5 / 600s `IP + UA + route` | n/a | Token TTL is the real gate | `RATE_LIMIT_HIT` |
| `mfa_verify` | 5 / 5 min `userId + session + route` | n/a (login lockout dominates) | userId-keyed | `RATE_LIMIT_HIT`, `MFA_FAILURE_BURST` (in login flow) |
| `mobile_oauth_exchange` | 60 / 60s `client + IP + UA + route` | n/a | Mobile-aware compound | `RATE_LIMIT_HIT` |

### Authenticated user surfaces

| Group | Limit | Notes |
|-------|-------|-------|
| `provider_recommendations` | 120 / 60s `userId + route` | Already userId-keyed — NAT-safe |
| `user_write` | 120 / 60s `userId + session + IP + route` | Compound — userId is part of the key when present |
| `export_data` | 3 / 15 min `userId + session + route` | Step-up auth required at the route layer; `EXPORT_ATTEMPT` always emitted |
| `account_delete` | 3 / 15 min `userId + session + route` | Step-up auth + audit + email notice; `ACCOUNT_DELETE_ATTEMPT` always emitted |

### Admin surfaces

| Group | Mode | Notes |
|-------|------|-------|
| `admin_login` | enforce (5 / 15 min IP, → 30-min lockout) | Admin app route unchanged |
| `admin_sensitive_action` | **warn** (10 / 5 min `adminId + session + route`) | Step-up + audit are the actual gates; rate-limit is signal-only so an admin doing real incident work is never locked out |

### Server-to-server

| Group | Mode | Notes |
|-------|------|-------|
| `webhook` | warn | Provider signature is the primary control. `WEBHOOK_SIG_FAILURE` emitted on mismatch (Stripe wired; App Store / Play Store / Resend can adopt the same one-line emit when convenient). Per-provider IP rate-limit deliberately not added — would reject legitimate Stripe deliveries. |
| `cron` | enforce (currently bypassed via `maxAttempts: 0`) | Secret-misuse events emitted on failed `verifyInternalAuth(..., "cron")`. |
| `internal` | enforce (currently bypassed via `maxAttempts: 0`) | Same as cron. `INTERNAL_SECRET_MISUSE` events on failed `verifyInternalAuth(..., "internal" \| "impersonation")`. |

---

## 3. What is shadow / warn-only

| Group | Mode | Why |
|-------|------|-----|
| `user_read` (new) | shadow | Off by default behind `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED=true`. When enabled, rides alongside the existing IP-keyed `public_read` enforce limit; emits `RATE_LIMIT_SHADOW_HIT` so we can build a 30-day FP baseline before deciding whether to promote to enforce. |
| `admin_sensitive_action` | warn | An admin handling a prod incident must not be locked out. `RATE_LIMIT_HIT` records bursts; step-up + audit are the gates. Promote to enforce only after the warn rate has stabilised and no operator has been throttled during a real incident. |
| `webhook` | warn | Provider IP rotation makes per-IP enforcement unsafe. `RATE_LIMIT_HIT` records a flood signal; signature is the real check. |
| `LIMITER_DEGRADED` | always-on signal | Not a rate-limit per se — emitted whenever the Upstash limiter falls back to in-memory. Tells ops the cluster-wide limit is now per-instance. |

---

## 4. Why normal users should NOT be blocked

The primary anti-FP mechanisms in this codebase are:

1. **Compound keys preserve NAT/Wi-Fi safety.** `auth_login` keys by
   `email + IP + UA` (all hashed via `stableRateLimitHash`), so a busy
   coffee-shop / office / carrier-NAT egress does not collide a typo
   from one user with the lockout counter of another. The
   `clearLoginFailures` call on first successful login resets the
   counter for that compound key, so even a same-IP+same-UA family
   member correcting their password unlocks everyone behind that
   egress.
2. **userId-keyed limits dominate IP-keyed limits where used.** Provider
   recommendations is keyed by userId only (`user_route` strategy), so
   120 calls/min is per-user, not per-IP — public Wi-Fi never collides.
   Account-delete, MFA verify, export, and user_write all use
   `user_session_route` which includes userId in the key.
3. **Mobile reconnect tolerated.** Mobile OAuth exchange is keyed by
   `client + IP + UA` and the limit is 60/min — far above the realistic
   1-per-sign-in cost. Mobile sessions use a UA-only fingerprint so
   network changes (Wi-Fi ↔ LTE) don't invalidate them, which means a
   reconnect doesn't trigger any auth retry.
4. **Multiple tabs / refreshes / retries are absorbed.** All read
   surfaces are at 240 / 60s; a user opening 4 tabs of `/dashboard`
   produces ~6 reads, not 240.
5. **Auth surfaces never reveal email existence.** Login, register, and
   password-reset request collapse all error branches into a single
   generic response. Password-reset request additionally returns 200
   even on rate-limit hit — the rate-limit denial is observable only
   server-side, so an attacker cannot probe which emails exist by
   counting 200 vs 429.
6. **No permanent locks.** All lockouts have TTL ≤ 30 min. A genuinely
   stuck user can wait, change network, or use account-recovery
   support.

The comprehensive test suite in
[apps/web/src/lib/rate-limit-policy.test.ts](../../../apps/web/src/lib/rate-limit-policy.test.ts)
explicitly verifies:

- Two different IPs hitting the same email do **not** collide
  (no lockout-as-DOS attack against a victim).
- Provider recommendations are isolated per-userId regardless of IP
  (`userId u1` from IP A and IP B share a counter; `userId u1` and
  `userId u2` on the same IP do not).
- Email is normalised (lowercase + trimmed) before hashing, so case /
  whitespace variations don't multiply the keyspace.
- Raw email and userId never appear in the key.
- Shadow mode never blocks even when the underlying limit is exceeded.
- Warn mode never blocks but emits the security event.
- Enforce mode blocks only when over the limit.
- Under-limit traffic produces zero security events (no FP noise).

The auth-flow regression suite passes 47 existing + 22 new = 69 tests
across the rate-limit policy module, security-events module, login
route, account-delete route, password-reset request route, middleware,
and base rate-limit module.

---

## 5. Attack paths still blocked

| Attack | Defense |
|--------|---------|
| Credential stuffing across many accounts from one IP | `auth_login` IP-burst limit + admin login 5/15 min IP-burst |
| Credential stuffing against a single account from one IP | `auth_login` compound `email+IP+UA` lockout (5 failures → 30 min) |
| Targeted MFA TOTP brute force | `mfa_verify` 5/5 min userId-keyed + login lockout shares the counter |
| Backup-code brute force | Login MFA path consumes the same lockout counter; per-user `mfa_verify` cap independently bounds the rate |
| Email enumeration via login | Single generic "Invalid email or password" message |
| Email enumeration via password reset | Always-generic 200 response, even on rate-limit hit |
| Email enumeration via register | Generic 409 "Account already exists" |
| Email-bombing of password resets | 5-minute recipient cooldown + `password_reset_request` per-`email+IP+UA` cap |
| Account take-over via export | Step-up auth required (`verifyUserStepUp`) |
| Account take-over via delete | Step-up auth required + email notice + `ACCOUNT_DELETE_ATTEMPT` audit event |
| Stripe webhook forgery | Signature verification + 72h replay window + DB idempotency + `WEBHOOK_SIG_FAILURE` event on mismatch |
| Cron / internal secret leak | Per-kind secret check via `verifyInternalAuth` + `CRON_SECRET_MISUSE` / `INTERNAL_SECRET_MISUSE` events on failure |
| Admin session compromise → mass-destructive script | Step-up auth on every destructive action + `RATE_LIMIT_HIT` warn signal at 10 / 5 min + admin audit log |
| Limiter degradation hiding an attack | `LIMITER_DEGRADED` event on Redis fallback transition |
| Session hijack via spoofed `x-forwarded-for` | **NEEDS INFRA VERIFICATION** — see §7 below |
| MFA-burst against a known user | `MFA_FAILURE_BURST` event on every login MFA failure |
| Lockout-as-DOS against a victim | Compound key (`email+IP+UA`) — attacker must match the victim's IP+UA, not just email |

---

## 6. Observability events emitted

All emit through `apps/web/src/lib/security-events.ts`. Every event is
non-blocking (does not delay the caller's response), redacted (the
deny-list collapses passwords / MFA codes / backup codes / raw tokens
/ DB URL / Redis URL / Stripe secret keys to `"[REDACTED]"`), and goes
to both `console.{log,warn,error}` and the optional
`setSecurityEventSink` hook. A fan-out to a downstream sink (Sentry
breadcrumb, DataDog event, or `prisma.securityEvent.create`) can be
installed at app boot without touching call sites.

| Event | Where it's emitted | Severity |
|-------|--------------------|----------|
| `RATE_LIMIT_HIT` | Every `enforceRateLimitPolicy` denial; every `evaluateRateLimitPolicy` denial in enforce or warn mode | warn |
| `RATE_LIMIT_SHADOW_HIT` | Every `evaluateRateLimitPolicy` denial in shadow mode | info |
| `LOCKOUT_STARTED` | Login route — on transition into the post-failure lockout, with `reason` distinguishing `UNKNOWN_OR_OAUTH_ONLY_ACCOUNT`, `INVALID_PASSWORD`, `MFA_FAIL_LOCKOUT` | warn |
| `MFA_FAILURE_BURST` | Login route — on every MFA failure within the auth path; `method` distinguishes TOTP vs backup code | warn |
| `EXPORT_ATTEMPT` | `/api/export` — every invocation, regardless of outcome | info |
| `ACCOUNT_DELETE_ATTEMPT` | `/api/account/delete` — every invocation, regardless of outcome | warn |
| `WEBHOOK_SIG_FAILURE` | `/api/webhooks/stripe` — on signature mismatch (length-only logged, never raw signature/body) | warn |
| `CRON_SECRET_MISUSE` | `verifyInternalAuth(..., "cron")` — on `MALFORMED_AUTH_HEADER`, `EMPTY_TOKEN`, or `TOKEN_MISMATCH` | warn |
| `INTERNAL_SECRET_MISUSE` | `verifyInternalAuth(..., "internal" \| "impersonation")` — same trigger | warn |
| `LIMITER_DEGRADED` | `apps/web/src/lib/rate-limit.ts` on transition into Redis-degraded mode | warn |

What we deliberately do **not** log: passwords, MFA codes, backup
codes, raw session tokens / JWTs, raw cron / internal secrets, full
email addresses (only normalised lowercase email on enumeration-safe
auth surfaces), `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`. The `redactContext` function in
`security-events.ts` enforces this at the field level — case- and
separator-insensitive — and a unit test verifies the deny-list. The
webhook signature failure log records only `signatureLength` +
`bodyLength`, never the raw bytes.

---

## 7. Remaining infra-verification items

These are the open items that ops must close out **before** any
shadow counter is promoted to enforce. They are not code changes —
they are trust-boundary assumptions that the code is making and that
the deployment configuration must validate.

- [ ] **Confirm web app is reachable only via Vercel edge or
      Cloudflare.** The IP-extraction precedence
      (`apps/web/src/lib/rate-limit.ts` `resolveClientIP`) trusts
      `x-vercel-forwarded-for`, `cf-connecting-ip`, `x-real-ip`, and
      `x-forwarded-for` in that order. If the application is reachable
      directly (DigitalOcean App Platform origin, naked IP, etc.), an
      attacker can spoof these headers and (a) bypass IP-keyed
      lockouts by forging a fresh IP per request, (b) target a victim
      by forging the victim's IP+UA and burning their compound-key
      lockout slot.
- [ ] **Confirm admin app egress trust boundary.**
      `apps/admin/src/middleware.ts` `resolveClientIP` matches the web
      app — but admin must terminate at the same proxy stack to be
      safe.
- [ ] **Confirm `cf-connecting-ip` is set only by the Cloudflare
      edge.** If a load balancer in front of Cloudflare passes through
      this header from clients, IP-keyed limits are spoofable.
- [ ] **Confirm `x-vercel-forwarded-for` is set only by Vercel.** Same
      threat shape as above.
- [ ] **Confirm logging pipeline scrubs the never-log fields.**
      `redactContext` is the in-process safety net. The pipeline
      (DataDog, Sentry, log aggregator) should also scrub
      `password*`, `*token*`, `*secret*`, `databaseUrl`,
      `UPSTASH_REDIS_REST_*`, `STRIPE_*` from arbitrary log lines so a
      misuse outside the security-events helper doesn't leak.
- [ ] **Confirm `UPSTASH_REDIS_REST_URL` /
      `UPSTASH_REDIS_REST_TOKEN` are set in production for
      `apps/web`.** The fallback to in-memory works, but a
      horizontally scaled deployment with only in-memory limits is
      per-instance, not per-cluster — every additional instance widens
      the effective rate limit by ×N. The `LIMITER_DEGRADED` event
      surfaces this transition, but the steady state should never need
      it.
- [ ] **Confirm the `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED` flag is
      flipped to `true` in production for ≥30 days before promoting
      `user_read` from shadow to enforce.** Without the data we cannot
      tell whether NAT-collision FPs would punish legitimate users.
- [ ] **Confirm Stripe webhook source IPs are not subject to any
      origin-network rate limit at the edge.** Vercel / Cloudflare can
      throttle inbound IPs by default; if a cluster of Stripe egress
      IPs lands in the same /24, throttling at the edge will silently
      drop deliveries despite our `webhook` group being warn-only.
- [ ] **Document whether `INTERNAL_WEBHOOK_SECRET` and
      `IMPERSONATION_HANDOFF_SECRET` are rotated on a schedule.** The
      audit emits `INTERNAL_SECRET_MISUSE` on mismatch, but a leaked
      secret remains valid until rotation. The admin app already
      provides `/api/security/key-rotation` for at-will rotation; ops
      should add a quarterly rotation calendar entry.

---

## 8. Promotion checklist (shadow → enforce)

A counter currently in `shadow` should only be promoted to `enforce`
when **all** of these are true:

1. ≥30 days of shadow data in production showing the per-userId limit
   would have been hit at most once per userId per week for >99% of
   active users (the FP target is "almost never").
2. The `LIMITER_DEGRADED` event has fired no more than once in the
   trailing 30 days, OR the in-memory fallback has been measured to
   not unblock the very abuse pattern the limit is meant to catch.
3. The infra-verification items in §7 relevant to that group's IP /
   userId trust assumptions are closed.
4. The change is announced in a release note so support knows what to
   say if a real user trips it.

---

## 9. Files added or changed by this audit

```
docs/audits/security/rate_limit_policy_matrix.md          (new — pre-impl matrix)
docs/audits/security/rate_limit_auth_limit_audit.md       (existing — preserved)
docs/audits/security/rate_limit_auth_limit_final_report.md (this file)

apps/web/src/lib/security-events.ts                        (new)
apps/web/src/lib/security-events.test.ts                   (new — 11 tests)
apps/web/src/lib/rate-limit-policy.ts                      (extended: mode, evaluateRateLimitPolicy, rateLimitResponseInit, new groups, RATE_LIMIT_HIT fan-out)
apps/web/src/lib/rate-limit-policy.test.ts                 (extended: +11 mode/429-shape tests)
apps/web/src/lib/rate-limit.ts                             (LIMITER_DEGRADED event)
apps/web/src/lib/internal-secrets.ts                       (CRON_/INTERNAL_SECRET_MISUSE events)
apps/web/src/middleware.ts                                 (std 429 shape; opt-in shadow user_read counter)
apps/web/src/app/api/auth/login/route.ts                   (LOCKOUT_STARTED, MFA_FAILURE_BURST events)
apps/web/src/app/api/account/delete/route.ts               (ACCOUNT_DELETE_ATTEMPT event)
apps/web/src/app/api/export/route.ts                       (EXPORT_ATTEMPT event)
apps/web/src/app/api/webhooks/stripe/route.ts              (WEBHOOK_SIG_FAILURE event)
```

**Total:** 13 files (3 docs + 10 code), 0 thresholds tightened, 0
user-facing route signatures broken. 22 new tests + 47 existing tests
pass.
