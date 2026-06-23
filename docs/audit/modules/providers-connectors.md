# Module Audit: Providers & Connectors

> Read-only audit. Evidence is source code only. Paths are relative to repo root
> `staging-move/`. Line numbers are best-effort at time of review.

## 1. Module Summary

This module covers two intertwined surfaces:

1. **Provider catalog & recommendations** — the `ServiceProvider` catalog, address-level
   serviceability enrichment (FCC broadband + OpenEI electric), the shared
   `recommendation-engine` that scores/ranks providers into urgency tiers, the
   sponsored-placement slot (paid, FTC-labeled, kept out of the organic ranking),
   user-private custom providers, and the duplicate guard.
2. **Connectors (partner address-change sync)** — an isolated `@locateflow/connectors`
   framework (allowlisted HTTP client, circuit breaker, OAuth/PKCE, planner/executor)
   bridged to the app via `connector-runtime`, `connector-oauth`, `connector-registry`,
   a durable outbox (`ConnectorDispatch` / `AddressChangeEvent`), a cron worker, an
   inbound signed webhook, and a guided/fallback manual path. USPS is the reference
   connector. The whole connector surface is gated by `FEATURE_API_CONNECTORS`
   (default OFF) plus per-connector `ConnectorConfig` and an annual-Pro entitlement.

Overall the code is unusually defensive and well-instrumented: SSRF egress is
physically constrained to manifest allowlists, OAuth tokens are AES-256-GCM
encrypted at rest with optimistic-CAS refresh, the recommendation comparator is a
provably-transitive total order, and sponsorship is structurally excluded from
organic ranking. The findings below are mostly edge-case integrity / abuse /
observability items rather than broken core logic.

## 2. Related Files

Connectors (web bridge):
- `apps/web/src/lib/connector-runtime.ts` — enqueue + dispatch worker
- `apps/web/src/lib/connector-oauth.ts` — OAuth config, token vault, refresh, consent CRUD
- `apps/web/src/lib/connector-registry.ts` — registered adapters (USPS)
- `apps/web/src/lib/fallback-actions.ts` — guided/manual fallback (pinned URLs, anti-phishing)
- `apps/web/src/lib/guided-connector-actions.ts` — in-code guided defaults
- `apps/web/src/lib/shared-encryption.ts` → `packages/shared/src/encryption.ts` (AES-256-GCM)

Connectors (framework): `packages/connectors/src/core/{http-client,oauth,mode,manifest,registry,dispatcher,executor,retry,circuit-breaker,state,logger}.ts`, `packages/connectors/src/usps/{index,request}.ts`

Providers (lib): `apps/web/src/lib/{provider-matching,provider-serviceability,sponsored-provider,service-provider-logo-enrichment,custom-provider-duplicate-guard,recommendation-weights}.ts`; `apps/web/src/lib/provider-empty-state.ts`; `apps/web/src/lib/provider-integrity.ts` (re-export)

Providers/connectors (shared): `packages/shared/src/{recommendation-engine,provider-integrity,provider-coverage,provider-brand,provider-move-domain,provider-quality-report}.ts`

APIs: `apps/web/src/app/api/{providers,connectors,connector-dispatch,custom-providers,partner-consents,sponsored}/**`, `apps/web/src/app/api/cron/connector-dispatch/route.ts`, `apps/web/src/app/api/providers/recommendations/feedback/route.ts`

UI: `apps/web/src/app/(app)/providers/{page,[id]/page}.tsx`, `apps/web/src/app/(app)/providers/providers-client.tsx`

## 3. Related Routes / Screens

- `(app)/providers` — directory + recommendations client (renders organic clusters,
  region groups, and a separate FTC-labeled sponsored box).
- `(app)/providers/[id]` — provider detail.
- Connections screen (consumes `/api/connectors/catalog`, `/api/partner-consents`,
  `/api/connectors/changes`) — referenced via hrefs `/settings/connections`.

## 4. Related APIs

- `GET /api/providers`, `GET /api/providers/[id]`, `GET /api/providers/compare`,
  `GET /api/providers/popular`, `GET /api/providers/recommendations`,
  `POST /api/providers/recommendations/feedback`, `GET /api/providers/saved`,
  `POST /api/providers/revalidate`.
