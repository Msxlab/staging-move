# 04 — API MAP (Route Handler Inventory & Risk Audit)

Area slug: `api-map`
Scope: every web API route (`apps/web/src/app/api`, 171 handlers from `_inventory/web-api.txt`) and admin API route (`apps/admin/src/app/api`, 125 handlers from `_inventory/admin-api.txt`). Evidence is source code only. Rows marked **[NV]** were classified by grep signal but not individually opened (needs verification).

## Authentication / guard model (verified from code)

- **Web user auth**: custom JWT + DB-tracked sessions via `jose`. `requireDbUserId()` / `requireVerifiedUser()` / `getUserSession()` re-exported from `apps/web/src/lib/auth.ts` → `apps/web/src/lib/user-auth.ts`. Throwing `UNAUTHORIZED` → routes map to 401.
- **Workspace scoping / IDOR defense**: `resolveWorkspaceDataScope` + `scopedRecordWhere` / `assertScopedRecordAction` (`apps/web/src/lib/workspace-data-scope.ts`); workspace capability checks via `can(role, action, {status})` from `@locateflow/shared/permissions`. Verified in `addresses/[id]/route.ts`, `workspaces/[id]/transfer/route.ts`, `notifications/feed/[id]/route.ts` (each re-checks `userId`/membership before mutating).
- **Admin auth**: `apps/admin/src/middleware.ts` enforces a global JWT gate (Edge) with a tiny allowlist (`/login`, `/api/auth/login`, `/api/build-info`, `/api/healthz`, `/api/ready`, `/set-password`, `/api/auth/set-password`) + IP rules. Per-route `requireAdmin()` / `requireRole()` / `requirePermission(resource, action, {minimumRole})` re-read role from DB (anti-stale-JWT, `apps/admin/src/lib/auth.ts:347`), fail-closed (`checkPermission` denies when no permission row, `auth.ts:690`). Sensitive ops add `requirePasswordConfirm` step-up (password + MFA/backup code, lockout) — `auth.ts:491`.
- **Cron**: `guardCronRequest` (`apps/web/src/lib/cron-guard.ts`) = `verifyInternalAuth(...,"cron")` (constant-time bearer-secret compare, `internal-secrets.ts:36`) + per-route rate limit (default 10/min, degrades to auth-only when Upstash unconfigured).
- **Internal S2S**: `verifyInternalAuth(...,"internal"|"impersonation"|"backup")` with kind-scoped secrets (`INTERNAL_WEBHOOK_SECRET`, `IMPERSONATION_HANDOFF_SECRET`, `BACKUP_CRON_SECRET`/`CRON_SECRET`).
- **Webhooks**: provider signature verification — Stripe `constructEvent` + livemode + 72h replay window + DB idempotency (`webhooks/stripe/route.ts`); connector/affiliate HMAC-SHA256 timing-safe + idempotency; blog/providers revalidate HMAC + 5-min timestamp window.
- **Validation**: `zod` (`.safeParse`/`.parse`/`.strict()`) is the dominant pattern; shared validators in `apps/web/src/lib/validators.ts` and `packages/shared/src/validators.ts`.
- **Rate limiting**: `rateLimit()` / `getRateLimitKey()` (`apps/web/src/lib/rate-limit.ts`), policy layer `enforceRateLimitPolicy` + login lockout `login-lockout.ts`.

Overall posture: **mature and security-hardened**. The deep-dived high-risk handlers (auth, stripe, webhooks, cron, internal, mobile, admin billing/backup/users/runtime-config) are consistently gated, validated, idempotent, and audited. Findings below are mostly defense-in-depth gaps, not open holes.

---

## WEB API — classification by domain

Legend: Auth (✔ user session / 🔑 secret/HMAC / 🌐 public-no-auth / ⏰ cron). Val = zod/manual. RL = rate limit. **[NV]** = not individually opened.

