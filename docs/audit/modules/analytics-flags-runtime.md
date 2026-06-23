# Module Audit: Analytics, Feature Flags & Runtime Config

> READ-ONLY audit. Evidence is source code only. Paths are relative to repo root
> (`staging-move/`). Items that could not be fully confirmed from code are marked
> **[needs verification]**.

## 1. Module Summary

This module covers three intertwined runtime-control planes:

- **Analytics** — a consent-gated client tracker (`apps/web/src/lib/analytics.ts`)
  that talks to Google GTM/GA4 and an internal `UserEvent` log via
  `/api/tracking/event`, plus server-side write-time sampling
  (`user-event-sampling.ts`), retention pruning (`user-event-retention.ts`), the
  Phase-1 experiment funnel allow-list sanitizer
  (`packages/shared/src/phase1-experiment-analytics.ts`), and fire-and-forget
  integration telemetry (`integration-telemetry.ts`).
- **Feature flags** — a DB-backed `FeatureFlag` evaluator
  (`apps/web/src/lib/feature-flags.ts`) with ALL / PERCENTAGE / USER_LIST / PLAN
  targeting, admin CRUD at `apps/admin/.../api/feature-flags/route.ts`, the
  monetization flag name catalog (`packages/shared/src/monetization-flags.ts`),
  and UX experiment variant resolution (`packages/shared/src/ux-experiments.ts`).
- **Runtime config** — a deployment-env-first, optionally DB-overridable
  effective-config resolver (`apps/web/src/lib/runtime-config.ts`,
  `apps/admin/src/lib/runtime-config.ts`, shared catalog in
  `packages/shared/src/runtime-config.ts`) and a production-readiness probe
  (`production-readiness.ts` → `/api/ready`).

Overall the module is unusually mature: PII redaction is layered (key regex +
value heuristics + Phase-1 allow-list), config precedence is documented and
fail-safe, admin writes require step-up + audit, and most pieces are unit-tested.
The findings below are mostly correctness/robustness edge cases and test gaps
rather than gross security holes.

## 2. Related Files

- `apps/web/src/lib/analytics.ts` — client analytics + internal event queue.
- `apps/web/src/lib/feature-flags.ts` — flag evaluation + cache.
- `apps/web/src/lib/runtime-config.ts` — web effective-config resolver.
- `apps/web/src/lib/shared-runtime-config.ts` — re-export shim of shared catalog.
- `apps/web/src/lib/user-event-retention.ts` — retention pruning logic.
- `apps/web/src/lib/user-event-sampling.ts` — write-time sampling.
- `apps/web/src/lib/integration-telemetry.ts` — `IntegrationDailyStat` buffer/flush.
- `apps/web/src/lib/production-readiness.ts` — readiness report builder.
- `apps/web/src/lib/tracking-consent.ts` — consent gate for tracking routes.
- `packages/shared/src/runtime-config.ts` — config catalog, validation, masking, precedence.
- `packages/shared/src/ux-experiments.ts` — variant resolution helpers.
- `packages/shared/src/phase1-experiment-analytics.ts` — Phase-1 event allow-list sanitizer.
- `packages/shared/src/monetization-flags.ts` — monetization flag name constants.
- `apps/admin/src/lib/runtime-config.ts` — admin catalog/upsert/reset + shape validation.
- `apps/admin/src/app/api/feature-flags/route.ts` — admin flag CRUD.
- `apps/admin/src/app/api/runtime-config/route.ts` — admin runtime-config CRUD.
- `apps/web/src/app/api/tracking/event/route.ts` — internal event ingestion (POST/PUT).
- `apps/web/src/app/api/tracking/session/route.ts` — session telemetry ingestion.
- `apps/web/src/app/api/ready/route.ts` — readiness probe.
- `apps/web/src/app/api/cron/data-retention/route.ts` — retention cron driver.
- `apps/web/src/app/api/internal/ip-rules/route.ts`, `api/internal/rate-limit-log/route.ts` — internal config fan-out (auth via INTERNAL_WEBHOOK_SECRET).