- `GET/POST /api/custom-providers`, `GET/PATCH/DELETE /api/custom-providers/[id]`.
- `POST /api/connector-dispatch`, `POST/GET /api/cron/connector-dispatch`.
- `GET /api/connectors/catalog`, `GET /api/connectors/changes`,
  `POST /api/connectors/[key]/webhook`.
- `GET /api/partner-consents`, `DELETE /api/partner-consents/[id]`,
  `GET /api/partner-consents/oauth/initiate`, `GET /api/partner-consents/oauth/callback`.
- `POST /api/sponsored/click`.

## 5. Related Components

`providers-client.tsx` (directory + recommendation lanes + sponsored box), provider
card / coverage badge components, mover/sponsored cards in `components/movers` and
`components/moving`. The sponsored slot is rendered as a discrete labeled box
(`providers-client.tsx` ~L680-706) above the organic clusters.

## 6. Related State / Hooks / Stores

Server-driven; the providers client fetches `/api/providers/recommendations` and
holds local React state for the selected address/state filter. No global store of note
for this module. Connector breakers are in-process module state
(`connector-runtime.ts` `breakers` Map, L44).

## 7. Related Database / Models

`ServiceProvider`, `ServiceProviderCoverage`, `UserCustomProvider`, `SavedProvider`,
`RecommendationFeedback`, `SponsoredPlacement` (kind=`provider`/`mover`),
`ProviderGovernanceIssue`, `PartnerConsent`, `ConnectorConfig`, `ConnectorDispatch`,
`AddressChangeEvent`, `ConnectorFallbackAction`, processed-webhook ledger.

## 8. Impact Map

- **UI**: provider directory, recommendation lanes, sponsored box, coverage/trust badges.
- **API**: provider listing/detail/recs/feedback, custom providers, connector dispatch/catalog/changes/webhook, partner consents, sponsored click.
- **DB**: catalog reads, governance-issue upserts on every recommendation request, consent/dispatch writes, sponsored counter increments.
- **Auth**: session-gated reads; workspace-scope gating on dispatch/initiate; consent ownership scoping; cron-secret guard.
- **Admin**: `ConnectorConfig` control plane (enable/stage/circuit), governance issues, fallback-action overrides, sponsored placements.
- **Mobile**: shares `recommendation-engine` + provider types; mobile payloads must keep scoring identical (optional fields = no-signal).
- **Notifications**: `CONNECTOR_ACTION_NEEDED` in-app + email on NEEDS_USER.
- **Integrations**: USPS COA API, FCC BDC, OpenEI URDB; partner OAuth + webhooks.
- **Analytics**: integration telemetry, sponsored impressions/clicks, user events.
- **SEO**: provider directory/detail pages (not deeply reviewed here).
- **Tests**: extensive — see §17.

## 9. Buttons / Actions / Functions

**Connect a partner (OAuth initiate)** — `GET /api/partner-consents/oauth/initiate`
- Expected: gated by session + flag + entitlement + enabled+configured connector; redirect to partner with PKCE+state cookies.
- Actual: matches. 401/503/403/400 handled. State+PKCE in httpOnly, sameSite=lax, secure (env-aware), 10-min cookies. ✓
- Permission check: yes (`assertWorkspaceAction("addressChange.initiate")` + `userHasApiConnectorEntitlement`). Edge: with no credentials → 503 (inert).

**OAuth callback / store consent** — `GET /api/partner-consents/oauth/callback`
- Expected: validate CSRF state cookie, exchange code server-side, store encrypted consent, redirect into app.
- Actual: matches. State mismatch → `connector_error=state-mismatch`. Token never exposed. `upsertGrantedConsent` supersedes prior grants and zeroes their tokens. ✓
- Edge: cookie expiry, error param, persist failure all redirect to dashboard with a coded query param.

**Revoke consent** — `DELETE /api/partner-consents/[id]`
- Expected: revoke caller-owned consent, zero token, cancel queued dispatches.
- Actual: `revokeConsent` scopes by `{ id, userId }`; non-owned/missing → 404 (no enumeration leak). ✓