### auth/* (apps/web/src/app/api/auth)
| Endpoint | Methods | Auth | Validation | RL | Notes |
|---|---|---|---|---|---|
| auth/login | POST | 🌐→session | zod (`password-login.ts:35`) | ✔ lockout + policy | Shared `handlePasswordLogin`; web no bearer in body. |
| mobile/auth/login | POST | 🌐→session | zod (shared) | ✔ same helper | `exposeBearerToken:true`. |
| auth/register | POST | 🌐 | zod | ✔ [NV] | Signups kill-switch in user-auth. |
| auth/forgot-password, password/reset/request, reset-password, resend-verification | POST | 🌐 | zod/manual | ✔ [NV] | Generic responses (no enumeration) pattern used elsewhere. |
| auth/password/reset/confirm, verify-email | POST | token-gated | zod | [NV] | Token-gated. |
| auth/password/change | POST | ✔ | zod | [NV] | |
| auth/me | GET | ✔ | — | n/a | Session read. |
| auth/logout | POST | ✔ | — | n/a | |
| auth/security | GET/POST | ✔ | zod | [NV] | |
| auth/mfa/setup, confirm, disable | POST | ✔ | zod | [NV] | |
| auth/oauth/{google,apple}[/callback], oauth/providers | GET | 🌐/state | manual | [NV] | OAuth state in `oauth.ts`. |
| auth/impersonate-handoff | POST/GET | 🔑 JWT-in-body | zod (`token`) | n/a | Single-use DB row consumed atomically; POST-only token. **Deep-dived — sound.** |

### account/* , workspaces/* (multi-tenant)
| Endpoint | Methods | Auth | Validation | Notes |
|---|---|---|---|---|
| account/delete, account/restore | POST | ✔ | zod [NV] | |
| workspaces (list/create) | GET/POST | ✔ | zod [NV] | |
| workspaces/[id] (+ rename, delete, restore, transfer, sync, managed-sync) | GET/POST/PATCH/DELETE | ✔ + membership/capability + step-up | zod/manual | `transfer` verified: `can(member.role,"member.transferOwner")` + `requireWorkspaceStepUp`. IDOR-safe. |
| workspaces/[id]/members[/...], invitations[/...] | GET/POST/PATCH/DELETE | ✔ + membership | zod [NV] | |

### addresses/*, services/*, custom-providers/*, move-tasks, moving/*, budget/*
| Endpoint | Methods | Auth | Validation | Notes |
|---|---|---|---|---|
| addresses (+ [id], [id]/dossier[/pdf], validate) | GET/POST/PUT/PATCH/DELETE | ✔ + workspace scope | zod (`validators.addressSchema`) | `[id]` verified: scope-filtered budgets/services, CHILD financial redaction → IDOR-safe. |
| services (+ [id]) | GET/POST/PUT/PATCH/DELETE | ✔ + scope | zod [NV] | Sensitive fields encrypted. |
| custom-providers (+ [id]) | GET/POST/PUT/PATCH/DELETE | ✔ + scope | zod [NV] | Duplicate guard. |
| move-tasks | GET/POST/PATCH | ✔ | zod [NV] | |
| moving (+ [id], migration) | GET/POST/PATCH/DELETE | ✔ + scope | zod [NV] | |
| budget (+ actuals) | GET/POST/PUT/PATCH | ✔ | zod [NV] | |

