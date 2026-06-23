# Module Audit: Partners, Affiliate & Movers Portal

> READ-ONLY audit. Evidence is source code only. Paths are relative to repo root
> `apps/web` unless otherwise noted. Items that could not be fully confirmed from
> code are marked **[needs verification]**.

## 1. Module Summary

This module covers the partner / affiliate / mover acquisition surfaces:

- **Generic Partners (cleaning/junk)** — public self-service application
  (`/api/partners`), magic-link self-service portal (`partner-portal-auth.ts`,
  `/partners/portal`), and a lead-delivery opt-in toggle.
- **Movers (FMCSA household-goods carriers)** — public application with document
  upload (`/api/movers/apply`), a public read-only directory (`/api/movers`,
  plan-gated `moverSuggestions`), a magic-link mover portal
  (`mover-portal-auth.ts`, `/movers/portal`), and self-serve sponsored-placement
  requests.
- **Leads** — authenticated consumers submit moving/cleaning/junk quote requests
  (`/api/leads`), PII is encrypted at rest, matched partners/movers are fanned
  out as `LeadDispatch` outbox rows and emailed by a cron worker
  (`leads/dispatch-leads.ts`), with per-lead CPL billing accrual
  (`leads/billing.ts`).
- **Affiliate** — outbound click tracking (`/api/affiliate/click`) and a
  server-to-server HMAC-authenticated conversion postback
  (`/api/affiliate/postback/[network]`).
- **Acquisition campaigns** — public offer view models + a redeem endpoint
  (`/api/acquisition/redeem`) that grants FREE_ACCESS subscriptions; campaign
  copy/price sync lives in a build script (`scripts/lib/acquisition-campaign-sync.ts`).
- **Partner consents (OAuth connectors)** — per-user OAuth grants to external
  partners (`partner-consents/*`), with token encryption + refresh.
- **Sponsored placements** — admin-managed paid placements surfaced in the mover
  directory with fire-and-forget impression/click counters.

Overall the code is unusually defensive and well-annotated. Portal auth is fully
separated from consumer JWT auth (distinct cookies + token tables). The findings
below are mostly Low/Info hardening items; there are **no Critical findings** and
the two notable items concern affiliate attribution integrity and stale internal
documentation.

## 2. Related Files

Lib:
- `src/lib/partner-portal-auth.ts` — partner magic-link session
- `src/lib/mover-portal-auth.ts` — mover magic-link session
- `src/lib/movers.ts` — FMCSA directory query + ranking + sponsored slot/counters
- `src/lib/acquisition-campaigns.ts` — campaign view models, redemption snapshots
- `src/lib/partner-consent-refresh.ts` — OAuth token refresh for a consent
- `src/lib/leads/create-lead.ts` — create + fan out a lead (PII encrypted)
- `src/lib/leads/dispatch-leads.ts` — outbox worker emailing matched partners
- `src/lib/leads/billing.ts` — CPL accrual ledger
- `src/lib/leads/match-partners.ts`, `src/lib/leads/match-movers.ts` — routing
- `scripts/lib/acquisition-campaign-sync.ts` — campaign price/copy sync (build script)

API routes:
- `api/partners/route.ts`, `api/partners/portal/{request,leads-optin,logout}/route.ts`
- `api/movers/route.ts`, `api/movers/apply/route.ts`, `api/movers/portal/{request,logout,placements/request}/route.ts`
- `api/affiliate/click/route.ts`, `api/affiliate/postback/[network]/route.ts`
- `api/leads/route.ts`
- `api/acquisition/{redeem,public-trial-campaign}/route.ts`
- `api/sponsored/click/route.ts`
- `api/partner-consents/route.ts`, `api/partner-consents/[id]/route.ts`,
  `api/partner-consents/oauth/{initiate,callback}/route.ts`
- `api/cron/partner-consents/[id]/refresh/route.ts`

