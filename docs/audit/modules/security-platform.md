# Module Audit: Security Platform (rate-limit, secrets, encryption, cron, kill-switches)

> Scope: defensive read-only audit. Evidence is source code only. Paths are relative to repo root
> `apps/...` / `packages/...` under `C:/Users/Windows/Desktop/Staging/staging-move`.

## 1. Module Summary

The Security Platform module is the cross-cutting enforcement layer that protects every API surface
of the web app (and is partly shared with admin + mobile via `packages/shared`). It comprises:

- **Rate limiting** — `lib/rate-limit.ts` (Upstash Redis sliding-window with in-memory fallback +
  fail-mode contract) and `lib/rate-limit-policy.ts` (per-route-group policy matrix, key strategies,
  enforce/warn/shadow modes, 429 response builder).
- **Client-IP trust** — `lib/client-ip.ts` → `packages/shared/src/trusted-client-ip.ts`
  (`TRUSTED_PROXY_HEADERS` selects which forwarded-IP header family is trusted).
- **Server-to-server auth** — `lib/internal-secrets.ts` (`CRON_SECRET`, `BACKUP_CRON_SECRET`,
  `INTERNAL_WEBHOOK_SECRET`, `IMPERSONATION_HANDOFF_SECRET`; constant-time compare) and
  `lib/cron-guard.ts` (secret + per-route rate limit before any DB/email work).
- **Field encryption** — `packages/shared/src/encryption.ts` (AES-256-GCM, key rotation, backup
  encryption + HMAC) re-exported by `lib/shared-encryption.ts`.
- **Webhook idempotency** — `lib/webhook-idempotency.ts` (reserve-before-act on the
  `ProcessedWebhookEvent` unique key).
- **Security observability** — `lib/security-events.ts` (taxonomy + context redaction),
  `lib/security-alerts.ts` (failed-login / webhook-sig email alarms), `lib/security-alert-sink.ts`
  (burst detection → Sentry/webhook).
- **Operator controls** — `lib/kill-switches.ts` (KILL_SIGNUPS / KILL_OUTBOUND_EMAIL),
  `lib/ip-rules.ts` (edge IP block/allow cache), `lib/global-spend-guard.ts` (daily cost fuse).
- **Audit + redaction** — `lib/audit.ts`, `packages/shared/src/audit-redaction.ts`,
  `packages/shared/src/sentry-redaction.ts`.

Overall the layer is unusually thoughtful: fail-mode semantics are explicit, secrets are
constant-time compared, redaction is deep and whitelist-based, idempotency is reserve-before-act,
and cron routes are uniformly guarded (29/29 non-test `route.ts` call `guardCronRequest`). The
material risks are concentrated in (a) the default client-IP trust mode and its interaction with
every IP-keyed control, (b) the rate-limiter reading Upstash creds from `process.env` only while the
same keys are managed Runtime-Config keys, and (c) a handful of fail-open-by-design choices whose
blast radius depends on deployment configuration.

## 2. Related Files

| File | Role |
|---|---|
| `apps/web/src/lib/rate-limit.ts` | Core limiter, Redis/in-memory, fail-mode, health |
| `apps/web/src/lib/rate-limit-policy.ts` | Policy matrix, key strategies, modes, 429 builder |
| `apps/web/src/lib/client-ip.ts` | Web wrapper over shared IP resolver |
| `packages/shared/src/trusted-client-ip.ts` | Trusted-proxy-header IP resolution |
| `apps/web/src/lib/cron-guard.ts` | Cron secret + per-route rate limit |
| `apps/web/src/lib/internal-secrets.ts` | Shared-secret verify (cron/internal/impersonation/backup) |
| `packages/shared/src/encryption.ts` | AES-256-GCM field/backup encryption, rotation, HMAC |
| `apps/web/src/lib/shared-encryption.ts` | Re-export barrel for encryption |
| `apps/web/src/lib/webhook-idempotency.ts` | Reserve/release webhook event markers |
| `apps/web/src/lib/security-events.ts` | Event taxonomy + `redactContext` |
| `apps/web/src/lib/security-alerts.ts` | Failed-login / webhook-sig email alarms |
| `apps/web/src/lib/security-alert-sink.ts` | Burst detector → Sentry + ops webhook |
| `apps/web/src/lib/kill-switches.ts` | KILL_SIGNUPS / KILL_OUTBOUND_EMAIL |
| `apps/web/src/lib/ip-rules.ts` | Edge IP block/allow in-memory cache |
| `apps/web/src/lib/global-spend-guard.ts` | Daily global spend fuse |
| `apps/web/src/lib/audit.ts` | `createAuditLog` + request meta |
| `packages/shared/src/audit-redaction.ts` | `redactAuditPayload` deep redaction |
| `packages/shared/src/sentry-redaction.ts` | Sentry/GlitchTip PII scrub |
| `apps/web/src/middleware.ts` | Wires IP-rules, rate-limit, CSRF, body-size, CSP |
| `apps/web/src/app/api/cron/**/route.ts` | 29 cron endpoints (all guarded) |
| `apps/web/src/app/api/internal/{ip-rules,impersonate,rate-limit-log}/route.ts` | Internal endpoints |
| `apps/web/src/app/api/{health,ready}/route.ts` | Liveness / readiness probes |

