# Flow Audit: Provider / Connector Dispatch

Area slug: `provider-connector-dispatch`
Scope: Select provider -> dispatch connector -> OAuth/credentials -> status -> fallback action.
Evidence is source-only; cited paths are relative to repo root `apps/web` / `packages/...` unless noted.

---

## 1. Flow Summary & actors

The connector subsystem fans a user's address change out to consented + admin-enabled partner connectors, pushing server-side when a connector is truly "API_SYNC" and otherwise degrading to a manual guided fallback. Nothing is live by default: the whole surface is gated by the `FEATURE_API_CONNECTORS` runtime flag, a per-connector `ConnectorConfig.enabled` kill switch, a plan entitlement (annual Pro / consumer-free), and a derived "mode" that can never be hand-set.

Actors:
- End user (web) — connects a partner via OAuth, clicks "Sync now", or edits their primary address (auto-sync), at `apps/web/src/app/(app)/settings/connections/page.tsx`.
- Workspace manager (OWNER/ADMIN) — may push on behalf of a member via `POST /api/workspaces/[id]/sync`.
- Cron worker (Ofelia / DigitalOcean) — drives `POST|GET /api/cron/connector-dispatch`.
- Partner (USPS et al.) — receives the push and, for async connectors, calls back `POST /api/connectors/[key]/webhook`.
- Admin — sets `ConnectorConfig` (enabled/stage/rolloutPercent/circuitState), `ConnectorFallbackAction` rows, and runtime-config credentials/agreement status (out of this flow's write path).

Key modules: `lib/connector-runtime.ts` (enqueue + worker), `lib/connector-oauth.ts` (OAuth/token vault/entitlement), `lib/connector-registry.ts`, `lib/fallback-actions.ts` + `lib/guided-connector-actions.ts`, and the pure framework `packages/connectors/src/core/*` (mode, executor, dispatcher/planner, http-client, state) plus `packages/connectors/src/usps/*`.

---

## 2. Step-by-step trace

### Step A — Render Connections screen (provider selection)
- Trigger: user opens `/settings/connections`. Component `apps/web/src/app/(app)/settings/connections/page.tsx`.
- State: `catalog`, `consents`, `apiSyncEntitled`, `loading/disabled/error`.
- API calls:
  - `GET /api/connectors/catalog` (`app/api/connectors/catalog/route.ts`) — session-gated; returns every registered connector with a DERIVED mode from `resolveConnectorMode` (mode.ts), DB-backed guided action, plus operator-defined no-code GUIDED partners from `GUIDED_PARTNERS` runtime config. `Cache-Control: no-store`.
  - `GET /api/partner-consents` (`app/api/partner-consents/route.ts`) — session-scoped list, never returns tokens.
- DB op: `connectorConfig.findMany` (enabled/stage), `partnerConsent.findMany(where userId)`.
- Error handling: 401 unauth; catalog falls back to `[]`; consents 404/503 -> "not on your plan".

### Step B — Connect (OAuth initiate)
- Trigger: "Connect" click -> `window.location.href = /api/partner-consents/oauth/initiate?connector=usps`.
- File `app/api/partner-consents/oauth/initiate/route.ts`.
- Gates in order: `getUserSession` (401) -> `isApiConnectorsEnabled` (503) -> `resolveWorkspaceDataScope` + `assertWorkspaceAction("addressChange.initiate")` -> `userHasApiConnectorEntitlement` (403) -> `isValidConnectorKey` (400) -> `isConnectorEnabled` (503) -> `getConnectorOAuthConfig` (503 if not configured).
- Side effects: generates `state` + PKCE; sets short-lived (10 min) httpOnly `pc_oauth_state` / `pc_oauth_pkce` / `pc_oauth_connector` cookies (`secure` per env, `sameSite: lax`); 302 to the partner authorize URL (built by `buildAuthorizeUrl`, with `access_type=offline&prompt=consent`).

### Step C — OAuth callback (credentials)
- File `app/api/partner-consents/oauth/callback/route.ts`.
- Validates: session, flag, `error` param, `code`+`state` present, CSRF cookie `state===cookieState`, valid connector key, workspace scope, entitlement, connector enabled, OAuth config present.
- `exchangeConnectorCode` (back-channel POST to token URL via `lib/connector-oauth.ts`; `redirect: manual`, 10s timeout; a 3xx is treated as failure so secrets aren't re-sent).
- DB op: `upsertGrantedConsent` — encrypts access + refresh token (`shared-encryption`), one active grant per (user, connector) enforced by `@@unique([userId, connectorKey, activeGrantKey])`, supersedes old grants to REVOKED. Redirects to `/dashboard?connector_connected=...` and clears cookies. Errors land on `/dashboard?connector_error=...`.

### Step D — Trigger a dispatch (enqueue)
Three entry points, all funnel into `enqueueAddressChange` (`lib/connector-runtime.ts:179`):
1. "Sync now" -> `POST /api/connector-dispatch` (`app/api/connector-dispatch/route.ts`). No `toAddressId` -> defaults to the caller's primary address (scoped to workspace).
2. Primary-address edit -> `app/api/addresses/[id]/route.ts:176-184` auto-enqueues (best-effort, same entitlement gate) when location changed / became primary; passes no `fromAddressId`.
3. Workspace sync -> `POST /api/workspaces/[id]/sync` (self or on-behalf-of-member with `addressChange.manageForMembers` + `resolveManagedSyncEnabled`).
- `enqueueAddressChange` re-checks `isApiConnectorsEnabled` + `userHasApiConnectorEntitlement` (defense-in-depth), loads `to`/`from` addresses (scoped), user name, GRANTED consents, enabled `ConnectorConfig`s.
- Per consent: `resolveDispatchPlan` (LIVE/SHADOW/SKIP via circuit/stage/rollout bucket) -> for LIVE, `isApiSyncConnector` re-derives mode from agreement + credentials -> skips null-origin for `requiresOrigin` connectors -> enforces `perConnectorPerMinute` + `perUserPerDay` rate caps by counting recent dispatches.
- DB op (one `$transaction`): create `AddressChangeEvent` (changeRef), then one `ConnectorDispatch` per target (`idempotencyKey = "${changeRef}:${connectorKey}"`, encrypted payload), update event to `DISPATCHED`/`NO_TARGETS` with `dispatchCount = liveCreated`.
- Returns `{ changeRef, created }`.

### Step E — Worker processes due dispatches
- Trigger: `POST|GET /api/cron/connector-dispatch` -> `guardCronRequest` (constant-time secret + per-route rate limit) -> `isApiConnectorsEnabled` -> `runDueDispatches()` (`lib/connector-runtime.ts:541`).
- Recovery sweeps: stale `DISPATCHING` (>15 min) -> shadow rows FAILED, live rows NEEDS_USER + notify; stale `SUBMITTED` (>7 days) -> NEEDS_USER + notify. Then claim `QUEUED` rows due now (`take 25`).
- Atomic claim via `updateMany(where status QUEUED -> DISPATCHING)`; only the worker with `count>0` owns the row (cron + manual concurrency safe).
- `runDispatchRow`: re-honors kill switch/circuit (re-queue with 5-min backoff), shadow dry-run path, `isApiSyncConnector` re-check (NEEDS_USER if not), consent/token resolution + in-band refresh (`refreshConsentAccessToken` with optimistic `tokenVersion` CAS), `runConnectorAttempt` (executor.ts) over an allowlisted/breaker-wrapped client, then `planNextDispatch` (dispatcher.ts) -> persist status + backoff + encrypted confirmation.
- Side effects: `notifyNeedsUser` (in-app notification always; email respects `connectorActionNeeded` pref) on NEEDS_USER. Redacting logger used in connector context.

### Step F — Async confirmation (webhook)
- File `app/api/connectors/[key]/webhook/route.ts`. Gates: key regex -> flag (404) -> connector registered + has `parseWebhook` (404) -> `ConnectorConfig` enabled/stage/circuit (503) -> per-connector HMAC-SHA256 over raw body, timing-safe (401) -> JSON parse (400) -> `parseWebhook` ref present (400) -> `reserveWebhookEvent` (sha256 of raw body) for idempotency -> looks up dispatch by `idempotencyKey`, refuses to reopen terminal rows, advances to CONFIRMED / NEEDS_USER. Releases the reservation + 500 on processing error so the partner retries.

### Step G — Status + fallback surfaced to user
- `GET /api/connectors/changes` (`app/api/connectors/changes/route.ts`) — session-scoped recent `AddressChangeEvent` + non-shadow dispatch statuses (key/status/confirmedAt/lastErrorCode only; no payload/confirmation).
- Fallback action: catalog's `guidedAction` (DB-overridable via `ConnectorFallbackAction`, but the outbound URL for security-sensitive keys is pinned in code — `lib/fallback-actions.ts:33` `PINNED_ACTION_URLS`). NEEDS_USER state directs the user to `/settings/connections`.

---

## 3. Happy-path correctness

The happy path is coherent and well-defended:
- Mode is always derived (`resolveConnectorMode`) from objective facts; the UI badge cannot show "API sync" without a PRODUCTION agreement + credentials (mode.ts:87-100, catalog/route.ts:140-147).
- The transactional outbox (event + dispatch rows in one `$transaction`) plus the atomic `QUEUED->DISPATCHING` claim give at-most-one-owner processing.
- Token vault: access/refresh encrypted at rest; refresh uses an optimistic `tokenVersion` compare-and-swap so concurrent refreshes can't clobber a rotated token (connector-oauth.ts:222-237).
- HTTP egress is physically constrained to manifest `allowedHosts` over HTTPS, redirects re-checked per hop with Authorization dropped on cross-host hops (http-client.ts:141-169).
- Webhook is fail-closed: no secret -> 503, bad signature -> 401, reserve-before-act idempotency, never reopens terminal rows.
- Golden rule ("a connector failure degrades to manual, never blocks the move") is consistently implemented: executor PUSH_NOT_SUPPORTED -> NEEDS_USER, planner exhausts retry budget -> NEEDS_USER, webhook async failure -> NEEDS_USER.

---

## 4. Edge cases & reverse-logic

- Auth/role: every entry point requires a session. Workspace mode enforces `addressChange.initiate` (CHILD/VIEW_ONLY denied) and `manageForMembers` for on-behalf. `resourceUserId === actorUserId` so a MEMBER can only sync self. Solid.
- Empty/invalid input: missing `toAddressId` on "Sync now" defaults to primary or 400; invalid connector key -> 400; malformed body -> `{}`.
- Network failure: connector HTTP errors map to taxonomy; only 5xx/RATE_LIMITED are retryable; circuit breaker bulkheads a failing partner across dispatches.
- Double-submit / idempotency: **gap** — each enqueue mints a fresh `changeRef`, so two rapid "Sync now" clicks (or edit+sync) create two `AddressChangeEvent`s and two LIVE dispatches with different idempotency keys. The per-user-per-day cap is counted BEFORE the transaction commits, so two concurrent enqueues both read count=0 and both file (see Finding 02). Partner-side `Idempotency-Key` header = our dispatch idempotencyKey, which DIFFERS per event, so it does not dedupe across two enqueues; only USPS's own 409 ALREADY_ON_FILE and the perUserPerDay cap (eventually) bound it.
- Token expiry: handled in-band — expired access token + refresh present -> `refreshConsentAccessToken`; failure proceeds with null token -> AUTH_EXPIRED -> NEEDS_USER (not a silent skip).
- Partial failure: one bad row never poisons the batch (try/catch + counters); stale `DISPATCHING`/`SUBMITTED` recovery sweeps flip to NEEDS_USER rather than blind re-send (avoids double-filing).
- Race conditions: atomic claim + tokenVersion CAS + webhook reserve-before-act all close known windows.
- Stale data: `runDispatchRow` re-reads `ConnectorConfig` and consent status after claim, so a post-enqueue disable/revoke is honored.
- Direct deep-link entry: OAuth callback redirect targets are pinned in-app via a trusted-host allowlist (`lib/oauth.ts`), so no open redirect through `connector_error`/`connector_connected`.

---

## 5. Security review

- Authz at each step: consistent session + entitlement + connector-enabled gating; defense-in-depth re-checks inside `enqueueAddressChange` and `runDispatchRow`. Good.
- IDOR / workspace scoping: addresses are looked up with `userId` (+ `workspaceId` when in workspace mode); consents always scoped to the subject user; `partner-consents/[id]` DELETE scoped to owner (404 otherwise). The `connector-dispatch` route resolves the primary address by `userId: session.userId` (NOT the resolved actor of the scope object) — same user here, but see Finding 05 for the consistency note. Workspace `/sync` validates address.workspaceId === route id. No cross-tenant read found.
- Validation: connector key regex, URL allowlist (https + host), webhook HMAC timing-safe, JSON parse guards.
- Rate limiting: cron route guarded; user-facing POST/initiate rely on the GLOBAL middleware `user_write` group (120/min/user-route, `failClosed:false`) — there is NO connector-specific per-user dispatch limit, and the per-connector `perUserPerDay` cap is racy at enqueue (Findings 02, 04).
- Secrets/PII: tokens encrypted at rest, never returned by list endpoints, redacting logger in connector context, OAuth token-exchange errors logged status-only. The fallback URL pinning prevents a DB override from repointing a user-facing link to a spoofed host (anti-phishing). Strong posture.

---

## 6. Reliability

- Retry: planner with bounded budget + exponential backoff; transient-only retry.
- Transaction consistency: event + dispatches created atomically; the user-facing `dispatchCount` counts live rows only.
- Partial-failure recovery: recovery sweeps for stranded `DISPATCHING`/`SUBMITTED`; deliberately conservative (no auto re-send for fraud-controlled COA) -> NEEDS_USER.
- Loading/empty/error UX: connections page has loading, disabled (not-on-plan), error+retry, empty states. "Sync now" disabled while in-flight (client-side double-click guard only).
- Note: `runDueDispatches` is sequential (`for...of` awaiting each row) with `take 25`; a slow partner (up to 15s HTTP timeout) can serialize a batch. Throughput observation, not a correctness bug (Finding 06).

---

## 7. Cross-module impact

- Auth/session (`user-auth`), workspace authorization (`workspace-data-scope`, `permissions`), entitlement/billing (`consumer-entitlement`, `planFeatures`), encryption (`shared-encryption`), runtime config (`runtime-config`), notifications (`in-app-notifications`, `email-service`, `notification-preferences`), webhook idempotency ledger (`webhook-idempotency`, shared with Stripe/IAP), address module (auto-sync trigger), and the pure `@locateflow/connectors` framework. Mobile has a parallel `apps/mobile/app/settings/connections.tsx` consuming the same APIs (not deeply audited here).

---

## 8. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| provider-connector-dispatch-01 | Medium | Reliability | `runtimeConfig` per-call DB reads for `isApiSyncConnector` make a LIVE dispatch's mode derivation depend on 5 sequential runtime-config lookups per row per attempt | Worker latency + DB load scale with rows; a slow runtime-config table can serialize the batch | Cache connector gate inputs per worker tick / memoize per connectorKey within a run | `lib/connector-runtime.ts:133-164`, `lib/runtime-config.ts:28-54` |
| provider-connector-dispatch-02 | Medium | Logic | Double-enqueue / double-file race: each enqueue mints a fresh `changeRef`, and `perUserPerDay` is counted BEFORE the `$transaction` commits, so two concurrent enqueues both pass the cap and both file a LIVE COA | A user double-clicking, or edit+sync racing, can file two COAs to a partner within the cap window (fraud-controlled action) | Enforce per-(user,connector,destination) idempotency window on enqueue (e.g. unique constraint or recent-event dedupe), or move the cap check inside the transaction with a row lock | `lib/connector-runtime.ts:220,258-286,294-332` |
| provider-connector-dispatch-03 | Medium | Reliability | Webhook idempotency key is `sha256(rawBody)`, not `(connector, dispatch, outcome)` | A partner that legitimately resends a byte-identical CONFIRMED after our 500/release is fine, but a partner that sends an identical-body update for two states only by coincidence, or replays a stale body, dedupes silently; conversely any whitespace change defeats dedupe | Key the reservation on the parsed dispatch ref + outcome (stable) rather than the raw body hash | `app/api/connectors/[key]/webhook/route.ts:130-134` |
| provider-connector-dispatch-04 | Low | Security | No connector-specific per-user rate limit on `POST /api/connector-dispatch` or `oauth/initiate`; only the global `user_write` (120/min, `failClosed:false`) applies | If the distributed limiter is unconfigured/erroring, writes pass unthrottled; combined with Finding 02 this widens the double-file window | Add an explicit per-user low limit on dispatch/initiate, or set these routes to a fail-closed group | `apps/web/src/middleware.ts:372-394`, `lib/rate-limit-policy.ts:201-212` |
| provider-connector-dispatch-05 | Low | Logic | `connector-dispatch` route resolves the default primary address by `userId: session.userId` while entitlement/scope use the resolved scope object; consents in `enqueueAddressChange` also use `input.userId` | Currently consistent (actor == subject for self-sync), but the dual sourcing (session.userId vs scope.actorUserId) is fragile if a future change lets actor != subject | Source the subject id once from the scope and pass it explicitly to enqueue | `app/api/connector-dispatch/route.ts:40-60`, `lib/connector-runtime.ts:204-215` |
| provider-connector-dispatch-06 | Low | Performance | `runDueDispatches` processes the claimed batch sequentially (await per row) with up to 15s HTTP timeout per attempt | A few slow/unhealthy partners can serialize a tick and delay healthy rows | Bounded-concurrency processing (e.g. `Promise.allSettled` with a small pool) keyed per connector to respect breakers | `lib/connector-runtime.ts:614-633`, `packages/connectors/src/core/http-client.ts:82` |
| provider-connector-dispatch-07 | Info | Logic | Primary-address EDIT auto-sync passes no `fromAddressId`, so for `requiresOrigin` connectors (USPS) the dispatch is always skipped (`base.from === null`) | An edit to the primary address never reaches USPS via auto-sync; only a real from+to move dispatches. Intended, but means "auto-sync on edit" is effectively inert for the only live connector | Document/confirm intended; consider deriving `from` from prior primary address for true moves | `app/api/addresses/[id]/route.ts:176-184`, `lib/connector-runtime.ts:254`, `packages/connectors/src/usps/index.ts:50` |
| provider-connector-dispatch-08 | Info | Data | `enqueueAddressChange` never populates `effectiveDate` on the canonical payload | USPS `moveEffectiveDate` is always omitted; partner may default it | If the move date is product-relevant, thread it from the address/move record into the payload | `lib/connector-runtime.ts:222-227`, `packages/connectors/src/usps/request.ts:114` |

---

## 9. Flow TODO

- [ ] Add an enqueue-time idempotency window per (user, connector, destination) to prevent double-filing (Finding 02).
- [ ] Re-key webhook idempotency on the parsed dispatch ref + outcome (Finding 03).
- [ ] Memoize/cache connector gate inputs within a worker tick (Finding 01).
- [ ] Add a connector-specific per-user rate limit on dispatch + initiate (Finding 04).
- [ ] Thread the subject user id from the scope object into enqueue (Finding 05).
- [ ] Consider bounded concurrency in `runDueDispatches` (Finding 06).
- [ ] Confirm intended behavior of edit-auto-sync `from === null` skip for USPS and effectiveDate omission (Findings 07, 08).
