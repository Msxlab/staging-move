# Distributed Rate Limiter Phase Report

Companion to `docs/audits/security/rate_limit_auth_limit_audit.md` and
`docs/audits/security/rate_limit_policy_matrix.md`. Scope of this phase:
make the rate-limit system production-ready for multi-replica deploys
without breaking normal users.

## 1. Current Limiter Architecture

| Layer | Source | Behavior |
|---|---|---|
| Distributed limiter | [apps/web/src/lib/rate-limit.ts](apps/web/src/lib/rate-limit.ts) | Upstash Redis via `@upstash/ratelimit` (sliding window). Configured iff `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are non-placeholder. |
| Policy matrix | [apps/web/src/lib/rate-limit-policy.ts](apps/web/src/lib/rate-limit-policy.ts) | Risk-based groups, three modes (`enforce` / `warn` / `shadow`), key strategies per group. |
| Middleware coverage | [apps/web/src/middleware.ts](apps/web/src/middleware.ts) | `applyRateLimit` runs for `/api/*` excluding `/api/internal/*`, `/api/webhooks/*`, `/api/cron/*`. |
| Admin login limiter | [apps/admin/src/app/api/auth/login/route.ts](apps/admin/src/app/api/auth/login/route.ts) | Standalone Upstash REST client (incr + lock keys); fallback to in-memory on Redis error. |
| Security events | [apps/web/src/lib/security-events.ts](apps/web/src/lib/security-events.ts) | Redacted `LIMITER_DEGRADED`, `RATE_LIMIT_HIT`, `RATE_LIMIT_SHADOW_HIT`. |

### In-process state of `rate-limit.ts`

- `redisDegradedUntil` — short window after a Redis failure; while
  active, calls go straight to memory fallback.
- `lastDegradedAtMs`, `lastDegradedReason`, `lastRecoveredAtMs` —
  scrubbed diagnostic state (added in this phase).
- `redisFailureWarned`, `lastRedisFailureWarningAt` — re-warn cadence
  control so a flaky Redis does not flood logs every request.

### What was already in place before this phase

- Sliding-window Upstash limiter wired via `@upstash/ratelimit`.
- In-memory fallback that ages itself out every 5 min.
- `LIMITER_DEGRADED` event emitted on Redis failure with
  re-warn cadence (transition + 5-min cadence).
- `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED` flag for shadow user_read
  counter; off by default.
- Webhook / cron / internal routes already exempt from the global IP
  middleware limiter.
- Provider recommendations group raised to 120/min user_route key
  (see `rate-limit-policy.ts:212`).
- `admin_sensitive_action` group set to `warn` (no hard block during
  incidents).

## 2. Redis / Upstash Configuration

### Source

- [`apps/web/src/lib/rate-limit.ts:11-18`](apps/web/src/lib/rate-limit.ts#L11-L18) — env detection.
- [`.env.example`](.env.example) — documents `UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN`, and the new
  `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED` flag.
- [`.env.production.example`](.env.production.example) — production
  expectation upgraded from "optional" to "REQUIRED in production"; in
  its absence the health endpoint flags `productionEnvOk:false`.

### Behavior matrix

| State | `limiterMode` | Behavior |
|---|---|---|
| Env present, Redis healthy | `distributed` | Counters shared across replicas. |
| Env absent (dev/test) | `memory` | Per-process; OK locally; flagged in production. |
| Env present, Redis recently failed | `degraded` | In-memory fallback for ~60 s; `LIMITER_DEGRADED` emitted; recovery clears the window early on first successful Redis call. |
| Env present, sensitive `failClosed` policy, Redis down | n/a (returns `success:false`) | Auth/admin paths fail closed in production rather than fall through to per-replica memory. |

## 3. Code Changes In This Phase

### 3.1 `apps/web/src/lib/rate-limit.ts`

- Added `lastDegradedAtMs` / `lastDegradedReason` / `lastRecoveredAtMs`
  state.
- Added `safeReason()` to scrub URLs, bearer tokens, and long
  identifiers from any error message before it lands in logs / health
  responses / events.
- Added `noteRedisRecovery()` so a successful Redis call after a
  degradation clears `redisDegradedUntil` early and records the
  recovery timestamp.
- Added the public `getLimiterHealth()` exporting:
  ```ts
  {
    distributedLimiterConfigured: boolean,
    limiterMode: "distributed" | "memory" | "degraded",
    provider: "upstash-redis" | "memory",
    environment: "production" | "staging" | "preview" | "development",
    productionEnvOk: boolean,
    lastDegradedAt: string | null,
    lastRecoveredAt: string | null,
    lastErrorReasonCode: string | null
  }
  ```
- Added `__resetLimiterHealthForTests()` (test-only).
- Enriched the `LIMITER_DEGRADED` event context with `provider` and
  `environment` (caller-supplied `routeGroup` is not available at the
  limiter call site, so it is intentionally omitted; route groups
  surface separately via `RATE_LIMIT_HIT`).

### 3.2 `apps/web/src/app/api/health/route.ts` (public web health)

The public endpoint is intentionally a minimal readiness probe
(`{ status, timestamp, uptimeSec, ready }`) — see
[`apps/web/src/app/api/health/route.test.ts`](apps/web/src/app/api/health/route.test.ts)
which guards against any infra-level fields appearing here. Limiter
visibility is therefore consolidated on the admin health endpoint only;
the public endpoint exposes nothing about Upstash, environment, or
configuration. This is the safer split: load balancers and synthetic
monitors get a small allow-listed shape, and ops gets the rich view
behind admin auth.

### 3.3 `apps/admin/src/lib/rate-limit-health.ts` (new)

- `buildLimiterHealth()` synchronous helper reading just env presence.
- `probeLimiterReachable()` does a 5-second `/ping` against Upstash
  REST and returns `{ ok, latencyMs, reason }` with the reason already
  scrubbed for URL / bearer / long token.

### 3.4 `apps/admin/src/app/api/health/route.ts` (admin health)

- Replaces the previous inline Redis fetch with
  `probeLimiterReachable()` so error messages can never leak the
  URL / token via `details`.
- Adds a top-level `limiter` block carrying the richer admin view
  (`distributedLimiterReachable`, `lastErrorReasonCode`).

### 3.5 `scripts/check-rate-limiter-health.ts` (new)

- Pings Upstash, then performs a tiny `SET / GET / DEL` round-trip
  against a unique key with a 30-second TTL.
- Output is JSON only; no URL / token / env value appears even in
  error cases (everything passes through the same scrubber).
- Exit codes: `0` healthy, `1` not configured, `2` configured but
  unreachable / probe failed.
- Wired up as `pnpm rate-limit:check`.

### 3.6 Env example updates

- [`.env.example:108-119`](.env.example) — adds the
  `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED` flag and clarifies that the
  in-memory fallback is a per-replica multiplier risk in production.
- [`.env.production.example`](.env.production.example) — Upstash vars
  upgraded from "optional" to "REQUIRED in production"; shadow flag
  documented.

### 3.7 Tests added

- [`apps/web/src/lib/rate-limit.test.ts`](apps/web/src/lib/rate-limit.test.ts):
  - `getLimiterHealth` — production-without-Redis flagged, dev allowed,
    URL / token never echoed, reset helper.
  - `LIMITER_DEGRADED redaction` — URL and bearer-style tokens are
    scrubbed from `lastErrorReasonCode`.
- [`apps/admin/src/lib/__tests__/rate-limit-health.test.ts`](apps/admin/src/lib/__tests__/rate-limit-health.test.ts):
  - `buildLimiterHealth` — placeholder vars treated as unconfigured;
    distributed / degraded transitions; URL / token never echoed.
  - `probeLimiterReachable` — `NOT_CONFIGURED` short-circuits without
    a network call; URL / token redacted from any error reason; non-PONG
    responses become `UNEXPECTED_RESPONSE`.
- [`apps/web/src/middleware.test.ts`](apps/web/src/middleware.test.ts):
  - Webhook routes are not run through the global IP limiter.
  - Cron routes are not run through the global IP limiter.
  - Internal routes are not run through the global IP limiter.

The existing
[`apps/web/src/lib/rate-limit-policy.test.ts`](apps/web/src/lib/rate-limit-policy.test.ts)
covers shadow / warn / enforce mode behavior including the
`admin_sensitive_action` warn semantics; no rewrite needed there.

## 4. Health Endpoint Behavior

### Public — `apps/web/src/app/api/health/route.ts`

Returns the minimal shape `{ status, timestamp, uptimeSec, ready }`
where `ready` is true iff the database can answer `SELECT 1`. No
limiter / Redis / env info is surfaced here on purpose — the
companion test forbids fields like `checks`, `seo`, `config`,
`memory`, or any env name. This protects the open endpoint from
infra fingerprinting.

If a production deploy needs an automated alert specifically for
"Upstash missing", route the alert to a synthetic monitor that hits
the **admin** health endpoint with a service account, or to the
`pnpm rate-limit:check` script run as a scheduled probe.

### Admin (auth-gated) — `apps/admin/src/app/api/health/route.ts`

- Adds top-level `limiter: AdminLimiterHealth`.
- `Redis (Upstash)` check now reports a scrubbed reason code (e.g.
  `HTTP_503`, `UNEXPECTED_RESPONSE`, `NOT_CONFIGURED`) instead of
  passing through fetch's raw error message.

### Why split

The public endpoint should let load balancers / synthetic monitors
detect a missing limiter without disclosing infra details (last
degradation timestamp, exact failure reason). Admin health stays
behind `requirePermission("settings", "canRead")` so detailed
diagnostics — useful during an incident — aren't leaked anonymously.

## 5. Degraded-Mode Behavior

- Trigger: any throwing call to the Upstash limiter inside `rateLimit()`.
- On trigger:
  1. `redisDegradedUntil = now + 60 s`
  2. `lastDegradedAtMs = now`
  3. `lastDegradedReason = safeReason(message)` (≤ 160 chars,
     URL / bearer / long-token scrubbed)
  4. `LIMITER_DEGRADED` security event emitted **only** on transition
     into degraded mode or at the 5-minute re-warn cadence.
- Recovery: first successful Redis call after the window expires runs
  `noteRedisRecovery()` — clears `redisDegradedUntil`, sets
  `lastRecoveredAtMs`. Subsequent `getLimiterHealth()` reads return
  `limiterMode: "distributed"` again.
- `failClosed` policies (auth, admin, password reset, MFA, account
  delete, exports) return `success:false` during the degraded window
  in production rather than falling through to the per-replica memory
  fallback.
- `failClosed:false` groups (public_read, user_read, user_write,
  provider_recommendations) continue serving from the in-memory
  limiter so normal users keep working through a brief Upstash
  outage. The trade-off: during a degradation, IP/user counters
  diverge across replicas — ops alert via `LIMITER_DEGRADED`, and
  the health endpoint flips to `degraded`.

### Event payload (post-redaction)

```jsonc
{
  "type": "LIMITER_DEGRADED",
  "severity": "warn",
  "context": {
    "reason": "fetch failed [URL_REDACTED] Bearer [REDACTED]",
    "provider": "upstash-redis",
    "environment": "production",
    "fallback": "memory",
    "windowMs": 60000
  }
}
```

## 6. Production Env Vars Required

| Variable | Required | Purpose |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | yes (production) | Distributed limiter endpoint. |
| `UPSTASH_REDIS_REST_TOKEN` | yes (production) | Distributed limiter auth. |
| `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED` | no, recommended `true` for 30-day baseline | Enables the userId-keyed shadow counter ride-along. |

`APP_ENV` / `VERCEL_ENV` / `DIGITALOCEAN_APP_ID` / `NODE_ENV`
already drive production-like detection (no change).

## 7. Staging Verification Commands

```bash
# 1. Confirm env vars exist without printing values
node -e "for (const k of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN']) console.log(k, Boolean(process.env[k]))"

# 2. Run the limiter health probe (no secrets in output)
pnpm rate-limit:check

# 3. Hit the admin health endpoint and inspect the limiter block
curl -sS -H "Cookie: $ADMIN_COOKIE" https://staging.locateflow.com/api/admin/health \
  | jq '.limiter'

# 4. Public health — minimal readiness only; should NOT contain limiter info
curl -sS https://staging.locateflow.com/api/health | jq '.'

# 5. Build verification
pnpm --filter @locateflow/web exec tsc --noEmit
pnpm --filter @locateflow/admin exec tsc --noEmit
pnpm --filter @locateflow/shared exec tsc --noEmit
pnpm --filter @locateflow/mobile exec tsc --noEmit

# 6. Targeted tests
pnpm --filter @locateflow/web test -- rate-limit security-events middleware health
pnpm --filter @locateflow/admin test -- rate-limit-health health auth/login
```

## 8. Proxy / IP Trust Requirements (Scope G)

### Headers consulted (in order)

`apps/web/src/lib/rate-limit.ts:228-247` and the parallel
`apps/web/src/lib/rate-limit-policy.ts:369-385`:

1. `x-vercel-forwarded-for` — only when `VERCEL_ENV` is set.
2. `cf-connecting-ip` — Cloudflare's trusted header.
3. `x-real-ip` — Nginx / ingress trusted header.
4. `x-forwarded-for` — leftmost entry.
5. fallback `"anonymous"`.

### Trust assumptions

- **Vercel** strips client-supplied `x-vercel-forwarded-for` at the
  edge, so trusting it is safe iff `VERCEL_ENV` is set.
- **DigitalOcean App Platform** terminates TLS at its load balancer
  and inserts `x-forwarded-for`. Direct origin access **must** be
  blocked at the App-Platform layer (already true for the production
  deploy — the container does not expose a public port outside the
  managed ingress).
- **Cloudflare** in front of either platform sets
  `cf-connecting-ip` from its own measurement of the client TCP
  endpoint. Before the limiter trusts it, Cloudflare access rules
  should restrict origin pulls to Cloudflare IPs (separate ops
  task, tracked in `docs/deploy/`).

### Risk

If an attacker can reach origin directly and forge any of the
trusted headers above, they can rotate the rate-limit key per
request. The current code does not validate proxy provenance —
it assumes the platform strips spoofed headers at the boundary.

### Decision

- No code-level `TRUST_PROXY_MODE` env guard added in this phase.
  Adding one risks breaking the existing DO App-Platform deploy
  during a security-critical change window.
- Documented as an infra requirement above and surfaced via the
  health endpoint indirectly (`environment` field exposes which
  proxy guarantees apply).
- Follow-up ticket: introduce `TRUST_PROXY_MODE=do-app|vercel|cloudflare`
  with explicit allowed-header lists, default `do-app` for prod.

## 9. Rollout Plan

1. **Deploy Upstash env to production**.
   - Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
   - Health endpoint flips to `limiterMode:"distributed"`.
2. **Verify health**.
   - Public `/api/health` returns `200` with `ready:true` (minimal
     readiness shape only — no limiter / infra fields by design).
   - Admin `/api/admin/health` shows `limiter.distributedLimiterReachable: true`
     and `limiter.limiterMode: "distributed"`.
   - `pnpm rate-limit:check` exits `0`.
3. **Enable shadow user_read for 30 days**.
   - Set `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED=true`.
   - Watch `RATE_LIMIT_SHADOW_HIT` events; expect roughly zero in
     normal app usage with the 240/min ceiling.
4. **Inspect false positives**.
   - Anyone with > 240 req/min steady-state on dashboard reads is
     either a bug-fix candidate (loop fetcher) or a legitimate
     reason to keep the ceiling generous.
5. **Consider limited enforcement only after data**.
   - Promote `user_read` to `enforce` only when the shadow data
     shows < 1% of users would hit the ceiling within a 30-day
     baseline. Otherwise raise the cap or keep it shadow.
6. **Keep `admin_sensitive_action` in `warn`**.
   - Promotion to `enforce` would lock out admins during the very
     incidents the rate-limit is meant to signal. Step-up + audit
     remain the actual gates.

## 10. Remaining Risks

- **Initial Upstash request latency** — every middleware-traversed
  API call now waits on a Redis round-trip. Upstash's edge endpoints
  are sub-30 ms typical, but a regional outage degrades request
  latency before degrading the limiter. Mitigation: the existing 60-s
  degraded window collapses subsequent requests onto memory fallback.
- **Per-replica memory drift during degraded window** — accepted for
  `failClosed:false` groups by design (UX > strict counters during a
  brief outage). Auth groups stay strict because they're `failClosed:true`.
- **Proxy header spoofing** — see Scope G above. Documented but not
  code-enforced this phase.
- **Admin login limiter** — uses its own Upstash REST client, not the
  central `rateLimit()`. It already falls back to in-memory on
  failure; it does not currently emit `LIMITER_DEGRADED`. Acceptable
  for now — admin login is rare enough that per-replica drift is not
  a security regression — but a future phase should consolidate it
  onto the central limiter.
- **No automated alert for sustained `LIMITER_DEGRADED`** — events
  log at warn severity and emit through the security-event sink. Ops
  must wire a dashboard / Slack rule on `LIMITER_DEGRADED` for
  paging. Not in scope for this phase.

## 11. Manual Staging Checklist

- [ ] `node -e "for (const k of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN']) console.log(k, Boolean(process.env[k]))"` prints `true true`.
- [ ] `pnpm rate-limit:check` exits `0`, output JSON shows
  `"limiterMode": "distributed"`.
- [ ] Public `/api/health` returns the minimal readiness shape
  `{ status, timestamp, uptimeSec, ready: true }` and does **not**
  include any limiter / Redis / env field.
- [ ] Admin `/api/admin/health` JSON includes
  `"limiter": { ..., "distributedLimiterReachable": true,
  "limiterMode": "distributed" }`.
- [ ] Hit dashboard / provider pages — no false 429 in the network
  tab.
- [ ] Trigger a synthetic Redis outage in a staging-only environment
  (block egress to the Upstash host). Confirm:
  - `LIMITER_DEGRADED` event appears once at transition.
  - No second event for the next 5 minutes.
  - Auth login still fails closed (returns 429 / locked) and
    public_read still serves.
  - Admin health flips `limiter.limiterMode` to `degraded`.
- [ ] Restore egress; first request to a `/api/*` path observes
  recovery; admin health flips back to `distributed`;
  `lastRecoveredAt` populates.
- [ ] Grep production logs for raw Upstash URL / token strings —
  expected zero hits.

## 12. Safety Confirmation

- No provider seed data changes.
- No backup / DR file changes.
- No i18n / theme / logo / Aurora changes.
- No mobile design file changes.
- No auth-threshold changes (existing policy matrix retained verbatim).
- No global tightening of normal app usage.
- No `git add .`; staged paths will be specific to this phase.
- No Redis URL / token / env value printed in any new code path.
- No destructive commands; the connectivity script's only writes are
  to a uniquely-named TTL-bounded probe key it cleans up after itself.