Pages/route handlers:
- `app/partners/{apply,portal}/...`, `app/partners/portal/enter/route.ts`
- `app/movers/{apply,portal}/...`, `app/movers/portal/enter/route.ts`

Models (`packages/db/prisma/schema.prisma`): `Partner`, `PartnerPortalToken`,
`PartnerDocument`, `PartnerConsent`, `PartnerLedgerEntry`, `MoverApplication`,
`MoverDocument`, `MoverPortalToken`, `MovingCompany`, `SponsoredPlacement`,
`Lead`, `LeadDispatch`, `AffiliateClick`, `AffiliateConversion`,
`AcquisitionCampaign`, `AcquisitionRedemption`.

## 3. Related Routes / Screens

| Route | Type | Auth |
|---|---|---|
| `/partners/apply` | page | public (flag-gated form) |
| `/partners/portal` | page | partner magic-link cookie |
| `/partners/portal/enter` | route handler | token in query |
| `/movers/apply` | page | public (flag-gated form) |
| `/movers/portal` | page | mover magic-link cookie |
| `/movers/portal/enter` | route handler | token in query |
| `/movers/portal/dashboard` | page | mover session |
| `/movers/portal/placements` | page | mover session |

## 4. Related APIs

See section 2. Auth posture:
- Consumer-auth (JWT `getUserSession`/`requireDbUserId`): `/api/leads`,
  `/api/affiliate/click`, `/api/movers` (GET/POST), `/api/sponsored/click`,
  `/api/acquisition/redeem`, all `/api/partner-consents/*` (per-user).
- Portal-cookie auth (magic link): `/api/partners/portal/{leads-optin,logout}`,
  `/api/movers/portal/{logout,placements/request}`.
- HMAC server-to-server: `/api/affiliate/postback/[network]`.
- Internal/cron secret: `/api/cron/partner-consents/[id]/refresh`.
- Unauthenticated public intake (rate-limited + flag-gated):
  `/api/partners`, `/api/movers/apply`, `/api/partners/portal/request`,
  `/api/movers/portal/request`, `/api/acquisition/public-trial-campaign`.

## 5. Related Components

`components/partners/partner-portal-request-form`,
`components/movers/{mover-apply-form,mover-placement-request}` (referenced by the
pages; not deep-read in this pass — **[needs verification]** for client-side
validation parity).

## 6. Related State / Hooks / Stores

Portal sessions are cookie-based and resolved server-side on each request
(`getPartnerPortalSession`, `getMoverPortalSession`). No client store. Forms are
native HTML `method="post"` with 303 redirects (progressive enhancement; works
without JS).

## 7. Related Database / Models

All models reviewed in `schema.prisma`. Notable integrity controls confirmed in
code:
- `AcquisitionRedemption @@unique([userId, campaignId])` (line ~387) — DB-enforced
  single redemption per user+campaign.
- `AffiliateConversion @@unique([network, externalTransactionId])` — idempotent
  postback.
- `Lead.idempotencyKey @unique`, `LeadDispatch.idempotencyKey @unique`,
  `PartnerLedgerEntry.leadDispatchId @unique` — dedupe / single-charge.
- Portal token tables store only `tokenHash` (sha256), never the raw token.

## 8. Impact Map

- **UI**: partner/mover portals, apply forms, mover directory cards, lead-optin toggle.
- **API**: see section 4.
- **DB**: 17 models above.
- **Auth**: three separate auth schemes (consumer JWT, portal magic-link cookie,
  HMAC postback) plus cron secret — cleanly separated.
- **Admin**: applications create PENDING rows for the admin verification queue;
  sponsored placements + campaign edits are admin-managed (out of this scope).
- **Mobile**: not directly — these are web surfaces. Lead/affiliate flows are
  web-only. **[needs verification]** whether mobile surfaces the mover directory.
- **Notifications**: admin alert emails (apply), partner lead emails (dispatch),
  magic-link emails (portal), placement-request emails.
- **Integrations**: Stripe (campaign price IDs, dormant partner billing), R2
  (mover doc upload), connector OAuth partners (partner-consents), affiliate
  networks (postback).