## 3. Related Routes / Screens

- Admin: `(admin)/feature-flags/page.tsx` + `feature-flags-client.tsx`; runtime-config catalog under `(admin)/settings`.
- Web (flag consumers): `(app)/dashboard`, `(app)/moving`, `(app)/moving/plan/[id]`, `(app)/settings/subscription`, `(app)/layout.tsx`, `pricing`, `onboarding`, `partners/apply`, `blog/[slug]`, `llms.txt`/`llms-full.txt`.
- No user-facing screen renders raw flag/config values; flags are resolved server-side and prop-drilled (e.g. `dashboard/page.tsx:53-67`).

## 4. Related APIs

| API | Methods | Auth |
|---|---|---|
| `/api/tracking/event` | POST, PUT | consent gate + user session |
| `/api/tracking/session` | POST, PATCH | consent gate + user session |
| `/api/ready` | GET | public (safe summary only) |
| `/api/build-info` | GET | public |
| `/api/cron/data-retention` | GET, POST | `CRON_SECRET` via `guardCronRequest` |
| admin `/api/feature-flags` | GET/POST/PUT/DELETE | `requirePermission("settings", …, ADMIN)` + step-up (writes) |
| admin `/api/runtime-config` | GET/PUT/DELETE | `requirePermission("settings", …, SUPER_ADMIN)` + step-up+MFA (writes) |
| `/api/internal/ip-rules`, `/api/internal/rate-limit-log` | GET/POST | `INTERNAL_WEBHOOK_SECRET` |

## 5. Related Components

- `feature-flags-client.tsx` (admin): flag list/create/edit/delete UI; calls `/api/feature-flags`.
- Runtime-config catalog client (admin settings) consumes `listRuntimeConfigCatalog()` masked output.
- `DashboardClient` and other client components receive resolved booleans/variants as props — they never read flags directly (confirmed by absence of `isFeatureEnabled` imports in client `.tsx`).

## 6. Related State / Hooks / Stores

- Module-level in-memory caches: `flagCache`/`cacheTimestamp` (`feature-flags.ts:11-13`, 60s TTL); `_eventQueue`/`_sessionId`/`_flushTimer` (`analytics.ts:23-25`); `buffer`/`pendingEvents`/`flushTimer` (`integration-telemetry.ts:60-62`).
- No React stores; all state is process-local module state or DB rows.

## 7. Related Database / Models

- `FeatureFlag` (`schema.prisma:1636`) — `name` unique, `enabled`, `targetType`, `targetValue` (JSON text).
- `RuntimeConfigEntry` (`schema.prisma:1428`) — `key` unique, `isSecret`, `valueEncrypted`/`valuePlain`, `isActive`, `source`, validation/rotation metadata.
- `UserEvent` (`schema.prisma:1190`) — `userId`, `sessionId`, `event` (VarChar 50), `page`, `metadata` (Text JSON), `createdAt`. FK cascade on user delete.
- `IntegrationDailyStat` (`schema.prisma:2305`) — `@@unique([day, source])`, `statusCounts` JSON.
- `DataConsent` (`schema.prisma:201`) — analytics consent rows read by `tracking-consent.ts`.

## 8. Impact Map