**Sync now / dispatch** — `POST /api/connector-dispatch`
- Expected: gate flag+entitlement+workspace, default to primary address, enqueue outbox rows.
- Actual: matches. Defense-in-depth re-checks in `enqueueAddressChange`. Live push only for true API_SYNC connectors. ✓
- Loading/disabled/error: API returns coded errors; UI loading not reviewed line-by-line.

**Dispatch worker** — `runDueDispatches` (cron)
- Expected: claim QUEUED→DISPATCHING atomically, run one attempt, apply planner decision; recover stranded rows.
- Actual: atomic `updateMany` claim prevents double-send; stale DISPATCHING/SUBMITTED rows flip to NEEDS_USER (never blind re-send). ✓

**Inbound confirm** — `POST /api/connectors/[key]/webhook`
- Expected: flag+enabled+HMAC+replay-guard, advance dispatch to CONFIRMED or NEEDS_USER.
- Actual: timing-safe HMAC, fail-closed on missing secret, idempotency reserve before mutation, terminal rows never reopened. ✓

**Create/edit/delete custom provider** — `/api/custom-providers[ /[id]]`
- Expected: per-user ownership, validation, duplicate + listed-conflict guards, rate-limit, audit log.
- Actual: all where-clauses scope by `userId`; Zod validation; `<>`-stripping; coverage rules server-authoritative; pending-review cap (10). ✓

**Dismiss/snooze recommendation** — `POST /api/providers/recommendations/feedback`
- Expected: per-user upsert, provider existence check, rate-limit.
- Actual: Zod-validated, provider FK checked (404 not 500), rate-limited 40/min. ✓

**Sponsored click beacon** — `POST /api/sponsored/click`
- Expected: record a click on a shown placement.
- Actual: authenticates only; increments the `clicks` counter on any placement id supplied, no proof-of-impression, no per-user dedupe/rate-limit. ✗ (see PC-01)

## 10. UI/UX Audit

- **Sponsored slot disclosure** (`providers-client.tsx` ~L680-706): the sponsored
  provider is rendered in a SEPARATE labeled box (`recs.sponsored.label || "Sponsored"`)
  above the organic clusters, never mixed into them. Evidence-aligned with the
  ranking-integrity contract. ✓ Recommendation: keep an automated test asserting the
  label is always present when `sponsored` is non-null (currently none).
- **Coverage caveats**: recommendation explanations attach "Confirm availability by
  address" / "Availability may vary by address" reasons for address-sensitive,
  low-confidence providers (`recommendation-engine.ts` L1072-1080). Good honesty UX.
- **Empty state**: `provider-empty-state.ts` provides messaging; not a defect.
- Priority: Low. No blocking UI defects found in scope.

## 11. Logic Audit

- **Expected flow (recs)**: load profile/addresses/services/movingPlan/feedback/saved →
  resolve state+coords (address → query → ZIP centroid) → fetch catalog (FEDERAL + state
  coverage) → tier by coverage → enrich serviceability (plan-gated) → score → cluster →
  build guide → attach one sponsored slot. Flow is coherent and defensively coded
  (`route.ts` L1037-1422).
- **Serviceability override** (`recommendation-engine.ts` L256-273): an authoritative
  FCC/OpenEI `*Serviceable` flag promotes a provider to `AVAILABLE_AT_ADDRESS`,
  overriding catalog coverage. When the source is unconfigured the field is undefined
  and confidence falls back to catalog logic — correct, no crash. ✓
- **Plan gating of serviceability** (`route.ts` L1278-1285): only `addressValidation`-
  entitled users trigger live FCC/OpenEI lookups; others get `providerServiceabilityGatedMeta`.
  Correct, prevents free-tier API spend.
- **Ranking integrity**: sponsorship/affiliate is never a scoring signal. `affiliateActive`
  is carried as boolean only and never added to `score` anywhere in `scoreProviders`
  (`recommendation-engine.ts` L976-1308). The sort comparator (`compareScoredProviders`,
  L1389) has no sponsorship term. ✓
- **Transitive comparator**: distance/coverage folded as per-element fields with an `id`
  terminal tiebreaker — provably a strict total order (documented L1317-1366). ✓
- **Stale/cache risks**: `/api/providers` uses `unstable_cache` (1h, tag `providers`)
  for the per-state catalog (`providers/route.ts` L16-43). Acceptable; `revalidate`
  route exists. `getScoringWeightOverrides` caches 60s in-process (defensive).