- **Analytics**: affiliate click/conversion, sponsored impressions/clicks.
- **SEO**: portals are `robots: noindex`; apply pages are indexable marketing.
- **Tests**: route tests exist for partners, leads, affiliate click/postback,
  movers, acquisition redeem, partner-consents OAuth, and lib helpers.

## 9. Buttons / Actions / Functions

**Partner apply (`POST /api/partners`)** — public. Flag `partner_registration_v1`
(fail-closed → 404). Rate-limited 5/h per IP. Zod-validated; `consent` and
`attestation` are `z.literal(true)`. Creates PENDING `Partner` with
`leadsOptIn = consent`. Success → `{ ok, id }` 201. Admin email best-effort. No
loading/disabled/error UI examined here (server route). Edge: duplicate company
applications are not deduped (allowed — admin queue handles it).

**Mover apply (`POST /api/movers/apply`)** — public, multipart. Gate
`MOVER_REGISTRATION_ENABLED`. Rate-limited 5/h per IP. Validates body size,
per-file size (≤10MB), count (≤8), declared vs **byte-detected** content type
(magic-byte sniff). Files → R2 best-effort; application is source of truth.
Edge: a partial upload failure still returns 201 with `documentsUploaded < n`.

**Mover directory (`GET /api/movers`)** — consumer JWT. Plan-gated
(`moverSuggestions`); ungated returns `entitled:false` + upgrade flag (never 403).
Caps at 10 rows. Sponsored slot only when `SPONSORED_ENABLED`. Impression counter
fire-and-forget.

**Sponsored click beacon (`POST /api/movers`, `POST /api/sponsored/click`)** —
consumer JWT; always 204/`{ok:true}`; validates `placementId` length ≤30; counter
fire-and-forget. No error contract by design (avoids leaking placement existence).

**Lead submit (`POST /api/leads`)** — consumer JWT. Flag-gated per category
(fail-closed → 404). Rate-limited 10/h per user. Zod; `consent: z.literal(true)`.
Idempotency key derived from user+detail fields. PII encrypted. Returns
`leadId`, `matchedCount`.

**Lead-optin toggle (`POST /api/partners/portal/leads-optin`)** — partner portal
session. Form POST + 303 redirect. Updates `Partner.leadsOptIn`. No CSRF token but
state-changing — see SEC-04.

**Portal magic-link request (`POST /api/{partners,movers}/portal/request`)** —
public. Rate-limited per IP (6/h) **and** per email (4/h). Always returns generic
success (no account enumeration). Sends link only on a real match.

**Portal enter (`GET /{partners,movers}/portal/enter`)** — consumes token, sets
httpOnly cookie, redirects. Token in URL — see SEC-03.

**Portal logout (`POST /api/{partners,movers}/portal/logout`)** — revokes token,
clears cookie, 303.

**Placement request (`POST /api/movers/portal/placements/request`)** — mover
session. Validates state + duration (30/60/90). Re-checks live eligibility
(active + HHG + complaint ≤10). Emails ops. No DB write (manual setup).

**Acquisition redeem (`POST /api/acquisition/redeem`)** — consumer JWT.
Rate-limited 10/min (fail-closed). Blocks redemption when a real Stripe/IAP paid
sub is live. `newUsersOnly` + per-(user,campaign) guard + transactional cap
enforcement + P2002 race handling.

**Affiliate click (`POST /api/affiliate/click`)** — consumer JWT. Rate-limited
30/min per user (fail-closed). Redirect target read from DB only (no open
redirect). Validates HTTPS affiliate URL. 30-min dedupe window. Address attributed
only if owned.

**Affiliate postback (`POST /api/affiliate/postback/[network]`)** — HMAC. Idempotent
upsert. See SEC-02 (click/provider cross-attribution).

**Partner-consent OAuth initiate/callback/revoke** — consumer JWT + workspace
scope + plan entitlement. State+PKCE cookies. Revoke scoped by `userId` (no IDOR).