- **UI:** Admin flag/config screens; flag-gated web surfaces (dashboard briefing, moving plan, pricing, partner apply). Wrong flag state silently hides/shows revenue surfaces.
- **API:** Tracking ingestion, readiness, cron retention, admin CRUD, internal fan-out.
- **DB:** `UserEvent`, `FeatureFlag`, `RuntimeConfigEntry`, `IntegrationDailyStat`, `UserSession`.
- **Auth:** Runtime-config holds JWT/encryption/cron secrets; readiness gates traffic on their presence.
- **Admin:** All write authz + audit + step-up live here.
- **Mobile:** Consumes flags/config indirectly; tracking consent path has a mobile branch (`tracking-consent.ts:20-34`). Mobile billing product IDs are runtime-config keys.
- **Notifications/Integrations:** Integration telemetry charts external-data health; kill switches (`KILL_OUTBOUND_EMAIL`, `KILL_SIGNUPS`) are runtime-config keys.
- **Analytics:** Entire Google + internal-event pipeline.
- **SEO:** `llms.txt`/`llms-full.txt` are flag-gated.
- **Tests:** Strong coverage for retention/telemetry/readiness/runtime-config/phase1; **gap** on `feature-flags.ts` and `user-event-sampling.ts`.

## 9. Buttons / Actions / Functions

**`isFeatureEnabled(flagName, ctx)`** (`feature-flags.ts:50`)
- Used by: dashboard, leads route, moving, profile, recommendations, pricing, etc.
- Expected: resolve a flag to boolean honoring targeting; fail-closed for unknown flags.
- Actual: fail-closed (`:56`, `:96`); ALL→true; PERCENTAGE deterministic by `userId+flagName` hash, **else `Math.random()`** (`:76`); USER_LIST/PLAN need context.
- Loading/disabled/error: catch on DB error returns the **stale cache** (`:45-47`) — reasonable. No per-call error surfaced to caller.
- Edge cases: PERCENTAGE with no `userId` is non-deterministic (see analytics-flags-runtime-03). Cache is per-process, 60s — admin change is invisible to the web process for up to 60s and `invalidateFlagCache` is never wired (see -02).

**`getAllFlags()`** (`feature-flags.ts:99`)
- Returns `{name: enabled}` ignoring targeting entirely. No production caller found (see -09, possible dead code).

**Admin flag create/update/delete** (`api/feature-flags/route.ts`)
- Permission check (`requirePermission settings ADMIN`), zod-strict body, target normalization, step-up password (+grace window), audit on success/failure. Behaves correctly. `id` capped to 30 chars matches CUID length.

**`getRuntimeConfigValue(key)`** (`runtime-config.ts:28`)
- env-first for managed keys, DB fallback only when DB-backed-allowed; decrypts secrets. Correct precedence per shared rules.

**`upsertRuntimeConfigEntry` / `resetRuntimeConfigEntry`** (`apps/admin/src/lib/runtime-config.ts:338,396`)
- Shape-validates, rejects deployment-only keys, encrypts secrets, audits (metadata only, never value). Step-up + MFA enforced at route. Correct.

**`recordIntegrationOutcome(source, status)`** (`integration-telemetry.ts:88`)
- Synchronous buffer push, never throws, background flush, best-effort persist with create-race retry. Correct by design.

**`pruneOldUserEvents(...)`** (`user-event-retention.ts:96`)
- Dry-run counts always; deletes only when enabled; batched with cap; re-applies `baseEligibleWhere` on delete to avoid deleting retained events. Correct.

**`shouldPersistUserEvent(event, config)`** (`user-event-sampling.ts:36`)
- Phase-1 events always kept; otherwise sample. Correct.

**`trackEvent` / `trackInternalEvent` / `flushEvents`** (`analytics.ts:176,213,238`)
- Consent-gated, sanitized, queued, flushed on threshold/timer/visibility/unload. See -06 (flush failure can drop events) and -07 (no PUT batching beyond 50 with silent truncation).

## 10. UI/UX Audit

- **A11y/theme/responsive:** Out of scope for these libs (no JSX). Admin flag/config clients were not deep-audited here; the data they render is masked server-side.
- **Finding (Info, analytics-flags-runtime-10):** Admin flag list GET returns raw `targetValue` JSON including `userIds` (internal app DB IDs) and `plans` to any `ADMIN`-role operator. Evidence: `api/feature-flags/route.ts:12-13` returns `flags` unmodified; runtime-config by contrast requires `SUPER_ADMIN` and masks. Impact: low (admin-only, IDs are internal), but the privilege floor differs (ADMIN vs SUPER_ADMIN) between the two control planes. Recommendation: confirm ADMIN is the intended floor for flag reads; consider matching the masked-summary discipline used for runtime-config. Priority: low.