### providers/*, leads, movers/*, partners/*, partner-consents/*
| Endpoint | Methods | Auth | Validation | RL | Notes |
|---|---|---|---|---|---|
| providers (+ [id], compare, popular, recommendations[/feedback], saved) | GET/POST/DELETE | mixed (public read / ✔ write) | zod [NV] | RL on several. |
| providers/revalidate | POST | 🔑 HMAC + 5-min ts | manual | — | **Deep-dived — sound.** |
| leads | POST | ✔ | zod + `consent:literal(true)` | ✔ 10/h | Feature-gated, idempotent. **Deep-dived.** |
| movers (list/click) | GET/POST | ✔ | manual [NV] | [NV] | |
| movers/apply | POST | 🌐 feature-gated | shared `validateMoverApplication` | ✔ per-IP | Multipart, R2 upload, byte-verified content type. **Deep-dived.** |
| movers/portal/{request,logout,placements/request} | POST | 🌐/portal-session | manual [NV] | [NV] | Magic-link portal (`mover-portal-auth.ts`). |
| partners (list), partners/portal/{request,logout,leads-optin} | GET/POST | 🌐/portal-session | manual | ✔ IP+email cap | `portal/request` verified: generic response, dual RL. **Deep-dived.** |
| partner-consents (+ [id], oauth/initiate, oauth/callback) | GET/POST/DELETE | ✔ / oauth-state | zod [NV] | |

### affiliate/*, sponsored/*, acquisition/*, tracking/*, consent/*, blog/*
| Endpoint | Methods | Auth | Validation | RL | Notes |
|---|---|---|---|---|---|
| affiliate/click | POST | 🌐 [NV] | manual [NV] | [NV] | Click beacon. |
| affiliate/postback/[network] | POST | 🔑 HMAC-SHA256 timing-safe | manual | **none** | Idempotent on (network, externalTransactionId). **Deep-dived — see api-map-03.** |
| sponsored/click | POST | ✔ | manual (`placementId` len) | **none** | Best-effort beacon; swallows all errors. |
| acquisition/redeem | POST | ✔ | manual | ✔ 10/min failClosed | Blocks overwrite of managed sub. **Deep-dived.** |
| acquisition/public-trial-campaign | GET | 🌐 [NV] | — | [NV] | Public campaign read. |
| tracking/event, tracking/session | POST | 🌐 consent-gated | manual PII-strip | [NV] | Heavy PII sanitization (`tracking/event`). **Deep-dived.** |
| consent (+ ccpa) | GET/POST | ✔/🌐 [NV] | zod [NV] | [NV] | |
| blog/view | POST | 🌐 | zod | ✔ 60/min | IP-hash dedupe, bot detect. **Deep-dived.** |
| blog/revalidate | POST | 🔑 HMAC + 5-min ts | manual | — | **Deep-dived — sound.** |
| blog/posts (+ [slug]), blog/image, blog/indexnow-key/[key] | GET | 🌐 public read | — | [NV] | |