## 10. UI/UX Audit

- **UX-01 (Low)** — Partner portal lead-optin toggle is a bare form button with
  no loading/disabled state; a double submit posts twice. Evidence:
  `app/partners/portal/page.tsx:99-107` (plain `<form>`/`<button>`, no client
  guard). Impact: cosmetic double-POST; idempotent server update so low risk.
  Recommendation: add `disabled`/pending UI or accept as progressive-enhancement.
  Priority: Low.
- **UX-02 (Low)** — Partner portal has no "sponsored placement" or self-serve
  controls that the mover portal has; partners only see leads. Evidence: compare
  `app/partners/portal/page.tsx` vs `app/movers/portal/dashboard/page.tsx`.
  Impact: feature asymmetry (likely intentional). Priority: Info.
- **UX-03 (Low)** — Mover directory rows expose `complaintCount2y` which `movers.ts`
  documents as `0` when no enrichment exists; the comment says the UI "must treat
  0 as check the official record." Evidence: `lib/movers.ts:13-19`. **[needs
  verification]** that the card component renders that disclaimer (component not
  read). Priority: Low (honest-data / UX correctness).

## 11. Logic Audit

- Lead fan-out re-checks partner APPROVED status **at send time**
  (`dispatch-leads.ts:183-194`) — correct: PII is not delivered to a partner that
  was de-authorized after the lead was queued.
- CPL billing only accrues on a **real** send success and is idempotent on
  `leadDispatchId` (`billing.ts:48-64`); fail-safe (no rate → no charge).
- Redeem transaction enforces the campaign cap with a conditional `updateMany`
  inside the tx and rolls back on `count===0` (`acquisition/redeem/route.ts:207-235`)
  — concurrency-safe.
- Portal sessions are invalidated when the partner loses APPROVED status / the
  company goes inactive (`partner-portal-auth.ts:95-98`,
  `mover-portal-auth.ts:116-119`) — correct revocation semantics.
- **LOGIC-01 (Low/Info)** — `acquisition/redeem/route.ts:83-101` comment claims the
  schema "has no unique index on (userId, campaignId) yet" and that full
  idempotency "awaits a `@@unique([userId, campaignId])` migration," but the
  schema **already has** `@@unique([userId, campaignId])`
  (`schema.prisma:~387`) and the catch handles `P2002`. The guard is correct; the
  comment is stale and misleading. Recommendation: update the comment.

## 12. Reverse Logic Audit

- **Unauthorized user**: all state-changing routes gate on a session/secret;
  portal routes redirect to sign-in on no session. Verified.
- **Empty data**: portal pages render empty states ("No leads yet"). Verified.
- **API error**: public intake routes swallow downstream email/upload failures and
  still succeed (application is source of truth). Verified.
- **Slow network / double-click**: leads + redeem + affiliate-click are idempotent
  / deduped server-side. Portal optin toggle is idempotent. OK.
- **Direct route access**: `/movers/portal/dashboard` and `/placements` redirect
  to `/movers/portal` without a session. Verified.
- **Token expiry / revocation**: portal token TTL 24h; revoked on logout; checked
  per request. Verified.
- **Role change**: APPROVED→REJECTED invalidates the next portal request. Verified.
- **Dark theme / mobile viewport**: pages use semantic `text-foreground` /
  `bg-card` tokens and responsive `max-w-*`/grid utilities — theme-safe. No
  hardcoded hex except `text-white` on the orange CTA
  (`movers/portal/dashboard/page.tsx:106`) which is intentional on a colored
  button. Low concern.

## 13. Security Audit

### SEC-01 (Info) — Portal auth correctly separated from consumer auth
- **Severity**: Info (positive finding).
- **Affected Area**: `partner-portal-auth.ts`, `mover-portal-auth.ts`.
- **Evidence**: Portal sessions use dedicated cookies (`partner_portal`,
  `mover_portal`) and dedicated hashed-token tables; consumer routes use
  `getUserSession`/`requireDbUserId` (JWT). No route mixes the two.