## 11. Logic Audit

- **Expected flow:** flags/config resolved server-side → booleans/variants prop-drilled → client renders. Tracking events consent-gated → sanitized → sampled → persisted. Confirmed.
- **Cache staleness (analytics-flags-runtime-02):** `feature-flags.ts` caches for 60s per process and `invalidateFlagCache()` (`:106`) is exported but **never called** (grep shows only the definition). Admin flag writes happen in the admin process; the web process only refreshes on TTL expiry. So a flag flip (including a kill-style rollback of a monetization surface) can take up to 60s to take effect, and there is no manual invalidation hook. Same pattern for runtime-config reads (no caching there, so config is fresher than flags).
- **Wrong condition / non-determinism (analytics-flags-runtime-03):** PERCENTAGE rollout falls back to `Math.random()` when `context.userId` is absent (`feature-flags.ts:76`). Any anonymous/server context evaluating a PERCENTAGE flag gets a per-call coin flip — a user can flip in/out across requests, and the same render could show inconsistent gated UI. Most callers pass `userId`, but `isFeatureEnabled` is callable without it and the type makes `userId` optional.
- **Hash distribution (analytics-flags-runtime-08):** the deterministic bucket uses a 32-bit `((hash<<5)-hash)+char` folded with `hash & hash`, then `Math.abs(hash % 100)`. Acceptable for low-stakes UX experiments but is a weak, slightly biased hash; not crypto and not perfectly uniform. Document as "approximate" so it is not used for anything billing-affecting.
- **Sampling vs experiment integrity (OK):** Phase-1 events bypass sampling (`user-event-sampling.ts:41`) and retention pruning excludes only `LEGAL_CONSENT`/`ONBOARDING_COMPLETED` (`user-event-retention.ts:12`). Phase-1 funnel events ARE subject to retention pruning — confirm that is intended for experiment-analysis windows. **[needs verification]** that 30–3650 day retention is long enough for funnel analysis.
- **Race conditions:** integration-telemetry snapshots+clears buffer before await (`:193-195`) — safe. analytics flush clears timer then splices — safe within a tab.

## 12. Reverse Logic Audit

- **Unauthorized user → tracking:** `/api/tracking/event` returns 401 when no auth session but consent present (`route.ts:77-79`); returns `{disabled:true}` (200) when consent absent. No event stored without a user. Good.
- **Empty data:** retention/telemetry handle empty buffers/zero rows cleanly.
- **API error:** flag DB error → stale cache (no throw). Config DB error → `.catch(()=>null)` → env fallback. Readiness DB probe failure → `database:"unavailable"` + 503. All graceful.
- **Slow network:** readiness wraps config+DB probe in a 2.5s timeout (`api/ready/route.ts:29-43`) — good.
- **Double-click:** admin flag/config writes are idempotent upserts; leads idempotency keyed. Flag toggle double-submit is benign.
- **Stale data:** see -02 (60s flag staleness).
- **Direct route access:** internal routes require `INTERNAL_WEBHOOK_SECRET`; cron requires `CRON_SECRET`; admin requires role+step-up. Confirmed.
- **Token expiry / role change:** admin permission re-checked per request.
- **Mobile viewport / dark theme:** N/A (libs).
- **Mobile consent (analytics-flags-runtime-05):** `tracking-consent.ts:32` runs a `DataConsent` SELECT per request for mobile clients on every event/batch — an extra query on the hot tracking path (perf, not correctness). Web path uses a cookie (no query).

## 13. Security Audit