## 3. Related Routes / Screens

No user-facing screens are owned by this module. Affected routes:
- `/api/cron/*` (29 routes) — gated by `guardCronRequest`.
- `/api/internal/{ip-rules,impersonate,rate-limit-log}` — gated by `verifyInternalAuth`.
- `/api/health`, `/api/ready` — unauthenticated probes (by design; no secret values exposed).
- All `/api/*` mutations & reads — pass through `middleware.ts` rate-limit + CSRF + IP-rule layer.
- Auth routes (`/api/auth/login`, register, password reset, MFA, mobile oauth) consume the policy
  matrix in `rate-limit-policy.ts`.

## 4. Related APIs

- `rateLimit(key, config)` / `getRateLimitKey` / `resolveClientIP` (rate-limit.ts).
- `enforceRateLimitPolicy` / `evaluateRateLimitPolicy` / `buildPolicyRateLimitKey` /
  `rateLimitResponseInit` (rate-limit-policy.ts).
- `guardCronRequest` (cron-guard.ts).
- `verifyInternalAuth` / `getInternalCallerSecret` (internal-secrets.ts).
- `encrypt` / `decrypt` / `encryptBackup` / `decryptBackup` / `reEncrypt` / `signBackup` /
  `verifyBackupSignature` / `validateKeyFormat` (encryption.ts).
- `reserveWebhookEvent` / `releaseWebhookEvent` / `markWebhookEventProcessed` (webhook-idempotency.ts).
- `emitSecurityEvent` / `redactContext` / `setSecurityEventSink` (security-events.ts).
- `recordFailedLoginForAlerting` / `alertWebhookSignatureFailure` (security-alerts.ts).
- `areSignupsKilled` / `isOutboundEmailKilled` (kill-switches.ts).
- `checkIPAccess` (ip-rules.ts), `checkGlobalBudget` (global-spend-guard.ts).
- `createAuditLog` / `extractRequestMeta` (audit.ts), `redactAuditPayload` (audit-redaction.ts).

## 5. Related Components

None — this is a server/lib-only module. The closest "component" is `middleware.ts`, which composes
the IP-rule, body-size, CSRF, rate-limit, and session layers in sequence
(`middleware.ts:777-849`).

## 6. Related State / Hooks / Stores

No React state. Module-level in-process state that matters for correctness/security:
- `rate-limit.ts`: `redisLimiters` map, `redisDegradedUntil`, `lastDegraded*` (degrade window).
- `ip-rules.ts`: `cachedRules`, `cacheLoadedAt`, `refreshInFlight` (60s TTL, single-flight).
- `security-alerts.ts`: `memCounters`, `alertedDayKeys` (per-instance fallback counters).
- `security-alert-sink.ts`: `state` map (per-type burst windows), `installed` flag.
- All of the above are **per-instance**; multi-instance deployments dilute every in-memory counter.

## 7. Related Database / Models

- `ProcessedWebhookEvent` (idempotency markers; `id` PK unique, `source`).
- `AuditLog` (`audit.ts` writes redacted `changes`).
- `RateLimitLog` (written by `/api/internal/rate-limit-log`; pruned by `data-retention` cron).
- `IPRule` (read by `/api/internal/ip-rules`; cached by `ip-rules.ts`).
- `UserLoginSession` (impersonation rows written by `/api/internal/impersonate`).
- `EmailLog` (dedupe key drives once-per-day alert semantics in `security-alerts.ts`).
- Runtime Config table (kill switches, spend caps, `TRUSTED_PROXY_HEADERS`, Upstash creds).

## 8. Impact Map

- **UI**: none directly; 429/403 bodies surface to clients (`rateLimitResponseInit`, middleware).
- **API**: every `/api/*` route depends on the middleware rate-limit + IP-rule + CSRF gate.
- **DB**: idempotency, audit, rate-limit-log, IP-rule, impersonation-session writes.
- **Auth**: policy matrix governs login/register/reset/MFA/oauth; internal-secrets gates S2S.
- **Admin**: shares `trusted-client-ip.ts`, `audit-redaction.ts`; impersonation handoff originates
  in admin and is validated by `/api/internal/impersonate`.
- **Mobile**: shares `sentry-redaction.ts`; mobile oauth exchange has its own rate-limit group.
- **Notifications/Email**: KILL_OUTBOUND_EMAIL short-circuits email; alert emails reuse the
  owner-alert plumbing.
- **Integrations**: Stripe/App Store/Play Store/connector webhooks all use the idempotency store and
  `alertWebhookSignatureFailure`.
- **Analytics**: security events are logged structured; burst sink can fan to Sentry/ops webhook.
- **SEO**: unrelated (middleware also stamps noindex, out of scope here).
- **Tests**: substantial unit coverage exists for rate-limit, cron-guard, ip-rules, security-alerts,
  webhook routes; gaps noted in §17.