- **Risk**: none observed — documented as confirmation that a consumer JWT cannot
  authenticate a portal action and vice-versa.
- **Detection**: add a test asserting a consumer cookie does not grant portal access.

### SEC-02 (Low) — Affiliate postback can cross-attribute a conversion to a provider that does not own the echoed click
- **Severity**: Low.
- **Affected Area**: `api/affiliate/postback/[network]/route.ts:67-86`.
- **Evidence**: When both `clickId` and `providerId` are supplied, the code sets
  `affiliateClickId = click.id` but only overrides `providerId` from the click
  when `providerId` is empty (`if (!providerId) providerId = click.providerId`).
  There is no check that `click.providerId === providerId`. The conversion is then
  written with the caller-supplied `providerId` while linked to a click belonging
  to a different provider.
- **Risk**: A conversion row could link a click for provider A to a payout
  attributed to provider B, corrupting per-provider EPC / revenue attribution.
- **Defensive Abuse Scenario (high-level)**: a compromised or buggy affiliate
  network integration that echoes mismatched ids inflates one provider's
  conversion attribution while consuming another's click — purely a data-integrity
  distortion in internal reporting; it is gated behind a valid HMAC (trusted
  partner), so this is not an external attack path.
- **Prevention**: when both ids are present, reject (400) or drop the
  `affiliateClickId` link if `click.providerId !== providerId`.
- **Detection**: a reconciliation query for conversions whose
  `affiliateClick.providerId != providerId`.
- **Analysis (root cause)**: precedence logic favors the explicit `providerId`
  without a consistency check against the resolved click.
- **Recommendation**: add the equality guard; prefer the click's provider as the
  source of truth when a click resolves.
- **Tests To Add**: postback with `clickId` of provider X and `providerId` of
  provider Y → assert mismatch is rejected or link dropped.

### SEC-03 (Low) — Portal magic-link token travels in the URL query string
- **Severity**: Low.
- **Affected Area**: `app/{partners,movers}/portal/enter/route.ts`,
  `api/{partners,movers}/portal/request/route.ts` (link built with `?token=`).
- **Evidence**: `enter/route.ts:11` reads `searchParams.get("token")`; the request
  route emails `/.../enter?token=<raw>`.
- **Risk**: tokens in URLs can leak via referrer headers, browser history, server
  access logs, or shared links. Mitigations already present: token is exchanged for
  an httpOnly cookie on first use, single active token per partner (prior tokens
  pruned on re-request), 24h TTL, and the link is same-origin (low referrer-leak
  surface). The token is **not** single-use, so a leaked link remains valid until
  expiry/logout.
- **Defensive Abuse Scenario (high-level)**: an attacker who obtains the emailed
  link (forwarded email, shared history) can open the portal as the partner until
  the token expires or is superseded.
- **Prevention**: consider single-use consumption on `enter` (issue a fresh
  session token and revoke the link token), and/or shorter link TTL distinct from
  the session TTL.
- **Detection**: alert on multiple distinct IPs/user-agents using the same token.
- **Analysis (root cause)**: by-design magic-link UX trades single-use for "the
  token IS the session" simplicity (documented in the lib header).
- **Recommendation**: split the link token (single-use, short TTL) from the
  session token established by `consume*Token`.
- **Tests To Add**: assert a token is invalidated after first `enter` consumption
  once single-use is adopted.

### SEC-04 (Low) — Portal mutation routes rely on SameSite=Lax instead of a CSRF token
- **Severity**: Low.
- **Affected Area**: `api/partners/portal/leads-optin/route.ts`,
  `api/{partners,movers}/portal/logout/route.ts`,
  `api/movers/portal/placements/request/route.ts`.
- **Evidence**: portal cookies are `sameSite:"lax"` (`partner-portal-auth.ts:22-28`).
  The optin/logout routes are plain form POSTs with no anti-CSRF token.