### analytics-flags-runtime-01 (Medium) — Non-Phase-1 internal events accept arbitrary attacker-controlled metadata keys/values (bounded)
- **Severity:** Medium
- **Affected area:** `/api/tracking/event` POST/PUT (`api/tracking/event/route.ts:28-58`), mirrored client-side in `analytics.ts:57-79`.
- **Evidence:** For events that are NOT Phase-1, `sanitizeEventMetadata` only runs `sanitizeMetadata`, which keeps any key that does not match `PII_KEY_PATTERN` and any string value ≤120 chars that is not an email/long-digit run. There is no allow-list of keys or event names for the non-Phase-1 path; the event name itself is any `safeString(event,50)`. So an authenticated user can write near-arbitrary `{key:value}` pairs (e.g. `{foo:"<script>…"}` truncated to 120 chars) into `UserEvent.metadata`.
- **Risk:** Stored low-grade data injection into the analytics log; values are persisted and later rendered in admin analytics surfaces. The regex PII filter is heuristic (e.g. a value like a person's full name in a non-PII-named key, or a free-text note, can slip through since only emails/7+digit runs are value-blocked). Combined with admin rendering this is a stored-XSS surface **iff** any admin view injects metadata as HTML **[needs verification — admin analytics rendering not in scope]**.
- **Defensive abuse scenario:** A logged-in user crafts tracking events with chosen keys/values to pollute analytics dashboards or smuggle short free-text payloads past the heuristic filter; if any downstream admin view is not output-encoded, the payload executes in an admin session.
- **Prevention:** Apply an allow-list of event names + metadata keys for the internal path (as already done for Phase-1), or at minimum strip HTML-significant characters and constrain values to a safe charset. Ensure all admin renderers output-encode metadata.
- **Detection:** Alert on unusual event-name cardinality or metadata keys outside a known set.
- **Analysis (root cause):** The Phase-1 hardening (allow-list) was applied only to Phase-1 events; legacy free-form events kept the heuristic-only filter.
- **Recommendation:** Extend allow-listing to all persisted event types or sanitize values to a safe charset; verify admin output-encoding.
- **Tests to add:** Route test asserting that a crafted non-Phase-1 event drops unexpected keys / encodes dangerous values.

### analytics-flags-runtime-04 (Low) — PERCENTAGE rollout uses non-deterministic `Math.random` without user context
- **Severity:** Low (security/consistency)
- **Affected area:** `feature-flags.ts:76`.
- **Evidence:** `return Math.random() * 100 < target.percentage;` when `context?.userId` is falsy.
- **Risk:** A gated surface can flicker on/off for the same anonymous session across requests; for a security-relevant gate (if one were ever PERCENTAGE-targeted) this is an unstable control.
- **Defensive abuse scenario:** An anonymous caller repeatedly retries to land in the enabled bucket of a PERCENTAGE flag.
- **Prevention:** Fail-closed (return false) when a PERCENTAGE flag has no stable subject, or require a stable bucketing key.
- **Detection:** N/A.
- **Analysis:** Convenience fallback for contexts lacking a user.
- **Recommendation:** Make the no-subject branch deterministic (false) or require a key.
- **Tests to add:** Determinism test for PERCENTAGE with/without userId.

- **No exposed secrets:** Readiness body returns only key names + messages (`production-readiness.ts:555-562`); runtime-config responses return `{success:true}` only and the catalog masks values (`apps/admin/src/lib/runtime-config.ts:113-155`); audit logs store lengths, never values (`api/runtime-config/route.ts:284-296`). Confirmed good.
- **SSRF:** Runtime-config URL keys are blocked against loopback/RFC1918/link-local/metadata hosts at write time (`shared runtime-config.ts:1855-1884`, admin `runtime-config.ts:213-274`). Good.
- **Auth/RBAC:** Admin CRUD gated by role + step-up; internal/cron routes gated by shared secrets. No IDOR observed.
- **Injection:** Prisma parameterized; metadata stored as a JSON string. The metadata concern is data-quality/stored-content, captured in -01.

## 14. Performance Audit

- **Flag eval:** single `findMany()` cached 60s — fine; but `findMany` loads ALL flags every refresh regardless of which is needed (acceptable at expected flag counts).
- **Mobile tracking consent (-05):** per-request `DataConsent` query on the hot path.
- **Retention cron:** batched deletes with caps and `maxBatches` guard — good; counts run 3 aggregate `count()`s before deleting (acceptable, indexed on `event`/`createdAt`).
- **Integration telemetry:** in-memory buffer, unref'd timer, best-effort — minimal overhead.
- **`/api/tracking/event` PUT:** `createMany` for up to 50 rows; sampling computed once per batch — good. Sampling config does a runtime-config read (2 keys) per batch flush (`route.ts:60-66`); not cached (minor).

## 15. Reliability Audit

- **Error boundaries:** All persistence paths swallow/down-grade errors (flag→stale cache, config→env fallback, telemetry→drop). Readiness probe degrades to 503.
- **Retry:** analytics flush re-queues a failed batch only if `_eventQueue.length < 100` (`analytics.ts:259-263`) — bounded; can drop events under sustained failure (see -06).
- **Partial failure:** integration-telemetry drops per-entry on persist failure by design.
- **Monitoring/logging:** retention + data-retention crons log structured results; runtime-config writes audited. Good.
- **analytics-flags-runtime-06 (Low):** `flushEvents` uses `fetch` without `keepalive`; on `beforeunload`/`visibilitychange` the in-flight POST may be cancelled by the browser, silently losing the final batch. Recommendation: use `navigator.sendBeacon` or `fetch(..., {keepalive:true})` for unload flushes.

## 16. Dead Code / Cleanup

- **analytics-flags-runtime-09 (Info):** `getAllFlags()` (`feature-flags.ts:99`) has no production caller (grep across `apps/`), and it returns `enabled` ignoring targeting, which would be misleading if used. **[confirm]** before removal — it may be intended for a future admin/debug surface.
- `__resetIntegrationTelemetryForTests` is test-only and correctly named.
- No other dead code confirmed in scope.

## 17. Tests

**Existing:** `analytics.test.ts`, `integration-telemetry.test.ts`, `production-readiness.test.ts`, `user-event-retention.test.ts`, web+admin+shared `runtime-config.test.ts`, `phase1-experiment-analytics.test.ts`, `ux-experiments.test.ts`, admin `feature-flags/route.test.ts`.

**Missing / suggested:**
- **`feature-flags.ts` unit test** — PERCENTAGE determinism (with/without userId), fail-closed for unknown/targeted-but-uncontextual flags, cache TTL/`invalidateFlagCache`. (Currently only mocked in callers.)
- **`user-event-sampling.ts` unit test** — Phase-1 bypass, rate clamping, disabled passthrough.
- **`/api/tracking/event` route test** — non-Phase-1 metadata sanitization / key dropping (covers -01).
- **`tracking-consent.ts` test** — mobile vs web branches, consent-absent short-circuit.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|---|---|---|---|---|---|---|
| analytics-flags-runtime-01 | Medium | Security | Non-Phase-1 internal events accept arbitrary metadata keys/values (heuristic filter only) | Stored low-grade injection into `UserEvent.metadata`; potential stored-XSS if admin view un-encoded | Allow-list/encode all persisted event metadata; verify admin output encoding | `api/tracking/event/route.ts`, `analytics.ts` |
| analytics-flags-runtime-02 | Medium | Reliability | `invalidateFlagCache` exported but never called; 60s per-process flag staleness, no invalidation on admin write | Flag flips/rollbacks delayed up to 60s; no break-glass invalidation | Wire invalidation (signal/short TTL/explicit refresh) | `feature-flags.ts` |
| analytics-flags-runtime-03 | Medium | Logic | PERCENTAGE flag non-deterministic (`Math.random`) when no `userId` | Inconsistent gating across requests for anon/server contexts | Fail-closed or require stable bucket key | `feature-flags.ts:76` |
| analytics-flags-runtime-04 | Low | Security | (subset of -03) coin-flip lets anon caller retry into enabled bucket | Unstable control if a security gate is PERCENTAGE | Deterministic no-subject branch | `feature-flags.ts:76` |
| analytics-flags-runtime-05 | Low | Performance | Mobile tracking consent does a `DataConsent` query per event/batch | Extra DB query on hot tracking path | Cache consent per session/short TTL | `tracking-consent.ts:32` |
| analytics-flags-runtime-06 | Low | Reliability | Unload flush uses plain `fetch` (no `keepalive`/beacon) | Final analytics batch may be dropped on tab close | Use `sendBeacon`/`keepalive` | `analytics.ts:238-276` |
| analytics-flags-runtime-07 | Low | Reliability | PUT batch silently truncates to 50 + client re-queue cap 100 | Event loss under burst/sustained failure | Document/observe drop, consider server ack | `api/tracking/event/route.ts:139`, `analytics.ts:260` |
| analytics-flags-runtime-08 | Low | Logic | Weak/biased non-crypto hash for experiment bucketing | Slightly non-uniform variant split | Document as approximate; don't use for billing | `feature-flags.ts:67-74` |
| analytics-flags-runtime-09 | Info | Dead Code | `getAllFlags()` unused and ignores targeting | Misleading if adopted later | Confirm + remove or document | `feature-flags.ts:99` |
| analytics-flags-runtime-10 | Info | API | Admin flag GET (ADMIN role) returns raw `targetValue`/userIds; runtime-config requires SUPER_ADMIN + masks | Inconsistent privilege floor between control planes | Confirm intended floor; align masking | `api/feature-flags/route.ts:9-13` |
| analytics-flags-runtime-11 | Info | Test | No unit tests for `feature-flags.ts` / `user-event-sampling.ts` / event route sanitizer | Core gating + sampling unverified | Add tests listed §17 | `feature-flags.ts`, `user-event-sampling.ts` |

## 19. Module TODO

- [ ] **(Medium, analytics-flags-runtime-01)** Allow-list or charset-sanitize all persisted event metadata; verify admin output encoding. Reason: stored injection surface. Files: `api/tracking/event/route.ts`, `analytics.ts`, admin analytics renderers. Dependencies: admin analytics rendering audit. Complexity: med. Risk: med (could drop currently-accepted keys).
- [ ] **(Medium, analytics-flags-runtime-02)** Wire `invalidateFlagCache` (or shorten TTL / add cross-process signal) so admin flag changes propagate predictably. Files: `feature-flags.ts`, admin `feature-flags/route.ts`. Complexity: med. Risk: med.
- [ ] **(Medium, analytics-flags-runtime-03)** Make PERCENTAGE evaluation fail-closed (or require a stable key) when no `userId`. Files: `feature-flags.ts`. Complexity: low. Risk: low.
- [ ] **(Low, analytics-flags-runtime-05)** Cache mobile analytics consent per session to drop the per-request `DataConsent` query. Files: `tracking-consent.ts`. Complexity: low. Risk: low.
- [ ] **(Low, analytics-flags-runtime-06)** Switch unload flush to `sendBeacon`/`keepalive`. Files: `analytics.ts`. Complexity: low. Risk: low.
- [ ] **(Info, analytics-flags-runtime-09)** Confirm and remove/justify `getAllFlags()`. Files: `feature-flags.ts`. Complexity: low. Risk: low.
- [ ] **(Info, analytics-flags-runtime-10)** Confirm the intended role floor for flag reads vs runtime-config; align masking discipline. Files: `api/feature-flags/route.ts`. Complexity: low. Risk: low.
- [ ] **(Info, analytics-flags-runtime-11)** Add unit tests for `feature-flags.ts`, `user-event-sampling.ts`, and the event route sanitizer. Files: new test files. Complexity: low. Risk: low.