- **Race conditions (connectors)**: token refresh uses optimistic CAS on `tokenVersion`
  (`connector-oauth.ts` L222-237); dispatch claim is an atomic conditional `updateMany`
  (`connector-runtime.ts` L619-623); webhook reserve-before-mutate closes the
  check-then-act window. All sound. ✓

### PC-04 (Low): Governance-issue writes on the hot recommendations path
`/api/providers/recommendations` performs `ProviderGovernanceIssue` find+create/update
upserts for every source gap (up to 8) and for FCC/OpenEI source-health on every request
where the live source errors or returns unmatched providers (`route.ts` L757-887,
L889-978, called L1286-1303). These are `await`ed (wrapped in `.catch`) inside the
request, adding DB round-trips and potential write contention under load on a
read-heavy endpoint. Recommendation: move to a fire-and-forget queue / sampled
write, or debounce by (source,status) with a TTL so a flapping integration doesn't
generate write storms.

## 12. Reverse Logic Audit

- **Unauthorized user**: every connector/consent/custom-provider/feedback route checks
  session first (401). Catalog/changes set `Cache-Control: no-store`. ✓
- **Empty data**: no addresses/profile → recs degrade to FEDERAL-only, state="",
  geo skipped. No crash. ✓
- **API error (FCC/OpenEI)**: try/catch sets lookup null, status "error"/"not_configured";
  recs fall back to catalog. ✓
- **Slow network**: connector HTTP client has a 15s timeout + breaker; OAuth fetch a 10s
  timeout (`connector-oauth.ts` L30, L102). ✓
- **Double-click (Sync now)**: dispatch idempotencyKey `${changeRef}:${connectorKey}`
  unique; atomic claim prevents double partner send. ✓
- **Stale data**: stale DISPATCHING/SUBMITTED rows reconciled to NEEDS_USER, never blind
  re-sent (`connector-runtime.ts` L540-594). ✓
- **Direct route access**: connector dispatch enforces workspace action + entitlement
  server-side, not just UI. ✓
- **Token expiry**: expired access token + refresh token → in-band refresh; failure →
  null token → AUTH_EXPIRED → NEEDS_USER (no silent skip). ✓
- **Role change / workspace**: `resolveWorkspaceDataScope` + `assertWorkspaceAction`
  re-evaluated per request; entitlement keyed to workspace owner for workspace scope.
- **Dark theme / mobile viewport**: not the focus of this module; shared engine is pure
  and platform-agnostic. [needs verification] for pixel-level rendering.

## 13. Security Audit

### PC-01 (Medium): Sponsored click counter inflatable by any authenticated user (click fraud / billing-metric integrity)
- **Severity**: Medium
- **Affected Area**: `POST /api/sponsored/click` → `recordSponsoredClick` → `bumpPlacementCounter`
- **Evidence**: `apps/web/src/app/api/sponsored/click/route.ts` L12-25 authenticates then
  calls `recordSponsoredClick(placementId)` for any string id (len 1-30). `lib/movers.ts`
  `bumpPlacementCounter` L226-242 does `prisma.sponsoredPlacement.update({ where: { id }, data: { clicks: { increment: 1 } } })` with no check that the placement was shown to this
  user, no active/started/ended check, and no per-user dedupe or rate-limit. The valid
  `placementId` is handed to every client in the recommendations response
  (`providers/recommendations/route.ts` L1428, rendered/beaconed in
  `providers-client.tsx` L88-95, L706).
- **Risk**: A logged-in user can POST the click endpoint repeatedly (or with a competitor's
  placement id) to inflate `clicks`, corrupting CTR / sponsored billing & reporting, and
  potentially draining a sponsor's budget or skewing pacing decisions.
- **Defensive Abuse Scenario (high-level)**: scripted repeated calls with a known
  placement id arbitrarily raise the click count; no impression had to occur first.
- **Prevention**: bind clicks to a signed, single-use impression token issued when the
  slot is actually served; enforce per-user + per-IP rate-limit and per-(user,placement)
  dedupe windows; verify the placement is `active` and within `startsAt/endsAt`.