- **Risk**: SameSite=Lax blocks cross-site cookie attachment on top-level
  cross-site POSTs in modern browsers, so practical CSRF is largely mitigated, but
  there is no defense-in-depth token. The highest-impact action (optin toggle /
  logout) is low-value; `placements/request` reads JSON (not a simple form) which
  further reduces classic CSRF feasibility.
- **Defensive Abuse Scenario (high-level)**: on a browser with weak SameSite
  enforcement, a forged cross-site form could toggle a partner's lead opt-in.
- **Prevention**: add an origin/referer check or a per-session CSRF token to portal
  mutations.
- **Detection**: log+alert on portal mutations whose `Origin` is not same-site.
- **Analysis**: relies solely on cookie SameSite.
- **Recommendation**: add an `Origin`/`Sec-Fetch-Site` check to portal POSTs.
- **Tests To Add**: portal POST with a cross-site `Origin` header → 403.

### SEC-05 (Info) — Lead route rate limit is fail-open (no `failClosed`)
- **Severity**: Info.
- **Affected Area**: `api/leads/route.ts:41-47`.
- **Evidence**: `rateLimit(..., { limit: 10, windowSeconds: 3600 })` with no
  `failClosed`; affiliate-click and redeem use `failClosed: true`. If Upstash is
  unconfigured the limiter falls back to an in-memory store (`rate-limit.ts:49-63`),
  so single-instance deployments still bound abuse but multi-instance does not.
- **Risk**: under a Redis outage, an authenticated user could exceed the intended
  lead-submission cap on multi-instance deployments, fanning PII to partners and
  accruing CPL.
- **Prevention**: pass `failClosed: true` (or `"if-redis-configured"`) on the lead
  limiter to match the redeem/affiliate posture.
- **Detection**: limiter-degraded health metric already exists (`getLimiterHealth`).
- **Analysis**: inconsistent fail-mode across acquisition routes.
- **Recommendation**: align the lead limiter fail-mode with the billing-sensitive
  routes.
- **Tests To Add**: simulate limiter failure → assert deny on the leads route.

### SEC-06 (Info) — Lead-dispatch partner email renders contact fields with a hand-rolled escaper
- **Severity**: Info.
- **Affected Area**: `lib/leads/dispatch-leads.ts:54-118`.
- **Evidence**: `esc()` escapes `<>&` only (not quotes), and values are inserted in
  HTML text positions (table cells), not attributes — so the escaper is adequate
  for the current template. Notes/name/email are user-controlled but escaped.
- **Risk**: low; would become a stored-HTML-injection risk only if a value were
  ever moved into an attribute context without quote-escaping.
- **Prevention**: keep all interpolation in text nodes, or switch to the shared
  email renderer's escaping.
- **Detection**: template review on change.
- **Recommendation**: note for future maintainers; no change required now.
- **Tests To Add**: snapshot test with `<script>`/`"` in notes asserting escaped output.

### SEC-07 (Info) — No IDOR/auth-bypass found in partner-consents or portal data reads
- **Severity**: Info (positive).
- **Evidence**: `revokeConsent` scopes by `{ id, userId }`
  (`connector-oauth.ts:377-381`); `GET /api/partner-consents` filters by
  `session.userId` and never returns the encrypted token; portal pages query by the
  session's `partnerId`/`movingCompanyId`. Cron refresh is gated by internal secret
  (`cron-guard.ts`).
- **Recommendation**: keep regression tests for the userId scoping.

## 14. Performance Audit

- Mover directory over-fetches a 50-row candidate pool then ranks in memory and
  slices to ≤10 (`movers.ts:148-159`) — bounded, fine.
- Lead matching loads all APPROVED+opted-in partners/movers into memory and filters
  by state in JS (`match-movers.ts:52-63`, `match-partners.ts:69-74`). Documented as
  acceptable while the approved set is small; **could become O(n) hot** if the
  approved partner count grows large (no state index used). **PERF-01 (Low)** —
  add a state-scoped query or index when the approved set grows.
