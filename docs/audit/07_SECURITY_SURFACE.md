# 07 — Security Surface (LocateFlow monorepo)

Area slug: `security-surface`. Read-only audit. Evidence is source code only.
Scope: end-user web app (`apps/web`), admin app (`apps/admin`), shared package
(`packages/shared`). This is a *map* of the security surface with systemic gaps;
per-route deep bugs come from the module audits.

---

## 1. Authentication model

### 1.1 End-user auth — `apps/web/src/lib/user-auth.ts`
- **Scheme:** custom JWT via `jose`, HS256, signed with `USER_JWT_SECRET`
  (`createUserSession` L253-300). Secret is validated to be ≥32 chars at use
  (`user-jwt-secret.ts` L5-10). Token is **both** signed (stateless verify) and
  backed by a DB row `UserLoginSession` keyed on `tokenHash`
  (SHA-256 of the JWT, L279-291) — so logout / revocation works server-side.
- **Transport:** web uses an httpOnly cookie `user_session` (`sessionCookieBaseOptions`
  L200-207: `httpOnly`, `secure` env-gated, `sameSite: "lax"`, `path:/`); mobile uses
  `Authorization: Bearer`. Both candidate sources are collected and tried in
  `readTokenCandidatesFromRequest` (L405-441).
- **Claims:** `userId`, `email`, optional `fp` + `fpMode`, `impersonatedByAdminId`
  (`UserSessionClaims` L46-57).
- **Expiry:** 30 days (`SESSION_TTL_DAYS` L31); enforced both in the JWT
  (`setExpirationTime`) and against `expiresAt` on the DB row (L632-638). No refresh
  token; re-login re-mints.
- **Validation path** (`getUserSession` L469-690): JWT verify → DB row active →
  `record.userId === jwt.userId` → email claim present → fingerprint → DB row not
  expired → canonical user exists & not soft-deleted. Failure invalidates the DB
  row and clears the cookie. Structured diagnostics throughout.
- **Fingerprint:** web is **UA-only** (`generateFingerprint` L86-91 ignores IP by
  design — documented rationale: residential IP churn), mobile is UA-minus-version
  (`generateMobileFingerprint` L114-118). Legacy IP-bound and version-bound
  fingerprints are accepted as transition fallbacks (L586-616). The fingerprint
  is therefore a **weak** anti-replay control on web: any party who replays the
  cookie with the same User-Agent string passes the `fp` check. The httpOnly +
  SameSite=lax cookie is the real protection; `fp` only catches gross device
  swaps. This is an accepted trade-off but it means a stolen cookie is replayable
  from any host as long as the UA matches (see SS-04).