- **Detection**: alert on clicks>impressions or anomalous click velocity per placement/user.
- **Analysis (root cause)**: the beacon trusts a client-supplied id and treats the counter
  as fully best-effort, omitting the abuse controls present on other mutating routes
  (custom-providers, feedback both rate-limit).
- **Recommendation**: add rate-limit + dedupe + impression binding + active-window check
  before incrementing; do the same for the impression counter on the server side.
- **Tests To Add**: repeated clicks from one user count once per impression; inactive/expired
  placement is not incremented; cross-user/unshown placement id is rejected.

### PC-02 (Low): SSRF allowlist is host-string based, not DNS/IP pinned (residual)
- **Severity**: Low (defense already strong; residual only)
- **Affected Area**: `packages/connectors/src/core/http-client.ts` `assertAllowed` L87-102;
  redirect re-check L141-170; `connector-oauth.ts` `isAllowedConnectorUrl` L84-91.
- **Evidence**: egress is constrained to `https:` + `allowed.has(url.host)`, with manual
  redirect following that re-checks every hop and strips `Authorization` on cross-host
  redirects. The allowlist is matched against the URL host string; there is no resolved-IP
  / private-range check, so a host that (mis)resolves to an internal IP would still pass.
- **Risk**: classic SSRF via DNS rebinding is only theoretically reachable, and crucially
  the allowlist hosts come from **manifest code + operator-set runtime config**, not from
  user input — so an attacker cannot point a connector at an arbitrary host. This makes the
  practical risk low.
- **Prevention**: optionally resolve and reject private/link-local/loopback IP ranges at
  request time; pin to expected IPs for high-value partners.
- **Detection**: egress monitoring on connector workers.
- **Analysis (root cause)**: host allowlisting is the chosen isolation boundary; it is
  sufficient because hosts are not user-controlled.
- **Recommendation**: document the trust assumption (hosts are operator-controlled) and
  consider an IP-range guard as defense-in-depth.
- **Tests To Add**: a manifest/runtime URL resolving to a private IP is rejected (if guard added).

### PC-03 (Low): Connector OAuth `state`/PKCE bound to cookie only, not to user id
- **Severity**: Low
- **Affected Area**: `partner-consents/oauth/{initiate,callback}/route.ts`
- **Evidence**: initiate sets `pc_oauth_state` / `pc_oauth_pkce` / `pc_oauth_connector`
  httpOnly cookies (initiate L83-85); callback compares `cookieState === state`
  (callback L60-65) and then attaches the consent to `session.userId`. The CSRF state is
  validated against the cookie but is not additionally bound to the session user id.
- **Risk**: low — both cookie and session ride the same browser, sameSite=lax + httpOnly
  reduce cross-site injection; a login-CSRF style consent-fixation would require controlling
  the victim's cookies. No token is exposed to the client.
- **Prevention**: include a session-bound, HMAC'd value in `state` and verify it server-side.
- **Detection**: anomaly on consent grants not preceded by a same-session initiate.
- **Analysis (root cause)**: standard cookie-based CSRF protection; acceptable but not
  session-pinned.
- **Recommendation**: bind `state` to the user id (HMAC) for defense-in-depth.
- **Tests To Add**: callback rejects a state minted for a different session.

### Items reviewed and found SOUND (no finding)
- **Token storage**: access/refresh tokens AES-256-GCM encrypted at rest
  (`encryption.ts`); production refuses to store plaintext if key missing (L42-44).
  Tokens never returned by `/api/partner-consents` (only status/scopes/timestamps).
- **Webhook auth**: per-connector HMAC-SHA256 timing-safe, fail-closed, replay-guarded,
  honors kill switch/circuit, terminal rows immutable (`[key]/webhook/route.ts`). ✓
- **IDOR**: custom-provider and consent routes scope every query by `userId`; recs feedback
  upsert keyed by (userId, providerId). ✓
- **Injection/XSS**: custom-provider text strips `<>`; provider catalog values are catalog-
  owned; recommendation reasons are server-generated strings.
- **Unsafe redirects**: fallback-action URLs are `https`-only and security-sensitive ones
  are **pinned** to code-owned official URLs that DB overrides cannot repoint
  (`fallback-actions.ts` L33-44, L75-88). OAuth callbacks only ever redirect to in-app paths. ✓