- Sponsored counters and lead delivery are fire-and-forget / outbox-batched — no
  user-path latency.
- Portal `enter` and session resolution do 1–2 indexed lookups per request — fine.
- Redeem runs inside a single transaction — fine.
- No obvious N+1; `Promise.all` used for the portal dashboards.

## 15. Reliability Audit

- Lead dispatch is a proper transactional outbox: atomic claim
  (QUEUED→DISPATCHING), stale-claim requeue sweep, bounded retries with backoff,
  terminal states, idempotent email dedupe (`dispatch-leads.ts`). Strong.
- Decrypt-failure is fail-closed (no empty email, no charge)
  (`dispatch-leads.ts:206-216`). Strong.
- Mover apply tolerates partial R2 upload failure without rolling back the
  application. Acceptable; **REL-01 (Low)**: a fully-failed upload set yields a
  PENDING application with zero proof docs and only a `console.error` — consider a
  surfaced admin signal when `documentsUploaded === 0` but files were attached.
- Public intake routes return generic 500 copy on unexpected errors; no error
  boundary needed (route handlers).
- Logging: errors are `console.error` (no PII logged in the paths reviewed — lead
  PII is never logged; only ids). Good. **[needs verification]** central log
  aggregation behavior.

## 16. Dead Code / Cleanup

- **DEAD-01 (Info)** — `lib/movers.ts:33` `protectYourMoveLink(_usdotNumber)`
  ignores its argument and returns a constant search URL (documented: no per-company
  deep link exists). Not dead, but the parameter is currently unused by design;
  keep as a forward-compat seam.
- **DEAD-02 (Info)** — `acquisition/redeem/route.ts:83-101` stale comment (see
  LOGIC-01) is documentation debt, not dead code.
- No abandoned routes/components confirmed unused in this pass. The partner portal
  lacks a placements feature that movers have, but that is an intentional product
  difference, not dead code. **[needs verification]** that
  `components/partners/partner-portal-request-form` and the mover form/placement
  components are all referenced (referenced by the pages read).

## 17. Tests

Existing (co-located `*.test.ts`): `partners/route.test.ts`,
`partners/portal/leads-optin/route.test.ts`, `affiliate/click/route.test.ts`,
`affiliate/postback/[network]/route.test.ts`, `movers/route.test.ts`,
`movers/apply/route.test.ts`, `acquisition/{redeem,public-trial-campaign}.test.ts`,
`partner-consents/oauth/{initiate,callback}.test.ts`, and lib tests for
`leads/{create-lead,dispatch-leads,billing,match-movers,match-partners}`,
`acquisition-campaigns`, `acquisition-campaign-sync`.

Gaps / suggested:
- **Affiliate postback cross-attribution** (SEC-02): mismatched click/provider id.
- **Portal magic-link** lib has no direct test for revocation-on-status-change or
  expiry edges (**[needs verification]** — no `*-portal-auth.test.ts` found).