### internal/*, cron/*, webhooks/*, mobile/*, stripe/*, subscription/*
| Endpoint | Methods | Auth | Validation | RL | Notes |
|---|---|---|---|---|---|
| internal/impersonate | POST | 🔑 `impersonation` secret | zod (`userId`,`adminId`,`ttl≤15`) | — | Mints user JWT; 15-min cap; DB session row. **Deep-dived — sound.** |
| internal/ip-rules | GET | 🔑 `internal` secret | — | — | Middleware cache refresh. **Deep-dived — sound.** |
| internal/rate-limit-log | POST | 🔑 `internal` secret | zod `.strict()` superRefine | — | **Deep-dived — sound.** |
| cron/* (28 routes) | GET/POST | ⏰ `guardCronRequest` | manual | ✔ built-in | All gated by cron-guard. `qa-account-reset` resets QA data — confirm scope [NV]. |
| webhooks/stripe | POST | 🔑 Stripe sig | constructEvent | body-limit 256KB | Livemode guard, 72h replay, DB idempotency, out-of-order guard. **Deep-dived — sound.** |
| webhooks/appstore, playstore, resend | POST | 🔑 provider sig | manual | [NV] | Idempotency ledger. |
| connectors/[key]/webhook | POST | 🔑 per-connector HMAC | manual | — | Feature-gated, circuit/kill-switch aware, idempotent. **Deep-dived — sound.** |
| connector-dispatch, connectors/{catalog,changes} | GET/POST | ✔/🔑 [NV] | manual [NV] | [NV] | |
| mobile/iap/verify | POST | ✔ | zod discriminatedUnion | ✔ IP+user dual | Apple JWS verify + store API; receipt ownership 409. **Deep-dived — sound.** |
| mobile/iap/products | GET | ✔ [NV] | — | [NV] | |
| mobile/auth/{exchange,apple/native} | POST | 🌐→session | zod [NV] | ✔ [NV] | |
| stripe/checkout (+ cancel), stripe/portal | POST | ✔ | zod/manual | ✔ | Managed-sub blocking statuses. [NV-detail] |
| subscription/{actions,change-plan,switch-cycle} | POST | ✔ | zod [NV] | ✔ [NV] | |

### misc public / utility
| Endpoint | Methods | Auth | Notes |
|---|---|---|---|
| health, ready, build-info | GET | 🌐 | Intentional probes. |
| maps/static | GET | ✔ | Auth-gated proxy [NV]. |
| vehicles/decode | POST | ✔ | NHTSA proxy [NV]. |
| address-autocomplete (+ details) | GET/POST | ✔ + cost-controls | **Deep-dived**: `requireDbUserId` + `enforcePlacesCostControls`. |
| push/register | POST | ✔ | zod [NV]. |
| user/{locale,preferences}, profile, onboarding/{progress,briefing}, notifications[/feed[/id], preferences], tickets[/id], help[/feedback], legal/acceptance, unsubscribe, state-rules, invitations/* | various | ✔ (unsubscribe token-gated) | `notifications/feed/[id]` verified owner-check. IDOR-safe sample. |

---

## ADMIN API — classification

All admin routes sit behind the **global middleware JWT gate** (`apps/admin/src/middleware.ts`) except the allowlist (`/api/auth/login`, `/api/build-info`, `/api/healthz`, `/api/ready`, `/api/auth/set-password`) and `/api/internal/*` (secret-gated). Per-route `requirePermission`/`requireRole` add RBAC; sensitive routes add `requirePasswordConfirm` step-up. Grep shows **183 files** referencing an auth guard (incl. tests) across 125 handlers — i.e. effectively all non-public handlers are guarded.

### High-risk admin handlers (deep-dived)
| Endpoint | Methods | Guard | Step-up | Notes |
|---|---|---|---|---|
| backup/sql-dump | POST | `requirePermission("settings","canCreate",{SUPER_ADMIN})` | password + **MFA required** | Crown-jewels mysqldump stream; MYSQL_PWD via env not argv; audited. **Sound.** |
| backup (+ [id]/download, import, retention, verify) | GET/POST | requirePermission/SUPER_ADMIN | step-up (import) | Backup audit trail. [NV-detail on each] |
| users/[id]/impersonate | POST | `requirePermission("users","canUpdate",{SUPER_ADMIN})` | password + MFA | Calls web internal endpoint with handoff secret; notifies user; audited. **Sound.** |
| users/[id]/hard-delete (+ otp) | POST | SUPER_ADMIN | OTP + step-up | RL present; `hard-delete-user.ts`. [NV-detail] |
| users/[id] (+ subscription-actions), users (list/export) | GET/PATCH/DELETE | requirePermission("users",...) | varies | |
| runtime-config | GET/PUT/DELETE | `requireAdmin`/`requirePermission` | password + MFA | zod `.strict()`, SSRF-guarded URL validation, value size cap. **Sound.** |
| subscriptions/[id]/{cancel,change-plan,refund,resync,revalidate,invoices} | POST/GET | requirePermission("subscriptions",...) | varies | `refund`/`cancel` have tests. [NV-detail] |
| security/{route,dashboard,key-rotation} | GET/POST | requirePermission + step-up | key-rotation MFA | RL present. [NV-detail] |
| team (+ [id]) | GET/POST/PATCH/DELETE | SUPER_ADMIN | — | Seeds permission matrix on create. [NV-detail] |
| internal/{ip-rules,security-event} | GET/POST | 🔑 `internal` secret | — | **Sound** (verified security-event). |
| cron/{backup,blog-image-cleanup} | GET/POST | ⏰ cron-secret | — | RL on backup. [NV-detail] |

### Remaining admin domains (classified by grep; [NV] detail)
acquisition-campaigns[/...], affiliate/{conversions,export}, analytics/*, auth/* (login-history, sessions, password, mfa/*, force-password-change, set-password), billing, blog/* (categories, posts[/publish,preview-token], tags, uploads, image), connectors[/...], connector-fallbacks, email-{health,templates}, feature-flags, help-center, logs[/export], movers[/...], moving[/...], notifications, partners[/...], provider-governance[/...], provider-quality, providers[/...] (coverage, logo, bulk, merge, export, needs-logo, coverage-overview), reports, settings, sponsored[/...], state-rules[/...], tickets[/...], waitlist[/export], workspaces[/...] — **all match an auth/permission guard in grep + sit behind middleware JWT gate**. Most are zod-validated; per-route RL is uncommon (mitigated by the auth gate). Individual deep reads pending → **[NV]** for exact method/validation cells.

---

## Findings

### api-map-01 (Medium) — Admin API relies on auth gate without per-route rate limiting
Only 21/125 admin handler files reference `rateLimit` (grep). Sensitive but auth-gated endpoints (e.g. exports, analytics, provider bulk/merge, subscription mutations) have no per-route throttle. A compromised/over-privileged admin session (or step-up-bypassed read endpoints) can be driven in a tight loop against expensive queries/exports. Mitigated by middleware JWT + RBAC + step-up on the most destructive ops, so this is defense-in-depth, not an open hole.
Recommendation: add a lightweight per-admin-session rate limit to expensive read/export endpoints (`users/export`, `affiliate/export`, `providers/export`, `analytics/*`, `logs/export`).

### api-map-02 (Low) — Public state-changing webhook lacks rate limiting (affiliate postback)
`affiliate/postback/[network]/route.ts` is unauthenticated by session and protected only by HMAC + per-secret idempotency upsert. It has no rate limit; an attacker who lacks the secret still triggers DB lookups (provider/click) and a (failed) HMAC compare per request. Signature gate makes write-abuse impractical, but the pre-signature DB work and unbounded request volume is a minor DoS surface.
Recommendation: add an IP-keyed `rateLimit` before the signature check, consistent with other public POSTs (waitlist/blog-view).

### api-map-03 (Low) — `sponsored/click` swallows all errors and has no rate limit
`sponsored/click/route.ts` returns `{ok:true}` on every path including the catch, and applies no rate limit (auth-gated, so abuse is bounded to authenticated users). The blanket catch can mask real failures of `recordSponsoredClick`. Best-effort beacon design is intentional but the silent-success masks observability.
Recommendation: keep best-effort behavior but log failures (Sentry breadcrumb) and add a modest per-user RL.

### api-map-04 (Info) — Broad classification completeness / verification gap
~190 of 296 handlers were classified by grep signal (auth guard present, zod present, RL present) but not individually opened; cells marked **[NV]** reflect this. No unauthenticated state-changing handler, missing-validation handler, or IDOR-prone handler was found among the deep-dived high-risk set; the [NV] routes all match an auth-guard pattern and (admin) sit behind the middleware gate, so residual risk is low but unverified at the per-method level.
Recommendation: a follow-up pass opening each [NV] handler to confirm exact exported verbs, validation location, and (for admin) the specific `resource`/`action` gate.

### api-map-05 (Info) — Schema-compat fallbacks weaken some webhook/session guards during rolling deploys
`webhooks/stripe`, `internal/impersonate`, and `auth/impersonate-handoff` deliberately fall back to unguarded writes when a column is missing (`isMissingDbColumnError` → `warnSchemaCompatibilityFallback`). This is a documented availability trade-off, but during the migration window it drops out-of-order protection / `impersonatedByAdminId` scoping.
Recommendation: ensure migrations land before code that depends on these columns, and alarm on `warnSchemaCompatibilityFallback` so the degraded window is short and observed.