## 9. Buttons / Actions / Functions

This module has no UI buttons. Below are the security-relevant *functions* as actions.

### `guardCronRequest(request, routeName, options)` — `cron-guard.ts:51`
- **Where used**: all 29 `/api/cron/*` route handlers (verified: 29/29 non-test `route.ts`).
- **Expected**: verify `Authorization: Bearer <CRON_SECRET>` (or `x-cron-secret`), then apply a
  per-route rate limit before any DB/email work.
- **Actual**: matches expected. When Upstash is **not configured at all**, it logs a warn and runs
  with **secret-only** auth (no rate limit) — deliberate fail-open so an unconfigured limiter can't
  take down the whole cron tier (`cron-guard.ts:74-79`). When Upstash **is** configured but erroring,
  the inner `rateLimit(..., failClosed:true)` fails closed (429).
- **Loading/disabled/success/error**: N/A (server). Returns `{ok:true}` or `{ok:false,response}`.
- **Permission check**: yes (`verifyInternalAuth(effective, "cron")`).
- **Edge cases**: caller bucket falls back to literal `"cron"` when IP is `anonymous`
  (`cron-guard.ts:86`) — see SP-05 (all anonymous-IP cron callers share one limiter bucket).

### `verifyInternalAuth(authHeader, kind)` — `internal-secrets.ts:49`
- **Where used**: cron-guard, `/api/internal/{ip-rules,impersonate,rate-limit-log}`.
- **Expected**: constant-time compare of bearer token to the kind-specific secret; only `cron`/`backup`
  fall back to `CRON_SECRET`.
- **Actual**: matches. `safeEqual` short-circuits on length mismatch (`internal-secrets.ts:37`) —
  leaks token *length* equality only, not content; low risk (SP-08).
- **Permission check**: this IS the permission check. Emits `*_SECRET_MISUSE` on mismatch.

### `rateLimit(key, config)` — `rate-limit.ts:230`
- **Expected**: sliding-window limit via Upstash; controlled degrade to in-memory; honor `failClosed`.
- **Actual**: matches the documented contract. Key risk is config sourcing (SP-02) and the per-instance
  in-memory fallback when degraded (SP-06).

### `encrypt/decrypt` — `encryption.ts:38/63`
- **Expected**: AES-256-GCM with random IV, auth tag, prefix-tagged format; throw in prod if key
  missing.
- **Actual**: matches; round-trips correctly because IV+tag are stored. Uses a **16-byte IV** for GCM
  (non-standard; spec/NIST recommend 12) — interop/footgun note, not a break (SP-07).

### `reserveWebhookEvent / markWebhookEventProcessed` — `webhook-idempotency.ts:58/15`
- **Expected**: atomic reserve-before-act; duplicate detection via unique-constraint race.
- **Actual**: correct; all four webhooks (stripe/appstore/playstore/connector) reserve then release on
  failure (verified call sites).

### `checkIPAccess(ip, baseUrl)` — `ip-rules.ts:68`
- **Expected**: block blacklisted IPs, enforce whitelist if any active; 60s TTL cache; fail-open.
- **Actual**: matches. Fail-open by design; depends entirely on a trustworthy `ip` (SP-01).