- **CSRF/Origin** on portal mutations (SEC-04) once a check is added.
- **Lead limiter fail-mode** (SEC-05).
- **e2e**: apply → admin approve → portal magic-link → lead delivery → CPL accrual.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|---|---|---|---|---|---|---|
| partners-affiliate-movers-01 | Low | Logic | Postback cross-attributes a conversion to a provider that doesn't own the echoed click | Corrupted per-provider revenue/EPC attribution | Reject/drop link when `click.providerId !== providerId` | `api/affiliate/postback/[network]/route.ts:67-86` |
| partners-affiliate-movers-02 | Low | Security | Portal magic-link token in URL query, not single-use | Leaked link grants portal access until expiry | Split single-use link token from session token | `app/{partners,movers}/portal/enter/route.ts`; `*-portal-auth.ts` |
| partners-affiliate-movers-03 | Low | Security | Portal mutations rely on SameSite=Lax, no CSRF/Origin check | Possible CSRF on weak-SameSite browsers (low-value actions) | Add Origin/Sec-Fetch-Site check to portal POSTs | `api/partners/portal/{leads-optin,logout}`; `api/movers/portal/{logout,placements/request}` |
| partners-affiliate-movers-04 | Low | Security | `/api/leads` rate limit fail-open (no `failClosed`) | On Redis outage (multi-instance) lead cap can be exceeded → PII fanout + CPL | Add `failClosed` to match redeem/affiliate | `api/leads/route.ts:41-47` |
| partners-affiliate-movers-05 | Low | Performance | Lead matching loads all approved partners/movers and filters in JS | Hot path becomes O(n) as approved set grows | State-scoped query / index when set grows | `lib/leads/match-movers.ts:52-63`, `match-partners.ts:69-74` |
| partners-affiliate-movers-06 | Low | Reliability | Mover apply with all uploads failing yields PENDING app, 0 docs, only console.error | Admin reviews an app with no proof, no signal | Surface admin signal when attached files all fail | `api/movers/apply/route.ts:143-162` |
| partners-affiliate-movers-07 | Info | Logic | Stale comment claims missing `@@unique([userId,campaignId])` that already exists | Misleading maintainer doc | Update comment | `api/acquisition/redeem/route.ts:83-101` |
| partners-affiliate-movers-08 | Info | UI/UX | Lead-optin toggle has no loading/disabled state | Cosmetic double-POST (idempotent) | Add pending UI | `app/partners/portal/page.tsx:99-107` |
| partners-affiliate-movers-09 | Info | Security | Lead-dispatch email escaper handles `<>&` only | Safe in current text-node template; risk only if moved to attribute | Keep text-node interpolation / use shared renderer | `lib/leads/dispatch-leads.ts:54-118` |
| partners-affiliate-movers-10 | Info | Test | No portal-auth unit test for revocation/expiry edges | Regression risk on session invalidation | Add `*-portal-auth` tests | `lib/{partner,mover}-portal-auth.ts` |

## 19. Module TODO

- [ ] **(Low)** Guard affiliate postback against click/provider mismatch.
  Reason: attribution integrity. Files: `api/affiliate/postback/[network]/route.ts`.
  Fix: when `clickId` resolves and an explicit `providerId` differs, reject or drop
  the click link. Dependencies: none. Complexity: low. Risk: low.
- [ ] **(Low)** Make portal magic-link single-use (separate link token from session
  token). Reason: leaked-link exposure window. Files: `partner-portal-auth.ts`,
  `mover-portal-auth.ts`, both `enter/route.ts`. Fix: on `enter`, revoke the link
  token and mint a session token. Dependencies: schema field for link vs session.
  Complexity: med. Risk: med (auth flow).
- [ ] **(Low)** Add Origin/Sec-Fetch-Site check to portal mutation POSTs. Reason:
  CSRF defense-in-depth. Files: portal `logout`/`leads-optin`/`placements/request`.
  Fix: shared origin-check helper. Dependencies: none. Complexity: low. Risk: low.
- [ ] **(Low)** Add `failClosed` to the `/api/leads` limiter. Reason: bound PII
  fanout + CPL under limiter degradation. Files: `api/leads/route.ts`. Complexity:
  low. Risk: low.
- [ ] **(Low)** Index/scope lead-match queries by state before the approved set
  grows. Files: `match-movers.ts`, `match-partners.ts`, `schema.prisma`.
  Complexity: med. Risk: low.
- [ ] **(Low)** Surface an admin signal when a mover application's attached docs all
  fail to upload. Files: `api/movers/apply/route.ts`. Complexity: low. Risk: low.
- [ ] **(Info)** Fix the stale `@@unique([userId, campaignId])` comment in the redeem
  route. Files: `api/acquisition/redeem/route.ts`. Complexity: low. Risk: low.
- [ ] **(Info)** Add portal-auth unit tests for revocation-on-status-change + expiry.
  Files: `lib/{partner,mover}-portal-auth.ts`. Complexity: low. Risk: low.