### 1.2 Admin auth — `apps/admin/src/lib/auth.ts` + `apps/admin/src/middleware.ts`
- Separate secret `ADMIN_JWT_SECRET` (≥32 chars, enforced at module load in
  middleware L13-16 and in `getAdminJwtSecret` L21-27) and a **separate cookie**
  `admin_session` with `sameSite: "strict"` (stricter than the user app's `lax`).
- DB-backed `AdminSession` row, tokenHash-indexed, with `isActive`/`expiresAt`
  (`getSession` L230-298). TTL default 30 days, overridable.
- **Stronger fingerprint than the user app:** `generateAdminSessionFingerprint`
  binds a coarse IP bucket (/24 v4, /64 v6) + UA + accept-language + sec-ch-ua
  (auth.ts L128-135; validated in middleware L766-792 with a `SESSION_HIJACK_ATTEMPT`
  security event on mismatch and cookie expiry).
- **MFA gate:** roles returned by `adminRoleRequiresMfa` are funneled to the MFA
  setup surface until enrolled (middleware L729-763); `requireRole` re-checks
  `mfaEnabled` against the DB (auth.ts L358-360), so a stale JWT cannot bypass it.
- **Forced password rotation:** `mcp` claim restricts an invited admin to the
  rotation surface (middleware L704-727).
- **Step-up:** `requirePasswordConfirm` (auth.ts L491-650) re-verifies password
  (and optionally TOTP/backup code) with a distributed failure-lockout
  (8 failures / 5 min → 5 min lockout), grace caching, and audit on every
  outcome. Backup-code consumption is atomic via a conditional `updateMany`
  guarded on the prior JSON value (L609-613) — no double-spend.

**Separation is clean:** distinct secrets, distinct cookies, distinct sameSite,
distinct middleware. No shared trust between the two apps' sessions.

---

## 2. Authorization

### 2.1 Workspace data scoping — `apps/web/src/lib/workspace-data-scope.ts`, `workspace-context.ts`
- `requireWorkspaceContext` (workspace-context.ts L149-225) is the single entry
  that: verifies session → resolves requested workspace (header `X-Workspace-Id`
  → cookie `lf_workspace_id`, validated against `ID_RE` L101) → checks membership →
  **fails closed on non-ACTIVE/OVERFLOW status** (L191-193, allow-list not
  denylist) → loads owner-resolved entitlement.
- `scopedRecordWhere` / `recordBelongsToScope` / `assertScopedRecordAction`
  enforce that a record's `workspaceId` (or `userId` in legacy mode) matches the
  resolved scope, returning NOT_FOUND on mismatch (data-scope L82-133).
- **Gated by `WORKSPACE_MODEL_ENABLED`** (default OFF — `isWorkspaceModelEnabled`
  L96-99). When off, every route falls back to `legacyDataScope(userId)`
  (data-scope L24-33, L44) — i.e. plain per-user `userId` scoping. The systemic
  observation: the entire workspace RBAC layer is **inert in production unless the
  flag is on**, and correctness of multi-tenant isolation in the live config rests
  on each route consistently scoping by `userId`. That per-route discipline is
  outside this surface map — flag for the API/module audits (SS-05).

### 2.2 RBAC — `packages/shared/src/permissions.ts`
- Pure `can(role, action, ctx)` matrix is the single source of truth for workspace
  roles (OWNER/ADMIN/MEMBER/CHILD/VIEW_ONLY). Fails closed (`default: return false`
  L167-168). SUSPENDED/OVERFLOW clamped to read-only (L76). Sensitive-field
  visibility, self-only mutation for MEMBER/CHILD, owner-only billing/transfer are
  all encoded. Looks coherent and least-privilege.
- Admin RBAC is a separate hierarchy (`requireRole`/`checkPermission` in admin
  auth.ts L347-709). `checkPermission` **fails closed** — any admin without an
  explicit permission row is denied, except SUPER_ADMIN which short-circuits to
  allow (L690-709). Role is always re-read from DB, never trusted from the JWT
  (L350-361) — defends against stale-claim privilege escalation.

### 2.3 Plan limits / entitlements
- Entitlement is resolved from the **owner's** subscription
  (`resolveConsumerEntitlement(ownerSub)` workspace-context L201-202), so seat/plan
  gating is owner-scoped, not per-member. `planLimitScopeForDataScope` carries the
  owner id (data-scope L76-80). Enforcement of specific limits lives in
  `lib/plan-limits.ts` / `api-gates.ts` (out of scope here; flag to billing audit).

---

## 3. Middleware responsibilities

### 3.1 Web `apps/web/src/middleware.ts` (853 lines)
Order of operations (`middleware` L777-849): IP allow/deny → body-size →
CSRF → rate-limit → public-API check or session check → page public/redirect →
security headers on every response.
- **Route matching:** `PUBLIC_PATHS`, `PUBLIC_API_PREFIXES/EXACT/GET` (L26-126),
  matched via exact / child-prefix (`matchesPathOrChild` L128). Note: many
  internal/cron/webhook prefixes are *public* at the middleware layer
  (`PUBLIC_API_PREFIXES` L76-86) and rely entirely on **in-route** secret checks.
- **CSP:** per-request 128-bit nonce (`generateCspNonce` L691-700), `script-src`
  drops `unsafe-inline` and uses `'nonce' + 'strict-dynamic'` (L702-709).
  **`style-src` keeps `'unsafe-inline'`** (L714) — accepted for hydration inline
  styles but weakens CSS-injection defence-in-depth. `img-src` is broad `https:`
  (L729, justified for CDNs). `object-src 'none'`, `frame-ancestors 'none'`,
  `base-uri 'self'`, `form-action 'self'` are set.
- **Security headers** (`applySecurityHeaders` L756-774): HSTS (2yr, preload),
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. **No
  `X-Frame-Options`** on the user app (relies on CSP `frame-ancestors 'none'` —
  acceptable for modern browsers; legacy browsers unprotected). The admin app
  *does* set `X-Frame-Options: DENY` on hardened responses (admin L248).
- **Edge auth is JWT-signature-only** (`hasValidSession` L575-607) — no DB, no
  expiry-vs-DB, no fingerprint. The middleware comment (L578-582) states DB/fp
  checks run in-route via `requireDbUserId()`. So **middleware is a coarse gate;
  authorization correctness depends on every protected route calling the in-route
  guards.** A route that is non-public but forgets `requireDbUserId`/scope would be
  reachable by anyone with a *syntactically valid, signature-valid* JWT even if the
  session was revoked in the DB. Flag to API audit (SS-05).

### 3.2 Admin `apps/admin/src/middleware.ts` (810 lines)
- Similar pipeline plus: **break-glass IP bypass** for `/login`, `/api/auth/login`,
  health (L61-70, L636-651) so a self-locked SUPER_ADMIN can recover — logged as
  `IP_RULE_BYPASSED_FOR_BREAK_GLASS`. Good.
- CSP **does not** use `strict-dynamic` (removed deliberately, L194-206) and
  `frame-src 'none'`, `X-Robots-Tag: noindex` on every response (L257). Stricter
  than the user app, appropriate for an admin console.
- Admin middleware **does** enforce fingerprint, MFA-setup gate, and forced-rotation
  gate at the edge from JWT claims (no DB on edge). `isActive` is enforced in-route
  by `requireAdmin`.
- **Admin rate limiter is bespoke** (in-file Upstash REST + in-memory fallback,
  L431-587), separate from the user app's `@upstash/ratelimit`. Two independent
  limiter implementations = duplicated fail-open/closed logic to keep in sync
  (SS-06, Info).

---

## 4. Rate limiting — `apps/web/src/lib/rate-limit.ts`, `rate-limit-policy.ts`, admin middleware
- Upstash Redis sliding-window with in-memory fallback (`rateLimit` L230-287).
- **Fail modes** are explicit (L83-205): `true` = fail closed always; `false` =
  fail open; `"if-redis-configured"` = closed only when Redis configured-but-erroring.
- **In-memory fallback is per-process.** On a multi-instance deploy without Redis,
  each instance keeps its own counter, so the effective limit is `limit × instances`
  and resets on redeploy. `getLimiterHealth().productionEnvOk` flags this
  (L407-408) but it does not *enforce*; a production deploy that loses Redis
  silently degrades to weak per-instance limits unless a `failClosed:true` policy
  is in play (SS-03).
- Cron pre-limit in middleware keys on a **hash of the presented credential**
  (L320-348) so an anonymous flood can't starve the scheduler — a real fix to a
  prior global-bucket DoS. Internal routes get a flat 60/min (L351-369).
- IP-vs-user keying: per-user write limits key on `userId` when available
  (`getRateLimitKey` L326-337) so IP rotation can't reset them. A shadow user-keyed
  counter exists but is **off by default** (middleware L22-23, L426-442).

---

## 5. Secrets handling — `apps/web/src/lib/internal-secrets.ts`, `env-catalog.ts`
- Four distinct server-to-server secret kinds: `cron`, `backup`, `internal`,
  `impersonation` (`InternalSecretKind` L9). `verifyInternalAuth` uses
  **constant-time comparison** (`safeEqual` L36-43) and is Edge-safe. CRON_SECRET
  is accepted only for `cron`/`backup`, never broadened into `internal`/
  `impersonation` (L67-72) — boundaries are kept distinct.
- Misuse emits `CRON_SECRET_MISUSE` / `INTERNAL_SECRET_MISUSE` security events
  (L13-25), with a deliberate no-emit on missing header to avoid noise.
- JWT secrets validated ≥32 chars at use (user) / module-load (admin).
- `env-catalog` (re-exported from shared) provides an EXPECTED-ENV catalog and
  `evaluateEnvReadiness`/`buildEnvReadinessWarnings` — but this is a **readiness
  reporting** surface, not a hard boot gate. There is no evidence in this surface
  that a missing `INTERNAL_WEBHOOK_SECRET` / `IMPERSONATION_HANDOFF_SECRET` *halts
  boot*; `getInternalCallerSecret` simply returns `undefined` and
  `verifyInternalAuth` returns false (deny). So a missing internal secret
  fails *closed* for verification (good) but the *caller* (admin app emitting a
  security event in `emitSecurityEvent`, admin middleware L95-96) silently no-ops
  when its secret is unset — security events would be dropped (SS-07, [needs
  verification] on which callers depend on it).

---

## 6. Encryption — `packages/shared/src/encryption.ts` (+ `shared-encryption.ts` re-export)
- AES-256-GCM, `enc_v1:<iv>:<ct>:<tag>` format, 256-bit key from
  `FIELD_ENCRYPTION_KEY` (64-hex). Key format strictly validated (`validateKeyFormat`
  L190-192) — rejects non-hex to avoid silent short keys.
- **Fails closed in production:** `encrypt`/`decrypt` throw if the key is missing in
  production (L42-44, L69-72) — refuses to store plaintext or return ciphertext it
  can't read. In dev it degrades to plaintext (clearly logged).
- HMAC-SHA256 backup signing with **constant-time** verify (`verifyBackupSignature`
  L208-219). Key rotation via `reEncrypt` (L154-185).
- **Observation:** the HMAC backup signing key is the *same* `FIELD_ENCRYPTION_KEY`
  used for AES (`signBackup` L198-201). Reusing one key for both confidentiality
  and integrity is a minor key-hygiene smell, not a break given GCM already
  authenticates field data; backup HMAC is a separate construction. Info-level
  (SS-08).

---

## 7. Webhook verification & idempotency
- **Stripe** (`api/webhooks/stripe/route.ts`): `stripe.webhooks.constructEvent`
  with `STRIPE_WEBHOOK_SECRET` (L612), missing-signature → 400 (L583-584),
  failure emits `WEBHOOK_SIG_FAILURE` + operator alert + 400 (L618-636). Livemode
  mismatch rejected (L640). **Replay window 72h** (L651-656) matched to Stripe's
  retry horizon. **Reserve-before-act idempotency:** `markWebhookEventProcessed`
  reserves the event id atomically (unique PK) *before* side-effects (L664-667);
  on processing failure the reservation is **released** so Stripe retries
  (L1316-1322). This is the correct race-free pattern.
- **Apple App Store** (`api/webhooks/appstore/route.ts`): verifies Apple JWS chain
  locally (`verifyAppleJws`), per-route 64KB body cap (L44-78), `reserveWebhookEvent`
  /`releaseWebhookEvent` idempotency on `notificationUUID`.
- `webhook-idempotency.ts` is sound (reserve/release pair, source-scoped so one
  provider can't release another's marker, L35-70).
- **Gap:** middleware exempts `/api/webhooks/*` from CSRF, rate-limit, and the
  global body-size limit (web middleware L198, L305, L162 path-prefix). Each
  webhook route therefore must re-impose its own body ceiling. Stripe + Appstore
  do; the **other webhook routes (`playstore`, `resend`) were not inspected in
  this surface pass** — flag to integrations audit that every `/api/webhooks/*`
  route caps body size and verifies a signature (SS-09, [needs verification]).

---

## 8. Cron / internal endpoint protection
- `guardCronRequest` (`cron-guard.ts`) = `verifyInternalAuth(...,"cron")` +
  per-route rate limit. **Degradation contract:** if the distributed limiter is
  *unconfigured*, it proceeds with secret-auth only (warns) rather than 429-ing the
  whole cron tier; if configured-but-erroring it fails closed (L67-95). Correct.
- Internal endpoints (`/api/internal/*`) are middleware-public and verified
  in-route. `impersonate` requires `IMPERSONATION_HANDOFF_SECRET` (route L43-45),
  validates body with zod, caps TTL at 15 min server-side (L32, L56), checks the
  target user is not soft-deleted, and signs an `fp`-less single-use JWT relying on
  `expiresAt` + DB row (L66-70). Strong.
- **Systemic note:** because middleware treats `/api/internal/`, `/api/cron/`,
  `/api/webhooks/` as public, the *only* thing standing between the internet and
  these routes is the in-route secret/signature check. Any newly added route under
  these prefixes that forgets its guard is exposed by default (fail-open by
  omission). This is an architecture risk worth a lint/guard test (SS-02).

---

## 9. PII handling & log redaction
- `audit-redaction.ts` (`redactAuditPayload`) — recursive key-based redaction with a
  broad sensitive-key set including PII (email, phone, address parts, lat/long, ssn,
  taxId) *and* secrets; depth/size caps prevent log blowups; `preservePaths` lets
  admin audit keep forensic `actor.email`/`actor.role`. Used by `createAuditLog`
  (audit.ts L17-19).
- `sentry-redaction.ts` — cross-runtime (web + mobile) scrubber: key-based
  `scrubObject` + free-text `scrubText` (emails, Bearer tokens, 32+ char token runs).
- **Gap:** redaction is **key-name based**. Values placed under non-sensitive key
  names (e.g. a free-text `description`/`reason`/`message` carrying an email or
  token) are only caught in Sentry's `scrubText`, *not* in `redactAuditPayload`
  (which truncates but does not value-scrub strings — `truncateString` L112-115).
  So audit-log free-text fields can persist PII verbatim. Medium (SS-01).
- Limiter/error reasons are scrubbed of URLs/Bearer/long-ids before logging
  (`safeReason` rate-limit L111-121; `sanitizeLimiterReason` admin L455-462). Good.

---

## 10. CSRF posture
- Web (`applyCsrfCheck` middleware L192-299): enforces JSON/multipart Content-Type
  on mutations, then a layered origin check (`sec-fetch-site` same-origin/none pass;
  else `Origin` must equal `req.nextUrl.origin`; else `Referer` origin must match).
  Exemptions: `/api/internal/`, `/api/cron/`, `/api/webhooks/`, `/api/unsubscribe`,
  OAuth callbacks (cross-site `form_post`), and a narrow mobile-bearer-logout path.
  SameSite=lax cookie is the backstop. Reasonable for an API with no anti-CSRF
  token; the Content-Type + Origin/Referer + SameSite triad is the standard
  token-less defence.
- **Gap / sharp edge:** the origin allow-list is `req.nextUrl.origin` (L264). Behind
  a proxy that rewrites Host, `nextUrl.origin` may not equal the public origin,
  causing either false 403s or, if `Origin`/`Referer` are both absent on a
  cross-site request, the check **falls through to allow** (L260-262 short-circuit
  on `sec-fetch-site: none`, and L277 only checks Referer when Origin is absent).
  An attacker-controlled client can omit `Origin` and set `sec-fetch-site: none`
  is not settable cross-site by browsers — so browser-driven CSRF is blocked, but
  **non-browser clients are not the CSRF threat model anyway.** Net: acceptable,
  but the dependence on `nextUrl.origin` correctness behind proxies is worth a
  [needs verification] (SS-10, Low). Admin app hardens this with a multi-candidate
  `getAllowedOrigins` (admin L139-148).

## 11. Open-redirect handling — `apps/web/src/lib/safe-redirect.ts`
- `normalizeAppRedirectPath` strips control chars, decodes once, rejects
  non-`/`-leading, `//`-leading (protocol-relative), backslash, and `/api`/`/auth`
  targets, and **allow-lists** a fixed prefix set (L1-51). Returns `/dashboard`
  fallback otherwise. This is a correct, allow-list-based open-redirect guard.
- The sign-in redirect param is set by middleware (L846-847) from `pathname`
  (server-trusted, not user input) — low risk. **[needs verification]:** confirm
  every consumer of a `?redirect=` query value (sign-in page, post-auth-redirect.ts)
  routes it through `normalizeAppRedirectPath` rather than using it raw (SS-11).

---

## 12. Client-IP trust model — `client-ip.ts` / `trusted-client-ip.ts`
- `TRUSTED_PROXY_HEADERS` selects which forwarding header family is trusted:
  `none`/`vercel`/`cloudflare`/`standard`/`compat`. **Default is `compat`**
  (L22-27), which trusts `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for`
  first value (L93-98).
- The web middleware comment (L786-791) claims it resolves "the TRUSTED proxy hop
  rather than the left-most x-forwarded-for entry." That is true only when
  `TRUSTED_PROXY_HEADERS` is set to a specific deployment shape. **In the default
  `compat` mode, `cf-connecting-ip`/`x-real-ip` are honored first** — if the deploy
  is *not* actually behind a proxy that strips/sets these, a client can forge them
  to spoof its IP, poisoning IP-keyed rate-limits/abuse counters and evading
  `checkIPAccess` IP bans. Whether this is exploitable depends entirely on the
  production proxy config. **High-if-misconfigured, [needs verification]** (SS-04).

---

## Systemic gaps summary
See findings SS-01 … SS-11 in the returned object. The strongest systemic themes:
1. **Fail-open-by-omission at the prefix boundary** (internal/cron/webhook routes
   are middleware-public; only in-route guards protect them) — SS-02.
2. **Middleware edge-auth is signature-only**; revoked/expired-in-DB sessions and
   workspace scoping depend on each route calling the in-route guards — SS-05.
3. **Client-IP trust defaults to a permissive `compat` mode** that can honor
   client-suppliable headers — SS-04.
4. **Audit free-text fields are not value-scrubbed for PII** — SS-01.
5. **Rate-limit in-memory fallback is per-process** and silently weak without
   Redis — SS-03.