### Kill switches `areSignupsKilled / isOutboundEmailKilled` — `kill-switches.ts:35/44`
- **Expected**: only literal `"true"` turns ON; failed read = OFF (fail-open).
- **Actual**: matches; intentional fail-open for availability. Authz to flip lives in the admin
  Runtime-Config screen (not in this module) — see SP-09 [needs verification of that screen's RBAC].

## 10. UI/UX Audit

Not applicable — server/lib module with no rendered UI. The only user-visible artifacts are HTTP
error bodies:
- 429 bodies (`rateLimitResponseInit`, `rate-limit-policy.ts:660`) are uniform and localize-neutral
  (English). `exposeHeaders` correctly withheld for auth/sensitive groups so attackers can't time the
  exact threshold (`rate-limit-policy.ts:74`, `:676`). **Good.**
- 403 IP-block body returns `reason` text (`middleware.ts:799`) — generic, no info leak.
- Evidence/impact/recommendation/priority: N/A (no UI findings).

## 11. Logic Audit

- **Expected flow**: middleware runs IP-rule → body-size → CSRF → rate-limit → session, then route
  handlers apply policy-specific limits + secret checks. Confirmed in `middleware.ts:777-849`.
- **Fail-mode correctness**: the tri-state `failClosed` (`true | false | "if-redis-configured"`,
  `rate-limit.ts:97`) is coherent and well-documented; `failClosedWhenUnconfigured` vs
  `failClosedWhenConfiguredErroring` correctly separate "never configured" from "configured but
  erroring" (`rate-limit.ts:196-205`). **Good.**
- **Config-source mismatch (SP-02)**: `hasRedis` is computed once at module load from `process.env`
  (`rate-limit.ts:12-19`). `UPSTASH_REDIS_REST_URL`/`TOKEN` are ALSO managed Runtime-Config keys
  (`runtime-config.ts:949,962`) and `security-alerts.ts` reads them via
  `getRequiredRuntimeConfigValues` (`security-alerts.ts:84`). If an operator provisions Upstash via
  the admin Runtime-Config DB instead of the deploy env, the limiter never sees it → permanent
  in-memory degraded mode, while the alert counters DO use Redis. Inconsistent source of truth.
- **State mismatch (SP-06)**: `redisDegradedUntil`, `memStore`, `memCounters`, burst `state`, and
  `ip-rules` cache are all per-process. On multi-instance deployments, in-memory fallbacks count
  independently, so an attacker spread across instances dilutes both enforcement (when degraded) and
  detection thresholds. Documented in code comments but still a real ceiling.
- **Race conditions**: webhook idempotency is reserve-before-act (race-free at the DB unique key) —
  correct. `ip-rules` uses single-flight refresh — correct. Burst detector is single-threaded JS — no
  data race.
- **Stale/cache risk**: `ip-rules` enforces from a ≤60s-stale snapshot (`ip-rules.ts:36`) — a newly
  written BLACKLIST takes up to 60s + backoff to apply per instance; acceptable and documented.

## 12. Reverse Logic Audit

- **Unauthorized user**: cron/internal routes 401 without a valid secret; idempotency/audit are
  internal-only. Correct.
- **Empty data / missing config**: missing `FIELD_ENCRYPTION_KEY` throws in prod on
  encrypt/decrypt (`encryption.ts:42`, `:69`) — fail-closed for secrecy; returns plaintext in dev.
  Missing Upstash → in-memory limiter (fail-open availability) but cron secret still gates.
- **API error**: Redis errors enter a 60s degrade window and emit `LIMITER_DEGRADED`
  (`rate-limit.ts:123`). Audit/alert/event paths all swallow errors and never throw into the request.
- **Slow network**: health/ready use a 2.5s `withTimeout` (`health/route.ts:9`). Alert webhook uses a
  4s `AbortController` (`security-alert-sink.ts:96`). Good.
- **Double-click / replay**: webhook idempotency is the relevant control; reserve-before-act handles
  concurrent duplicates.
- **Stale data**: ip-rules 60s window (above).
- **Direct route access**: internal/cron routes are **middleware-public by prefix**
  (`middleware.ts:76-86`) and rely entirely on in-route secret checks — see SP-04 (defense-in-depth
  observation): if any future cron/internal route forgets `guardCronRequest`/`verifyInternalAuth`, it
  is exposed with no middleware backstop. Currently all are guarded.
- **Mobile viewport / dark theme**: N/A.
- **Role change / token expiry**: impersonation sessions are hard-capped at 15 min server-side
  (`impersonate/route.ts:32,56`). Good.

## 13. Security Audit

### SP-01 [High] Default `compat` client-IP trust enables IP spoofing of every IP-keyed control
- **Severity**: High (conditional on proxy config) — [needs verification of prod proxy].
- **Affected area**: `packages/shared/src/trusted-client-ip.ts`, `lib/client-ip.ts`, every IP-keyed
  rate-limit group, `checkIPAccess` IP bans, audit `ipAddress`, security-alert IP dimension.
- **Evidence**: In `compat` mode (the default when `TRUSTED_PROXY_HEADERS` is unset —
  `trusted-client-ip.ts:23-27`), the resolver returns
  `cf-connecting-ip || x-real-ip || x-forwarded-for`, taking `value.split(",")[0]` — the **left-most,
  client-controllable** entry (`trusted-client-ip.ts:30-37, 93-98`). `production-readiness.ts:451-456`
  itself warns that unset/compat in production is misconfigured. `.env.example` does not set the var,
  so the default ships as `compat`. (Note: `docker-compose.dokploy.yml:30` defaults it to `standard`,
  which trusts `x-real-ip || x-forwarded-for` left-most — also forgeable if the edge does not strip
  inbound `x-real-ip`.)
- **Risk**: If the production edge does not overwrite/strip these headers, a client can forge its
  apparent IP. This lets an attacker (a) evade an `IPRule` BLACKLIST by rotating a forged IP,
  (b) poison/rotate IP-keyed rate-limit and abuse counters, and (c) frame an innocent IP in audit
  logs and failed-login alerts.
- **Defensive abuse scenario (high-level)**: an attacker repeatedly sends requests with a spoofed
  real-client-IP header to reset their per-IP limiter bucket and slip past an IP ban, while the audit
  trail records a victim address.
- **Prevention**: set `TRUSTED_PROXY_HEADERS` explicitly to the actual edge (`cloudflare` behind CF),
  ensure the edge strips inbound copies of the trusted header, and treat unset/compat as a
  deploy-blocking readiness failure (it is currently only a `warn`, not a `fail` —
  `production-readiness.ts:453`).
- **Detection**: alert on `productionLike` deploys where `TRUSTED_PROXY_HEADERS` is unset/compat;
  compare resolved IP against the platform's authenticated client-IP header.
- **Analysis (root cause)**: a "compat/legacy precedence" default chosen for backward compatibility
  is, by definition, the least-safe option, and it is the value that ships.
- **Recommendation**: promote the readiness check from `warn` to `fail` for production-like envs and
  document the required edge-strip behavior; default `.env.example` to the real edge.
- **Tests to add**: spoofed `x-forwarded-for`/`x-real-ip` does not change the resolved IP when
  `TRUSTED_PROXY_HEADERS` is set to the platform header; a forged header cannot bypass `checkIPAccess`.

### SP-02 [Medium] Rate limiter reads Upstash creds from `process.env` only, while they are managed Runtime-Config keys
- **Severity**: Medium.
- **Affected area**: `lib/rate-limit.ts:12-19`, `:42-47`; contrast `security-alerts.ts:82-97`.
- **Evidence**: `redisUrl`/`redisToken` come from `process.env` and `hasRedis` is frozen at module
  load. `UPSTASH_REDIS_REST_URL`/`TOKEN` are declared managed Runtime-Config keys
  (`runtime-config.ts:949,962`) and the security-alerts module resolves them via
  `getRequiredRuntimeConfigValues`. The two layers can disagree on whether Redis is configured.
- **Risk**: operator configures Upstash through the admin Runtime-Config screen (a supported path for
  managed keys) but the distributed rate limiter silently never uses it — production runs on the
  per-instance in-memory limiter (weaker, multi-instance-dilutable) while `/api/health` may still
  report `productionEnvOk` based only on env. Enforcement is quietly degraded.
- **Defensive abuse scenario**: with the limiter on the in-memory fallback, a distributed
  brute-force/credential-stuffing campaign across instances faces a much higher effective ceiling than
  intended.
- **Prevention**: read Upstash creds through the same runtime-config resolver the rest of the platform
  uses, or document loudly that these two keys are **env-only for the limiter** and make readiness
  fail if they are set in Runtime-Config but absent from env.
- **Detection**: `getLimiterHealth().limiterMode === "memory"` in a production env should page.
- **Analysis (root cause)**: limiter must be edge/synchronous-init friendly, so it took the simplest
  env read; the platform later made the same keys runtime-managed without reconciling.
- **Recommendation**: surface a readiness `fail` when env Upstash is missing in production-like envs
  regardless of Runtime-Config presence; unify the source of truth.
- **Tests to add**: health reports `memory` when env creds absent even if runtime-config has them.

### SP-03 [Medium] Multiple fail-open controls compound when Redis/config is unavailable
- **Severity**: Medium.
- **Affected area**: `cron-guard.ts:74-79`, `ip-rules.ts` (fail-open), `global-spend-guard.ts:62,84`,
  `kill-switches.ts:25-27`, in-memory limiter fallback.
- **Evidence**: cron-guard drops the rate limit when Upstash is unconfigured; ip-rules fail open on
  refresh error; spend-guard fails open on limiter/config error (`global-spend-guard.ts:84`); kill
  switches read OFF on config-read failure (`kill-switches.ts:26`).
- **Risk**: a single dependency outage (Upstash and/or Runtime-Config DB) simultaneously removes cron
  rate limiting, IP-ban enforcement freshness, the spend fuse, and (if the operator was mid-incident)
  the ability for a *failed* config read to keep a kill switch ON. Each choice is individually
  defensible (availability over strictness), but they share failure domains.
- **Defensive abuse scenario**: during a Runtime-Config DB blip an operator who just enabled
  KILL_SIGNUPS sees signups resume, while cron endpoints simultaneously lose their leaked-secret rate
  cap.
- **Prevention**: document the combined fail-open envelope; for kill switches consider a cached
  last-known value so a transient read failure does not silently re-open signups.
- **Detection**: emit a single high-severity event when >1 of these controls degrade in the same
  window.
- **Analysis**: independent modules each optimized for availability; no cross-module fail-state view.
- **Recommendation**: add a degraded-controls aggregate to `/api/ready`.
- **Tests to add**: kill-switch returns last-known ON when the config read throws (if adopted).

### SP-04 [Low] internal/cron/webhook routes are middleware-public by prefix (no middleware auth backstop)
- **Severity**: Low (currently fully mitigated in-route).
- **Affected area**: `middleware.ts:76-86` (`PUBLIC_API_PREFIXES` includes `/api/internal/`,
  `/api/cron/`, `/api/webhooks/`), and the CSRF/rate-limit skips for those prefixes
  (`middleware.ts:196-198, 305, 320`).
- **Evidence**: these prefixes bypass middleware session auth and rely entirely on in-route
  `verifyInternalAuth` / `guardCronRequest` / provider signature checks. All 29 cron and 3 internal
  routes currently implement their check (verified).
- **Risk**: a future route added under these prefixes that forgets the in-route guard is exposed with
  zero middleware backstop. This is a latent footgun, not a present vulnerability.
- **Prevention**: add a defense-in-depth middleware assertion that any `/api/cron/`|`/api/internal/`
  request carries *some* bearer credential before reaching the handler (cheap, no secret compare).
- **Detection**: a lint/test that asserts every file under those dirs imports the guard.
- **Analysis**: by-prefix public-listing is convenient but couples correctness to per-route discipline.
- **Recommendation**: add the import-presence test in §17.
- **Tests to add**: AST/grep test asserting guard usage per route file.

### SP-05 [Low] Anonymous-IP callers collapse into shared limiter buckets
- **Severity**: Low.
- **Affected area**: `cron-guard.ts:86` (`callerBucket = "cron"` when IP is `anonymous`);
  `rate-limit-policy.ts:389` (IP hash of `"anonymous"` is a constant); `ip-rules.ts:76`
  (anonymous never matches a rule).
- **Evidence**: when no trusted IP header is present, every caller resolves to `"anonymous"`, so all
  such callers share one rate-limit bucket and can never be IP-banned.
- **Risk**: in a deploy where the trusted header is frequently absent (misconfig), legitimate traffic
  shares a single bucket (false-positive 429s) and IP bans are unenforceable for those requests.
- **Prevention**: depends on SP-01 fix (correct trusted header) so `anonymous` is rare.
- **Detection**: monitor the share of requests resolving to `anonymous`.
- **Recommendation**: alert when `anonymous` exceeds a small fraction of traffic.
- **Tests to add**: covered indirectly by SP-01 tests.

### SP-06 [Low] Per-instance in-memory counters dilute enforcement & detection at scale
- **Severity**: Low (documented design limit).
- **Affected area**: `rate-limit.ts:56` (`memStore`), `security-alerts.ts:119` (`memCounters`),
  `security-alert-sink.ts:52` (`state`).
- **Evidence**: all fallbacks are `Map`s in module scope; comments acknowledge the multi-instance
  caveat (`security-alerts.ts:35-38`). When Redis is degraded/unconfigured these are the only counters.
- **Risk**: thresholds (lockout-adjacent alarms, burst detection, rate limits) must be crossed on a
  single instance, so horizontal scaling weakens them proportionally.
- **Recommendation**: keep Redis healthy (SP-02) so the in-memory path is genuinely exceptional;
  treat `limiterMode==="memory"` in prod as a paging condition.

### SP-07 [Info] AES-256-GCM uses a 16-byte IV (non-standard; 12 recommended)
- **Severity**: Info.
- **Affected area**: `packages/shared/src/encryption.ts:13` (`IV_LENGTH = 16`), used at `:48`, `:114`,
  `:176`.
- **Evidence**: GCM's standard/NIST-recommended nonce is 96 bits (12 bytes); a 16-byte IV forces an
  internal GHASH derivation. Node accepts it and the code stores+reuses the IV for decryption, so
  round-trips are correct and IVs are random per message (`randomBytes`), so there is no nonce-reuse
  break. Purely an interoperability/standards footgun.
- **Risk**: none observed in-app; would matter only if ciphertext must interoperate with a strict
  12-byte-IV implementation.
- **Recommendation**: prefer 12-byte IV for new versions (`enc_v2:`) behind a version-aware decrypt;
  no migration needed for existing data given the stored-IV format.

### SP-08 [Info] `safeEqual` length pre-check leaks token-length equality
- **Severity**: Info.
- **Affected area**: `internal-secrets.ts:37-43`; same pattern in `encryption.ts:213` and
  `rate-limit-policy` hash (not secret-bearing).
- **Evidence**: `if (a.length !== b.length) return false;` before the constant-time loop reveals
  whether the supplied token length matches the secret length via timing/branch.
- **Risk**: marginal — secrets are high-entropy and ≥32 chars per `.env.example`; length oracle alone
  is not practically exploitable.
- **Recommendation**: acceptable as-is; if hardening, compare against a fixed-length HMAC of both
  inputs.

### SP-09 [Info] Kill-switch authorization lives outside this module [needs verification]
- **Severity**: Info — [needs verification].
- **Affected area**: `kill-switches.ts` reads the values; the authz to *set* them is in the admin
  Runtime-Config screen/API, not audited here.
- **Evidence**: `kill-switches.ts:24-27` only reads `getRuntimeConfigValue`. Who may write
  `KILL_SIGNUPS` / `KILL_OUTBOUND_EMAIL` is enforced by the admin Runtime-Config route (out of scope).
- **Risk**: if that write path is under-protected, an attacker could pause signups or silence all
  outbound email (incl. security alert emails). Cannot confirm from this module's code.
- **Recommendation**: confirm the admin Runtime-Config write route requires SUPER_ADMIN + step-up +
  audit for these specific keys.

### Items checked and found OK
- **Secret logging**: `redactContext` (security-events.ts) and `redactAuditPayload`
  (audit-redaction.ts) deny-list passwords/tokens/secrets/DB+Redis URLs and PII; `safeReason`
  (rate-limit.ts:111) scrubs URLs/Bearer/long-tokens from limiter error reasons; `scrubText`
  (sentry-redaction.ts:47) scrubs free-text emails/Bearer/tokens. Strong coverage.
- **Webhook idempotency**: reserve-before-act, scoped by `source`, released on failure — race-safe.
- **CSRF**: middleware enforces same-origin + content-type for mutations (`middleware.ts:192-299`).
- **Constant-time compare**: used for secrets and HMAC verification.
- **Encryption prod-fail-closed**: refuses to store/return plaintext in production when key missing.
- **Impersonation**: 15-min hard cap, kind-specific secret (no CRON_SECRET fallback), audited row.

## 14. Performance Audit

- **Redundant calls**: middleware can issue 2 Redis round-trips per request when
  `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED` is on (`middleware.ts:426-442`) — gated off by default,
  acknowledged.
- **N+1 / DB**: idempotency does a single `findUnique`/`create`; audit a single `create`; no N+1.
- **Caching**: ip-rules single-flight + 60s TTL avoids a per-request DB/internal hit — good.
- **Limiter map reuse**: `redisLimiters` caches `Ratelimit` instances per `(limit:window)` — good.
- **Hot-path allocation**: `redactContext`/`redactAuditPayload` walk objects with depth/key caps
  (6/50/100) — bounded.
- **Mobile perf**: N/A.
- No material performance issues found.

## 15. Reliability Audit

- **Error boundaries**: every observability path swallows errors and never throws into the request
  (`security-events.ts:209`, `security-alerts.ts:325`, `audit.ts:31`, `security-alert-sink.ts:128`).
- **Retry**: webhook idempotency release enables provider retries; ip-rules backs off 15s after a
  failed refresh.
- **Offline/slow**: timeouts on health/ready and the alert webhook.
- **Transaction consistency**: idempotency reserve-before-act is the consistency primitive; Stripe
  releases the marker on failure (`webhooks/stripe/route.ts:1320`).
- **Partial failure**: alert dispatch marks the day key only after a delivery succeeds/dedupes
  (`security-alerts.ts:243`) so transport failures retry next event.
- **Monitoring/logging**: `getLimiterHealth()` exposes mode/degrade timestamps; `LIMITER_DEGRADED`
  events emitted; burst sink → Sentry/webhook. **Gap**: `limiterMode==="memory"` in prod is not itself
  an automatic alert (SP-02/SP-06).

## 16. Dead Code / Cleanup

- `getRateLimitKey` (rate-limit.ts:326) is documented as backing the *legacy* per-user write limiter.
  It is referenced by tests; whether any live route still calls it is **[needs verification]** — grep
  the route tree before removing.
- `encryptBackup`/`decryptBackup`/`signBackup`/`verifyBackupSignature`/`reEncrypt` are
  rotation/backup helpers; used by the admin backup flow (out of this module's scope) — do **not**
  assume unused.
- `__reset*ForTests` helpers (rate-limit, ip-rules, security-alerts, security-alert-sink) are
  test-only and intentionally not barrel-exported — fine.
- No confirmed dead code within the audited files.

## 17. Tests

- **Existing** (observed): `rate-limit.*`/`rate-limit-policy` (referenced via `__reset` helpers),
  `cron-guard.test.ts`, `ip-rules` reset helper, `security-alerts` reset helper,
  `connectors/[key]/webhook/route.test.ts` (asserts reserve/release semantics), numerous
  `cron/*/route.test.ts`.
- **Missing / suggested**:
  - **SP-01**: unit test that a forged `x-forwarded-for`/`x-real-ip` does not move the resolved IP when
    `TRUSTED_PROXY_HEADERS` is set to the platform header; integration test that `checkIPAccess` cannot
    be bypassed by header spoofing.
  - **SP-02**: `getLimiterHealth()` returns `memory` when env Upstash creds are absent even if
    Runtime-Config has them; readiness `fail` in that case.
  - **SP-04**: AST/grep test asserting every `app/api/cron/**/route.ts` calls `guardCronRequest` and
    every `app/api/internal/**/route.ts` calls `verifyInternalAuth`.
  - **Encryption**: tampered auth tag / truncated payload throws in prod; `reEncrypt` rejects bad old
    key; `validateKeyFormat` rejects non-hex/short keys (asserted indirectly by `getKey`).
  - **Redaction**: property test that no key matching the deny-list survives `redactContext` /
    `redactAuditPayload` at depth.
  - **Idempotency**: concurrent duplicate deliveries — exactly one `reserved`, all others `duplicate`.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|---|---|---|---|---|---|---|
| security-platform-01 | High | Security | Default `compat` client-IP trust takes left-most forwarded header → IP spoofing of every IP-keyed control | Evade IP bans, poison rate-limit/abuse counters, frame victim IPs in audit/alerts | Set `TRUSTED_PROXY_HEADERS` to real edge; make unset/compat a readiness FAIL in prod; ensure edge strips inbound header | `packages/shared/src/trusted-client-ip.ts:23-37,93-98`, `lib/client-ip.ts:12-18`, `lib/production-readiness.ts:451-456`, `middleware.ts:792` |
| security-platform-02 | Medium | Architecture | Limiter reads Upstash creds from `process.env` only while same keys are managed Runtime-Config keys | Operator-set Upstash via admin DB never used → permanent in-memory limiter, weaker enforcement | Unify source of truth or readiness-FAIL when env creds missing in prod | `lib/rate-limit.ts:12-19`, `runtime-config.ts:949,962`, `security-alerts.ts:82-97` |
| security-platform-03 | Medium | Reliability | Several controls fail-open and share a Redis/Runtime-Config failure domain | One dependency outage drops cron rate cap, IP-ban freshness, spend fuse; kill-switch read-fail re-opens signups | Cache last-known kill-switch value; aggregate degraded-controls into `/api/ready` | `cron-guard.ts:74-79`, `ip-rules.ts`, `global-spend-guard.ts:62,84`, `kill-switches.ts:25-27` |
| security-platform-04 | Low | Security | internal/cron/webhook prefixes are middleware-public; only in-route guards protect them | A future route missing its guard is exposed with no backstop (all current routes OK) | Add cheap middleware credential-presence assertion + per-file guard test | `middleware.ts:76-86,196-198,305,320` |
| security-platform-05 | Low | Logic | Anonymous-IP callers share one limiter bucket and are unbannable | False-positive 429s + unenforceable bans when trusted header absent | Fix via SP-01; alert on high `anonymous` share | `cron-guard.ts:86`, `rate-limit-policy.ts:389`, `ip-rules.ts:76` |
| security-platform-06 | Low | Reliability | Per-instance in-memory counters dilute limits/detection on multi-instance deploys | Thresholds must be crossed on one instance; scaling weakens them | Keep Redis healthy; page on `limiterMode==="memory"` in prod | `rate-limit.ts:56`, `security-alerts.ts:119`, `security-alert-sink.ts:52` |
| security-platform-07 | Info | Security | AES-256-GCM uses 16-byte IV (12 recommended) | No in-app break (IV stored, random); interop footgun only | Use 12-byte IV in a future `enc_v2:` with version-aware decrypt | `packages/shared/src/encryption.ts:13,48,114,176` |
| security-platform-08 | Info | Security | `safeEqual` length pre-check leaks token-length equality | Marginal; high-entropy ≥32-char secrets | Acceptable; optionally HMAC-compare fixed-length | `internal-secrets.ts:37-43`, `encryption.ts:213` |
| security-platform-09 | Info | Security | Kill-switch write-path authz is outside this module [needs verification] | If under-protected, attacker could pause signups / silence alert emails | Confirm admin Runtime-Config write requires SUPER_ADMIN + step-up + audit for these keys | `kill-switches.ts:24-27` |

## 19. Module TODO

- [ ] **SP-01 (High)** — Harden client-IP trust. *Reason*: default compat trusts client-forgeable
  header. *Files*: `trusted-client-ip.ts`, `client-ip.ts`, `production-readiness.ts:451-456`,
  `.env.example`. *Fix*: set explicit edge mode, promote readiness `warn`→`fail` in prod, document
  edge header-strip. *Dependencies*: knowledge of the prod edge (CF/DO). *Complexity*: low.
  *Risk of change*: medium (could 403 legit traffic if edge assumption wrong — verify first).
- [ ] **SP-02 (Medium)** — Reconcile Upstash config source. *Reason*: limiter env-only vs managed
  Runtime-Config keys. *Files*: `rate-limit.ts:12-19`, `runtime-config.ts:949,962`. *Fix*: readiness
  FAIL when env creds absent in prod; or unify resolver. *Dependencies*: none. *Complexity*: low/med.
  *Risk*: low.
- [ ] **SP-03 (Medium)** — Add degraded-controls visibility + last-known kill-switch cache. *Files*:
  `kill-switches.ts`, `/api/ready`. *Complexity*: med. *Risk*: low/med.
- [ ] **SP-04 (Low)** — Per-file guard test + optional middleware credential-presence backstop for
  cron/internal. *Files*: `middleware.ts`, new test. *Complexity*: low. *Risk*: low.
- [ ] **SP-05 (Low)** — Alert on high `anonymous`-IP share (resolved largely by SP-01). *Complexity*:
  low. *Risk*: low.
- [ ] **SP-06 (Low)** — Page when `limiterMode==="memory"` in production. *Files*: alerting config.
  *Complexity*: low. *Risk*: low.
- [ ] **SP-07 (Info)** — Adopt 12-byte IV for a future encryption version. *Files*: `encryption.ts`.
  *Complexity*: med. *Risk*: med (version-aware decrypt; keep old path).
- [ ] **SP-09 (Info)** — Verify admin Runtime-Config write authz for kill-switch keys. *Complexity*:
  low (verification). *Risk*: n/a.