- **Cron auth**: `guardCronRequest` (constant-time secret + rate-limit) replaces a
  timing-attackable bearer check (`cron/connector-dispatch/route.ts` L21). ✓
- **Secret/PII logging**: connector client uses `createRedactingLogger`; payloads encrypted
  on dispatch rows; confirmation numbers encrypted.

## 14. Performance Audit

- **N+1 / hot-path writes**: see PC-04 — governance-issue upserts on the recommendations
  request path are serialized DB round-trips.
- **Full-category scans (duplicate guard)**: `findListedProviderNameConflict` loads ALL
  active `ServiceProvider` rows in a category and compares in-memory
  (`custom-provider-duplicate-guard.ts` L46-64). For large categories (FINANCIAL_* can be
  100+) this is a per-create/per-edit scan. Bounded and rate-limited, but a normalized-name
  index/equality prefilter would be cheaper. Low priority.
- **Recommendations request fan-out**: a single GET does ~6 parallel reads + catalog read +
  optional FCC/OpenEI HTTP + state rule + community popularity + governance writes. Heavy
  but parallelized; rate-limited (`provider_recommendations`).
- **Catalog caching**: `/api/providers` per-state result cached 1h (`unstable_cache`). Good.
- **Connector breakers** are process-lifetime; fine for serverless warm instances, reset on
  cold start (acceptable).
- **Mobile perf**: shared engine is pure O(n log n); no obvious hot loops.

## 15. Reliability Audit

- **Error boundaries**: all API routes wrap in try/catch with coded responses; recs route
  returns 500 with generic message.
- **Retry/backoff**: `planNextDispatch` drives retry with backoff; breaker trips on 5xx only.
- **Offline/slow**: timeouts on connector + OAuth fetch; best-effort notifications never fail
  a dispatch.
- **Transaction consistency**: enqueue writes event + dispatch rows in one
  `prisma.$transaction`; custom-provider delete detaches services/move-tasks atomically.
- **Partial failure**: one bad dispatch row is caught and counted, never poisons the batch
  (`connector-runtime.ts` L614-633); stale rows reconciled to NEEDS_USER.
- **Monitoring/logging**: integration telemetry + governance issues + redacting logger.
  Gap: no metric/alert on sponsored click anomalies (ties to PC-01).
- **Empty/loading**: serviceability degrades gracefully to `not_configured`/`gated`.

## 16. Dead Code / Cleanup

- No clearly-dead exports identified in scope. `connector-registry` lists only `uspsConnector`;
  the framework supports more — that is intentional (single live connector), not dead code.
- `service-provider-logo-enrichment.ts` is a self-contained enrichment helper; usage outside
  scope not exhaustively traced — [needs verification] that it is still imported by a
  services surface.
- `provider-integrity.ts` (web lib) is a thin re-export of the shared module; intentional.

## 17. Tests

Existing (strong coverage):
- Framework: `packages/connectors/src/core/*.test.ts` (http-client, oauth, mode, manifest,
  registry, dispatcher, executor, retry, circuit-breaker, state, logger), `usps/usps.test.ts`.
- Web bridge: `connector-runtime.test.ts`, `connector-oauth.test.ts`, `connector-registry.test.ts`,
  `connectors/[key]/webhook/route.test.ts`, `connectors/catalog/route.test.ts`,
  `connectors/changes/route.test.ts`, `connector-dispatch/route.test.ts`,
  `fallback-actions.test.ts`, `custom-provider-duplicate-guard.test.ts`,
  `provider-serviceability.test.ts`, `sponsored-provider.test.ts`.
- Shared: `recommendation-engine.test.ts`, `provider-integrity.test.ts`,
  `provider-coverage.test.ts`, `provider-brand.test.ts`, `provider-move-domain.test.ts`.

Missing / suggested:
- **Sponsored click integrity** (PC-01): no test for `/api/sponsored/click`; add abuse-control
  tests once dedupe/rate-limit/impression-binding added.
- **Ranking integrity invariant**: add a property test asserting that toggling
  `affiliateActive` / presence of a sponsored placement never changes organic order/scores.
- **FTC label rendering**: component test asserting the sponsored label box renders whenever
  `sponsored` is present.
- **Governance-write load** (PC-04): test that recommendations succeed (and stay fast) when
  the source-health upsert path errors or is heavily exercised.
- **OAuth state session-binding** (PC-03): if implemented, test cross-session state rejection.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| providers-connectors-01 | Medium | Security | Sponsored click counter inflatable by any authenticated user (no impression binding / dedupe / rate-limit / active-window check) | Click fraud, corrupted CTR & sponsored billing metrics, possible budget drain | Bind clicks to single-use impression token; rate-limit + dedupe per user/placement; verify active window | `apps/web/src/app/api/sponsored/click/route.ts`; `apps/web/src/lib/movers.ts` (bumpPlacementCounter) |
| providers-connectors-02 | Low | Security | Connector egress allowlist is host-string based (no resolved-IP/private-range guard) | Residual SSRF only; hosts are operator-controlled, not user-input, so practical risk low | Add private-IP-range guard as defense-in-depth; document trust assumption | `packages/connectors/src/core/http-client.ts`; `apps/web/src/lib/connector-oauth.ts` |
| providers-connectors-03 | Low | Security | OAuth CSRF `state` validated against cookie but not bound to session user id | Low; consent-fixation requires controlling victim cookies; no token exposed | HMAC a session-bound value into `state` and verify server-side | `apps/web/src/app/api/partner-consents/oauth/{initiate,callback}/route.ts` |
| providers-connectors-04 | Low | Performance | ProviderGovernanceIssue upserts run awaited on the hot `/recommendations` request path | Extra DB round-trips / write contention under load on a read-heavy endpoint | Move to async queue / sampled+debounced writes keyed by (source,status) | `apps/web/src/app/api/providers/recommendations/route.ts` (L757-978, L1286-1303) |
| providers-connectors-05 | Low | Performance | Duplicate guard loads all active providers in a category for in-memory name compare | Per-create/edit full-category scan; bounded + rate-limited | Add normalized-name prefilter/index | `apps/web/src/lib/custom-provider-duplicate-guard.ts` |
| providers-connectors-06 | Info | Test | No automated assertion of the sponsored-vs-organic ranking-integrity invariant or FTC label rendering | Regression in ranking integrity could ship silently | Add property test (affiliate/sponsor toggle ⇒ no organic reorder) + label render test | `packages/shared/src/recommendation-engine.ts`; `apps/web/src/app/(app)/providers/providers-client.tsx` |

## 19. Module TODO

- [ ] **(Medium) Harden sponsored click counting** — Reason: PC-01 click-fraud / billing
  integrity. Related: `api/sponsored/click/route.ts`, `lib/movers.ts`. Fix: issue a signed
  single-use impression token when the slot is served; require it on click; add per-user/IP
  rate-limit + dedupe + active-window check; mirror server-side for impressions.
  Dependencies: impression-issuance plumbing in recommendations response + client.
  Complexity: med. Risk of change: med (touches a revenue path).
- [ ] **(Low) Add private-IP guard to connector egress** — Reason: PC-02 residual SSRF.
  Related: `core/http-client.ts`. Fix: resolve + reject private/loopback/link-local ranges
  (and on each redirect hop). Dependencies: none. Complexity: med. Risk: med (could break a
  legit partner behind an unusual network).
- [ ] **(Low) Session-bind OAuth `state`** — Reason: PC-03. Related: partner-consents OAuth
  routes. Fix: HMAC session id into `state`, verify at callback. Dependencies: none.
  Complexity: low. Risk: low.
- [ ] **(Low) De-hot-path governance-issue writes** — Reason: PC-04. Related: recommendations
  route. Fix: queue/sample/debounce the upserts. Dependencies: a lightweight async sink.
  Complexity: med. Risk: low.
- [ ] **(Low) Prefilter duplicate-guard query** — Reason: PC-05. Related: duplicate-guard.
  Fix: store/query a normalized-name column or narrow the candidate set. Dependencies:
  possible schema column. Complexity: med. Risk: low.
- [ ] **(Info) Add ranking-integrity + FTC-label tests** — Reason: PC-06. Related: shared
  engine + providers client. Fix: property test + component test. Dependencies: none.
  Complexity: low. Risk: low.
